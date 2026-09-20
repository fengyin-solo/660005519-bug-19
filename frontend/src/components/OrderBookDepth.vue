<template>
  <div class="panel"><h4>📊 订单簿深度</h4><canvas ref="cvs" width="360" height="280" class="depth-canvas"></canvas></div>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useMarketData } from '../composables/useMarketData'
const { orderBook } = useMarketData(); const cvs = ref<HTMLCanvasElement>()
function draw() {
  const c = cvs.value!; const ctx = c.getContext('2d')!; const W=c.width,H=c.height
  ctx.fillStyle='#0a0e27';ctx.fillRect(0,0,W,H)
  const ob = orderBook.value; if(!ob) return
  const maxQty = Math.max(...ob.bids.map(b=>b[1]),...ob.asks.map(a=>a[1]),1)
  const scale = (W/2-20) / maxQty
  // Bids (green, left)
  ob.bids.slice(0,10).forEach((b,i)=>{
    const w = b[1]*scale; const y = 10 + i*(H-20)/10; const h = (H-20)/10-2
    ctx.fillStyle='rgba(34,197,94,0.6)'; ctx.fillRect(W/2-10-w,y,w,h)
    ctx.fillStyle='#94a3b8'; ctx.font='10px monospace'; ctx.fillText(b[0].toFixed(1),W/2+6,y+12)
    ctx.fillText(String(b[1]),W/2-14-w,y+12)
  })
  // Asks (red, right)
  ob.asks.slice(0,10).forEach((a,i)=>{
    const w = a[1]*scale; const y = 10 + i*(H-20)/10; const h = (H-20)/10-2
    ctx.fillStyle='rgba(239,68,68,0.6)'; ctx.fillRect(W/2+10,y,w,h)
    ctx.fillStyle='#f87171'; ctx.font='10px monospace'; ctx.fillText(a[0].toFixed(1),W/2+14+w+4,y+12)
    ctx.textAlign='right'; ctx.fillText(String(a[1]),W/2+8,y+12); ctx.textAlign='left'
  })
  ctx.strokeStyle='#334155';ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke()
}
watch(orderBook,draw,{deep:true})
</script>
<style scoped>.panel{background:#0f1535;border-radius:8px;padding:12px;border:1px solid #1e2a5a}.panel h4{color:#4fc3f7;font-size:13px;margin-bottom:8px}.depth-canvas{display:block;margin:0 auto;border-radius:4px}</style>