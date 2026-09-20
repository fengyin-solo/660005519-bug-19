import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import type { GridConfig, GridResult } from '@/types'

// 仅保留回测相关状态；行情（连接状态/ticks/盘口）统一走 useMarketData 单例
export const useTradingStore = defineStore('trading', () => {
  const loading = ref(false)
  const gridResult = ref<GridResult | null>(null)
  const config = ref<GridConfig>({ lowerPrice: 95, upperPrice: 115, gridCount: 20, capitalPerGrid: 1000, initialCapital: 100000 })

  async function runBacktest() {
    loading.value = true
    try { const { data } = await axios.post<GridResult>('/api/backtest', config.value); gridResult.value = data }
    finally { loading.value = false }
  }

  return { loading, gridResult, config, runBacktest }
})
