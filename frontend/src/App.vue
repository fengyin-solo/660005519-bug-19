<template>
  <div class="app-root">
    <header class="top-bar">
      <h1>📈 实时订单簿深度可视化与量化网格交易引擎</h1>
      <div class="status"><span class="dot" :class="{on:connected}"></span>{{ connected?'实时':'已断开' }}</div>
    </header>
    <div class="main-grid">
      <div class="col-wide">
        <OrderBookDepth />
        <PriceChart />
      </div>
      <div class="col-narrow">
        <GridControl />
        <BacktestReport />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import OrderBookDepth from './components/OrderBookDepth.vue'
import PriceChart from './components/PriceChart.vue'
import GridControl from './components/GridControl.vue'
import BacktestReport from './components/BacktestReport.vue'
import { useMarketData } from './composables/useMarketData'
const { connected, connect, disconnect } = useMarketData()
onMounted(connect)
onUnmounted(disconnect)
</script>

<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#0a0e27;color:#e0e0e0}
.app-root{min-height:100vh}
.top-bar{display:flex;justify-content:space-between;align-items:center;padding:10px 24px;background:#0f1535;border-bottom:1px solid #1e2a5a}
.top-bar h1{font-size:1.1rem;color:#4fc3f7}
.status{display:flex;align-items:center;gap:6px;font-size:12px;color:#94a3b8}
.dot{width:8px;height:8px;border-radius:50%;background:#ef4444}.dot.on{background:#22c55e}
.main-grid{display:grid;grid-template-columns:1fr 360px;gap:12px;padding:12px 24px;min-height:85vh}
.col-narrow{display:flex;flex-direction:column;gap:12px;overflow-y:auto}
</style>