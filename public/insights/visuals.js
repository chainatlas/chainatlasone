// Tiny canvas visuals for Insights cards (placeholder animations, no external deps)
(function(){
  function rand(seed){
    // deterministic pseudo-rand
    let t = seed + 0x6D2B79F5;
    return function(){
      t |= 0; t = (t + 0x6D2B79F5) | 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function resizeCanvas(c){
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = c.getBoundingClientRect();
    const w = Math.max(10, Math.round(rect.width));
    const h = Math.max(10, Math.round(rect.height));
    if (c.width !== w * dpr || c.height !== h * dpr){
      c.width = w * dpr;
      c.height = h * dpr;
      const ctx = c.getContext("2d");
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }
  }

  function drawSpark(ctx, w, h, seed, tick){
    const r = rand(seed);
    ctx.clearRect(0,0,w,h);
    // grid
    ctx.globalAlpha = 0.20;
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 1;
    for (let i=1;i<=3;i++){
      const y = (h/4)*i;
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // line
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(122,170,255,.95)";
    ctx.beginPath();
    const pts = 28;
    for (let i=0;i<pts;i++){
      const x = (w/(pts-1))*i;
      const n = (Math.sin((i*0.35)+(tick*0.04)+(seed*0.2)) * 0.45) + (r()*0.25);
      const y = h*0.55 - n*(h*0.35);
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();

    // fill
    ctx.globalAlpha = 0.20;
    ctx.fillStyle = "rgba(25,195,125,.9)";
    ctx.lineTo(w,h);
    ctx.lineTo(0,h);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawBars(ctx, w, h, seed, tick){
    const r = rand(seed);
    ctx.clearRect(0,0,w,h);
    const bars = 22;
    const gap = 4;
    const bw = (w - gap*(bars-1)) / bars;
    for (let i=0;i<bars;i++){
      const phase = tick*0.03 + i*0.35 + seed*0.2;
      const base = 0.25 + 0.75*Math.abs(Math.sin(phase));
      const noise = r()*0.18;
      const v = Math.min(1, base*0.75 + noise);
      const bh = v*(h-10);
      const x = i*(bw+gap);
      const y = h - bh;
      const col = i > bars*0.66 ? "rgba(25,195,125,.85)" : (i > bars*0.33 ? "rgba(242,193,78,.85)" : "rgba(122,170,255,.85)");
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x,y,bw,bh);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.strokeRect(0.5,0.5,w-1,h-1);
  }

  function drawRing(ctx, w, h, seed, tick){
    ctx.clearRect(0,0,w,h);
    const cx = w/2, cy = h/2;
    const R = Math.min(w,h)*0.34;
    const r = rand(seed);
    const p = 0.25 + 0.65*(0.5 + 0.5*Math.sin(tick*0.02 + seed));
    // track
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(255,255,255,.14)";
    ctx.beginPath();
    ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.stroke();
    // progress
    ctx.strokeStyle = "rgba(25,195,125,.85)";
    ctx.beginPath();
    ctx.arc(cx,cy,R,-Math.PI/2, -Math.PI/2 + p*(Math.PI*2));
    ctx.stroke();
    // dot
    const a = -Math.PI/2 + p*(Math.PI*2);
    ctx.fillStyle = "rgba(122,170,255,.95)";
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a)*R, cy + Math.sin(a)*R, 5, 0, Math.PI*2);
    ctx.fill();
  }

  const canvases = Array.from(document.querySelectorAll("canvas[data-viz]"));
  let tick = 0;

  function frame(){
    tick++;
    for (const c of canvases){
      resizeCanvas(c);
      const ctx = c.getContext("2d");
      const w = c.getBoundingClientRect().width;
      const h = c.getBoundingClientRect().height;
      const kind = c.getAttribute("data-viz");
      const seed = Number(c.getAttribute("data-seed") || "1");
      if (kind === "spark") drawSpark(ctx, w, h, seed, tick);
      else if (kind === "bars") drawBars(ctx, w, h, seed, tick);
      else drawRing(ctx, w, h, seed, tick);
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", () => {
    for (const c of canvases) resizeCanvas(c);
  });

  requestAnimationFrame(frame);
})();