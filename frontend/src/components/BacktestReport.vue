<template>
  <div class="panel" v-if="store.gridResult">
    <h4>📋 回测报告</h4>
    <div class="metric-grid">
      <div class="metric">
        <div class="m-val" :class="store.gridResult.totalProfit>=0?'profit':'loss'">¥{{ store.gridResult.totalProfit.toFixed(0) }}</div>
        <div class="m-label">总盈亏</div>
      </div>
      <div class="metric"><div class="m-val" :class="store.gridResult.returnRate>=0?'profit':'loss'">{{ store.gridResult.returnRate.toFixed(2) }}%</div><div class="m-label">收益率</div></div>
      <div class="metric"><div class="m-val">{{ store.gridResult.sharpeRatio.toFixed(2) }}</div><div class="m-label">夏普比率</div></div>
      <div class="metric"><div class="m-val loss">{{ store.gridResult.maxDrawdown.toFixed(2) }}%</div><div class="m-label">最大回撤</div></div>
      <div class="metric"><div class="m-val">{{ store.gridResult.winRate.toFixed(1) }}%</div><div class="m-label">胜率</div></div>
      <div class="metric"><div class="m-val">{{ store.gridResult.orders.filter(o=>o.side==='SELL').length }}</div><div class="m-label">成交笔数</div></div>
    </div>
    <div ref="eqChart" class="chart"></div>
    <div class="order-list" v-if="store.gridResult.orders.length">
      <div class="section-title">最近成交</div>
      <div v-for="o in store.gridResult.orders.slice(-8).reverse()" :key="o.id" class="order-row" :class="o.side">
        <span class="o-side">{{ o.side }}</span>
        <span class="o-price">@¥{{ o.price }}</span>
        <span class="o-qty">{{ o.quantity.toFixed(2) }}</span>
        <span class="o-profit" :class="o.profit>=0?'profit':'loss'" v-if="o.side==='SELL'">+¥{{ o.profit.toFixed(2) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import { useTradingStore } from '../store/trading'
const store = useTradingStore(); const eqChart = ref<HTMLDivElement>(); let inst: echarts.ECharts|null=null

function updateEq() {
  if (!store.gridResult) return
  if (!inst && eqChart.value) inst = echarts.init(eqChart.value)
  if (!inst) return
  const eq = store.gridResult.equityCurve
  inst.setOption({
    backgroundColor:'transparent',grid:{left:45,right:10,top:5,bottom:20},
    xAxis:{type:'category',data:eq.map((_,i)=>i),show:false},
    yAxis:{type:'value',axisLabel:{color:'#94a3b8',fontSize:9}},
    series:[{type:'line',data:eq,symbol:'none',lineStyle:{color:'#4fc3f7',width:1},
      areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(79,195,247,0.2)'},{offset:1,color:'rgba(79,195,247,0)'}])}
    }],animation:false
  })
}
watch(()=>store.gridResult,(r)=>{if(r) setTimeout(updateEq,50)})
onMounted(updateEq)
onUnmounted(()=>inst?.dispose())
</script>

<style scoped>
.panel{background:#0f1535;border-radius:8px;padding:12px;border:1px solid #1e2a5a}
.panel h4{color:#4fc3f7;font-size:13px;margin-bottom:8px}
.metric-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.metric{text-align:center;padding:8px;background:#0a0e27;border-radius:6px}
.m-val{font-size:18px;font-weight:700}.m-val.profit{color:#22c55e}.m-val.loss{color:#ef4444}
.m-label{font-size:10px;color:#64748b;margin-top:2px}
.chart{width:100%;height:120px;margin-top:8px}
.order-row{display:flex;gap:8px;padding:3px 6px;font-size:11px;border-radius:3px;margin:1px 0}
.order-row.BUY{background:#22c55e15}.order-row.SELL{background:#ef444415}
.o-side{font-weight:700;min-width:30px}.o-side:has-text("BUY"){color:#22c55e}.o-side:has-text("SELL"){color:#ef4444}
.o-price{color:#94a3b8}.o-qty{color:#64748b}.o-profit.profit{color:#22c55e}.o-profit.loss{color:#ef4444}
.section-title{font-size:11px;color:#64748b;margin:6px 0 4px}
</style>