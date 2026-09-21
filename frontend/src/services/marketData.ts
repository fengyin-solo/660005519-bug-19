import axios from 'axios'
import { ref } from 'vue'
import type { GridConfig, GridResult, OrderBook, Tick } from '@/types'

/**
 * 行情取数与接口返回的唯一共用实现：
 * - WebSocket 的连接 / 中断 / 恢复生命周期只在这里维护一份；
 * - 服务端推送与 HTTP 接口返回都在这里归一化之后才暴露给页面。
 * 顶部状态栏与各个面板一律从本模块取数，不再各自解释同一份行情。
 */

export type ConnectionStatus = 'connecting' | 'live' | 'disconnected'

export interface MarketSnapshot {
  ticks: Tick[]
  orderBook: OrderBook
}

const WS_URL = `ws://${location.hostname}:8000/ws`
const MAX_TICKS = 60
const BASE_RECONNECT_DELAY = 1000
const MAX_RECONNECT_DELAY = 5000
/** WebSocket readyState 常量，本地定义以免依赖宿主实现上的静态属性。 */
const SOCKET_CONNECTING = 0
const SOCKET_OPEN = 1

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function normalizeTick(raw: unknown): Tick | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Record<string, unknown>
  if (
    typeof t.time !== 'string' ||
    !isFiniteNumber(t.price) ||
    !isFiniteNumber(t.bid) ||
    !isFiniteNumber(t.ask) ||
    !isFiniteNumber(t.volume)
  ) {
    return null
  }
  return { time: t.time, price: t.price, bid: t.bid, ask: t.ask, volume: t.volume }
}

function normalizeLevel(raw: unknown): [number, number] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null
  if (!isFiniteNumber(raw[0]) || !isFiniteNumber(raw[1])) return null
  return [raw[0], raw[1]]
}

function normalizeOrderBook(raw: unknown): OrderBook | null {
  if (!raw || typeof raw !== 'object') return null
  const ob = raw as Record<string, unknown>
  const bids = Array.isArray(ob.bids) ? ob.bids.map(normalizeLevel).filter((l): l is [number, number] => l !== null) : []
  const asks = Array.isArray(ob.asks) ? ob.asks.map(normalizeLevel).filter((l): l is [number, number] => l !== null) : []
  if (!bids.length || !asks.length || !isFiniteNumber(ob.midPrice) || !isFiniteNumber(ob.spread)) return null
  return { bids, asks, midPrice: ob.midPrice, spread: ob.spread }
}

/**
 * 解析一次行情推送：整条消息要么整体生效、要么整体丢弃，
 * 避免 ticks 已刷新而盘口仍是上一条的跨消息混搭。
 */
export function normalizeMarketMessage(data: unknown): MarketSnapshot | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (!Array.isArray(d.ticks) || !d.orderBook) return null
  const ticks = d.ticks
    .map(normalizeTick)
    .filter((t): t is Tick => t !== null)
    .slice(-MAX_TICKS)
  const orderBook = normalizeOrderBook(d.orderBook)
  if (!ticks.length || !orderBook) return null
  return { ticks, orderBook }
}

/** /api/backtest 返回值的唯一解释入口，保证面板拿到的字段类型稳定。 */
export function normalizeBacktestResult(data: unknown): GridResult {
  const d = (data ?? {}) as Record<string, unknown>
  const num = (v: unknown): number => (isFiniteNumber(v) ? v : 0)
  return {
    orders: Array.isArray(d.orders) ? (d.orders as GridResult['orders']) : [],
    totalProfit: num(d.totalProfit),
    returnRate: num(d.returnRate),
    sharpeRatio: num(d.sharpeRatio),
    maxDrawdown: num(d.maxDrawdown),
    winRate: num(d.winRate),
    equityCurve: Array.isArray(d.equityCurve) ? (d.equityCurve as number[]) : [],
  }
}

export async function fetchBacktest(config: GridConfig): Promise<GridResult> {
  const { data } = await axios.post('/api/backtest', config)
  return normalizeBacktestResult(data)
}

class MarketDataService {
  /** 'live' 表示连接可用且已收到行情；顶部状态灯只认这一个来源。 */
  readonly status = ref<ConnectionStatus>('disconnected')
  readonly wsConnected = ref(false)
  readonly ticks = ref<Tick[]>([])
  readonly orderBook = ref<OrderBook | null>(null)
  readonly lastUpdated = ref<number | null>(null)

  private ws: WebSocket | null = null
  /** 连接代次：每次 connect / disconnect 递增，旧代次 socket 的回调一律作废。 */
  private generation = 0
  private manualClose = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0

  /** 建立行情连接；已存在可用连接时幂等，反复调用不会叠加 socket。 */
  connect() {
    if (this.ws && (this.ws.readyState === SOCKET_OPEN || this.ws.readyState === SOCKET_CONNECTING)) return
    this.clearReconnectTimer()
    this.teardownSocket()
    this.manualClose = false

    const generation = ++this.generation
    this.resetMarketData('connecting')

    const ws = new WebSocket(WS_URL)
    this.ws = ws

    ws.onopen = () => {
      if (generation !== this.generation) return
      this.reconnectAttempts = 0
      this.status.value = 'live'
      this.wsConnected.value = true
    }

    ws.onmessage = (e: MessageEvent<string>) => {
      if (generation !== this.generation) return
      let parsed: unknown
      try {
        parsed = JSON.parse(e.data)
      } catch {
        return
      }
      const snapshot = normalizeMarketMessage(parsed)
      if (!snapshot) return
      this.ticks.value = snapshot.ticks
      this.orderBook.value = snapshot.orderBook
      this.lastUpdated.value = Date.now()
      // 正常情况下 onopen 已翻为 live；此处兜底，确保“有行情”与“状态灯”同源。
      if (this.status.value !== 'live') {
        this.status.value = 'live'
        this.wsConnected.value = true
      }
    }

    ws.onerror = () => {
      // 浏览器在 error 之后一定还会触发 close，状态统一交给 onclose 处理。
    }

    ws.onclose = () => {
      // 旧代次连接关闭（例如重连/手动断开后残余的回调）不得影响当前状态。
      if (generation !== this.generation) return
      this.teardownSocket()
      this.resetMarketData('disconnected')
      if (!this.manualClose) this.scheduleReconnect()
    }
  }

  /** 主动关闭（离开页面等）：停止自动恢复并清空行情，回到与刚打开页面一致的状态。 */
  disconnect() {
    this.manualClose = true
    this.generation++
    this.clearReconnectTimer()
    this.teardownSocket()
    this.resetMarketData('disconnected')
  }

  private scheduleReconnect() {
    if (this.manualClose || this.reconnectTimer !== null) return
    const delay = Math.min(BASE_RECONNECT_DELAY * 2 ** Math.min(this.reconnectAttempts, 3), MAX_RECONNECT_DELAY)
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.manualClose) this.connect()
    }, delay)
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private teardownSocket() {
    const ws = this.ws
    if (!ws) return
    this.ws = null
    ws.onopen = null
    ws.onmessage = null
    ws.onerror = null
    ws.onclose = null
    try {
      if (ws.readyState === SOCKET_OPEN || ws.readyState === SOCKET_CONNECTING) ws.close()
    } catch {
      /* socket 已失效，忽略 */
    }
  }

  /**
   * 统一行情可见性：只有 live 时面板才保留数据；
   * 连接中 / 断开时 ticks 与盘口一律清空，与“重新打开页面”看到的初始状态相同，
   * 顶部状态灯与各面板因此永远对得上，也不会残留上一轮的旧值。
   */
  private resetMarketData(status: ConnectionStatus) {
    this.status.value = status
    this.wsConnected.value = status === 'live'
    if (status !== 'live') {
      this.ticks.value = []
      this.orderBook.value = null
      this.lastUpdated.value = null
    }
  }
}

/** 全应用单例：顶部与所有面板共享同一份行情状态。 */
export const marketData = new MarketDataService()
