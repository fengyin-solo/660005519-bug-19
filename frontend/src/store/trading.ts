import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { GridConfig, GridResult } from '@/types'
import { fetchBacktest, marketData } from '@/services/marketData'

/**
 * 页面级 store。行情取数 / 连接状态 / 接口返回的解释全部收敛在
 * services/marketData 的单例中，本 store 只做透传：顶部与各面板
 * 无论从 store 还是直接使用该服务，拿到的都是同一份状态。
 */
export const useTradingStore = defineStore('trading', () => {
  const loading = ref(false)
  const gridResult = ref<GridResult | null>(null)
  const config = ref<GridConfig>({ lowerPrice: 95, upperPrice: 115, gridCount: 20, capitalPerGrid: 1000, initialCapital: 100000 })

  async function runBacktest() {
    loading.value = true
    try {
      gridResult.value = await fetchBacktest(config.value)
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    // 行情部分：全部来自共享实现，store 不再持有第二份副本。
    ticks: marketData.ticks,
    orderBook: marketData.orderBook,
    lastUpdated: marketData.lastUpdated,
    status: marketData.status,
    wsConnected: marketData.wsConnected,
    gridResult,
    config,
    connectWS: () => marketData.connect(),
    disconnectWS: () => marketData.disconnect(),
    runBacktest,
  }
})
