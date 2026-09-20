import { ref } from 'vue'
import type { Tick, OrderBook } from '@/types'

/**
 * 行情数据的唯一入口（模块级单例）。
 * 顶部状态栏与各面板都从这里取数：连接状态、ticks、盘口只有这一份，
 * 接口返回（WebSocket 推送）也只在这里解析一次，避免各处解释不一致。
 */

interface MarketPayload {
  ticks?: Tick[]
  orderBook?: OrderBook
}

const MAX_TICKS = 60
// 断线自动重连的退避间隔（毫秒），最后一档作为兜底间隔重复使用
const RECONNECT_DELAYS = [1000, 2000, 5000]

const ticks = ref<Tick[]>([])
const orderBook = ref<OrderBook | null>(null)
const connected = ref(false)

let socket: WebSocket | null = null
// 会话代号：每次 connect/disconnect 都 +1，用于让旧连接的回调全部失效，
// 反复切换（重连/解绑）时旧连接不可能再改到共享状态。
let session = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

function clearReconnectTimer() {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

// 行情中断/切换时清空上一轮残留，顶部状态与各面板同步回到“无数据”态
function resetMarketData() {
  ticks.value = []
  orderBook.value = null
}

// 统一的接口返回解析：只认这一份逻辑
function handlePayload(data: string) {
  let payload: MarketPayload
  try {
    payload = JSON.parse(data)
  } catch {
    return
  }
  if (Array.isArray(payload.ticks)) ticks.value = payload.ticks.slice(-MAX_TICKS)
  if (payload.orderBook) orderBook.value = payload.orderBook
}

function scheduleReconnect(mySession: number, attempt: number) {
  if (mySession !== session) return
  clearReconnectTimer()
  const delay = RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)]
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (mySession === session) openSocket(mySession, attempt + 1)
  }, delay)
}

function teardownSocket() {
  const old = socket
  socket = null
  if (old) {
    // 摘掉旧连接的全部回调，它之后的任何事件都不允许影响共享状态
    old.onopen = old.onmessage = old.onclose = old.onerror = null
    try { old.close() } catch { /* ignore */ }
  }
}

function openSocket(mySession: number, attempt: number) {
  if (mySession !== session) return
  // 建立连接期间顶部与面板保持“已断开/无数据”，直到收到新一轮推送
  connected.value = false
  const ws = new WebSocket(`ws://${location.hostname}:8000/ws`)
  socket = ws

  ws.onopen = () => {
    if (mySession !== session || socket !== ws) return
    connected.value = true
  }
  ws.onmessage = (e) => {
    if (mySession !== session || socket !== ws) return
    handlePayload(typeof e.data === 'string' ? e.data : String(e.data))
  }
  ws.onclose = () => {
    if (mySession !== session || socket !== ws) return
    socket = null
    connected.value = false
    resetMarketData()
    // 非主动断开：自动退避重连，恢复后顶部与面板用同一份新数据
    scheduleReconnect(mySession, attempt)
  }
  ws.onerror = () => {
    if (mySession !== session || socket !== ws) return
    ws.close()
  }
}

// 幂等：重复调用不会产生第二条连接
function connect() {
  clearReconnectTimer()
  session += 1
  teardownSocket()
  connected.value = false
  resetMarketData()
  openSocket(session, 0)
}

function disconnect() {
  clearReconnectTimer()
  session += 1
  teardownSocket()
  connected.value = false
  resetMarketData()
}

export function useMarketData() {
  return { ticks, orderBook, connected, connect, disconnect }
}
