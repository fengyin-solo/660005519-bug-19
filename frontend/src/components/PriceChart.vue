<template>
  <div class="panel" style="margin-top:12px"><h4>📈 实时价格 + K线</h4><div ref="chart" class="chart"></div></div>
</template>
<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import { useMarketData } from '../composables/useMarketData'
const { ticks } = useMarketData(); const chart = ref<HTMLDivElement>(); let inst: echarts.ECharts|null=null
function update() {
  if (!inst) return
  const list = ticks.value
  inst.setOption({
    backgroundColor:'transparent',grid:{left:50,right:15,top:10,bottom:25},
    xAxis:{type:'category',data:list.map(t=>t.time),axisLabel:{color:'#94a3b8',fontSize:9}},
    yAxis:{type:'value',axisLabel:{color:'#94a3b8'}},
    series:[
      {type:'line',data:list.map(t=>t.price),symbol:'none',lineStyle:{color:'#4fc3f7',width:1.5},
        areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(79,195,247,0.3)'},{offset:1,color:'rgba(79,195,247,0)'}])}}
    ],animation:false
  })
}
onMounted(()=>{if(chart.value){inst=echarts.init(chart.value);update()}})
watch(ticks,update,{deep:true})
onUnmounted(()=>inst?.dispose())
</script>
<style scoped>.panel{background:#0f1535;border-radius:8px;padding:12px;border:1px solid #1e2a5a}.panel h4{color:#4fc3f7;font-size:13px;margin-bottom:4px}.chart{width:100%;height:300px}</style>