function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function isDark() {
  return (document.documentElement.getAttribute("data-theme") || "dark") === "dark";
}

function clear(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function getPalette() {
  // pull from your CSS vars; fallbacks are safe
  const bg = cssVar("--bg", "#070a12");
  const text = cssVar("--text", "rgba(235,240,248,1)");
  const muted = cssVar("--muted", "rgba(235,240,248,.65)");
  const stroke = cssVar("--stroke", "rgba(255,255,255,.10)");
  const stroke2 = cssVar("--stroke2", "rgba(255,255,255,.14)");
  const green = cssVar("--green", "#19c37d");
  const amber = cssVar("--amber", "#f2c14e");
  const blue = cssVar("--blue", "#7aaaff");
  return { bg, text, muted, stroke, stroke2, green, amber, blue };
}

function drawCardFrame(ctx, w, h, p) {
  const dark = isDark();

  // subtle panel background
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)");
  g.addColorStop(1, dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)");

  ctx.fillStyle = g;
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 14);
  ctx.fill();

  // border
  ctx.strokeStyle = p.stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawMiniMempool(ctx, w, h, t, p) {
  drawCardFrame(ctx, w, h, p);

  const dark = isDark();
  const pad = 12;

  // belt
  const beltY = h * 0.58;
  const beltH = h * 0.22;
  const beltX = pad;
  const beltW = w - pad * 2;

  const beltG = ctx.createLinearGradient(0, beltY, 0, beltY + beltH);
  beltG.addColorStop(0, dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)");
  beltG.addColorStop(1, dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)");
  ctx.fillStyle = beltG;
  ctx.fillRect(beltX, beltY, beltW, beltH);

  // moving capsules
  const n = 5;
  const speed = 0.18;
  const phase = (t * speed) % 1;

  for (let i = 0; i < n; i++) {
    const u = (i / n + phase) % 1;
    const x = beltX + u * (beltW - 34);
    const y = beltY + (beltH - 14) / 2;
    const w2 = 34;
    const h2 = 14;

    const col = i % 3 === 0 ? p.blue : i % 3 === 1 ? p.amber : p.green;

    ctx.save();
    ctx.globalAlpha = dark ? 0.18 : 0.10;
    ctx.fillStyle = col;
    ctx.filter = "blur(6px)";
    roundRect(ctx, x - 3, y - 3, w2 + 6, h2 + 6, 999);
    ctx.fill();
    ctx.filter = "none";
    ctx.restore();

    ctx.fillStyle = dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.65)";
    roundRect(ctx, x, y, w2, h2, 999);
    ctx.fill();

    ctx.strokeStyle = p.stroke2;
    ctx.lineWidth = 1;
    roundRect(ctx, x + 1, y + 1, w2 - 2, h2 - 2, 999);
    ctx.stroke();
  }

  // title glyphs
  ctx.fillStyle = p.muted;
  ctx.font = `900 10px system-ui`;
  ctx.fillText("MEMPOOL", pad, 16);
}

function drawMiniHalving(ctx, w, h, t, p) {
  drawCardFrame(ctx, w, h, p);

  const dark = isDark();
  const cx = w * 0.22;
  const cy = h * 0.55;
  const r = Math.min(w, h) * 0.26;

  // arc base
  ctx.lineCap = "round";
  ctx.lineWidth = 10;
  ctx.strokeStyle = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI * 0.8, Math.PI * 0.8);
  ctx.stroke();

  // progress arc (animated)
  const prog = 0.25 + 0.25 * (Math.sin(t * 1.2) * 0.5 + 0.5);
  const grad = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  grad.addColorStop(0, p.blue);
  grad.addColorStop(0.5, p.amber);
  grad.addColorStop(1, p.green);

  ctx.strokeStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI * 0.8, -Math.PI * 0.8 + (Math.PI * 1.6) * prog);
  ctx.stroke();

  // label
  ctx.fillStyle = p.muted;
  ctx.font = `900 10px system-ui`;
  ctx.fillText("HALVING", w * 0.46, 16);

  ctx.fillStyle = dark ? "rgba(235,240,248,0.85)" : "rgba(15,18,28,0.75)";
  ctx.font = `950 12px system-ui`;
  ctx.fillText("epoch progress", w * 0.46, 36);
}

function drawMiniSupply(ctx, w, h, t, p) {
  drawCardFrame(ctx, w, h, p);

  const dark = isDark();
  const pad = 12;

  ctx.fillStyle = p.muted;
  ctx.font = `900 10px system-ui`;
  ctx.fillText("SUPPLY", pad, 16);

  // progress bar
  const x = pad;
  const y = h * 0.58;
  const bw = w - pad * 2;
  const bh = 14;

  ctx.fillStyle = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  roundRect(ctx, x, y, bw, bh, 999);
  ctx.fill();

  const prog = 0.55 + 0.10 * (Math.sin(t * 1.0) * 0.5 + 0.5);
  const fg = ctx.createLinearGradient(x, 0, x + bw, 0);
  fg.addColorStop(0, p.blue);
  fg.addColorStop(0.5, p.amber);
  fg.addColorStop(1, p.green);

  ctx.fillStyle = fg;
  roundRect(ctx, x, y, bw * prog, bh, 999);
  ctx.fill();
}

function drawMiniTx(ctx, w, h, t, p) {
  drawCardFrame(ctx, w, h, p);

  const dark = isDark();
  const pad = 12;

  ctx.fillStyle = p.muted;
  ctx.font = `900 10px system-ui`;
  ctx.fillText("TX", pad, 16);

  // UTXO-ish flow: 2 inputs -> 2 outputs
  const leftX = pad + 16;
  const midX = w * 0.52;
  const rightX = w - pad - 16;

  const y1 = h * 0.44;
  const y2 = h * 0.66;

  const pulse = 0.35 + 0.65 * (Math.sin(t * 2.0) * 0.5 + 0.5);

  function node(x, y, col) {
    ctx.save();
    ctx.globalAlpha = dark ? 0.18 : 0.10;
    ctx.fillStyle = col;
    ctx.filter = "blur(8px)";
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = "none";
    ctx.restore();

    ctx.fillStyle = dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.65)";
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = p.stroke2;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  function link(x1, y1, x2, y2, col, a) {
    ctx.strokeStyle = col;
    ctx.globalAlpha = a;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // links
  const col = p.green;
  link(leftX, y1, midX, h * 0.55, col, 0.12 + 0.18 * pulse);
  link(leftX, y2, midX, h * 0.55, col, 0.12 + 0.18 * (1 - pulse));
  link(midX, h * 0.55, rightX, y1, col, 0.12 + 0.18 * pulse);
  link(midX, h * 0.55, rightX, y2, col, 0.12 + 0.18 * (1 - pulse));

  // nodes
  node(leftX, y1, p.blue);
  node(leftX, y2, p.blue);
  node(midX, h * 0.55, p.amber);
  node(rightX, y1, p.green);
  node(rightX, y2, p.green);
}

function drawMiniPrice(ctx, w, h, t, p) {
  drawCardFrame(ctx, w, h, p);

  const dark = isDark();
  const pad = 12;

  ctx.fillStyle = p.muted;
  ctx.font = `900 10px system-ui`;
  ctx.fillText("PRICE", pad, 16);

  // sparkline
  const x0 = pad;
  const y0 = h * 0.72;
  const w0 = w - pad * 2;
  const h0 = h * 0.34;

  const grad = ctx.createLinearGradient(x0, 0, x0 + w0, 0);
  grad.addColorStop(0, p.blue);
  grad.addColorStop(0.5, p.amber);
  grad.addColorStop(1, p.green);

  ctx.strokeStyle = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + w0, y0);
  ctx.stroke();

  ctx.strokeStyle = grad;
  ctx.lineWidth = 2;

  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    const x = x0 + u * w0;
    const wave = Math.sin((u * 6.28) + t * 1.2) * 0.35 + Math.sin((u * 12.56) - t * 0.9) * 0.12;
    const y = y0 - (0.55 + wave) * h0;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // subtle fill
  ctx.globalAlpha = dark ? 0.10 : 0.12;
  ctx.lineTo(x0 + w0, y0);
  ctx.lineTo(x0, y0);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawIllustration(canvas, kind, t) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // handle DPR for crispness
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;
  const w = Math.max(1, Math.round(cssW * dpr));
  const h = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const p = getPalette();
  clear(ctx, cssW, cssH);

  switch (kind) {
    case "mempool": return drawMiniMempool(ctx, cssW, cssH, t, p);
    case "halving": return drawMiniHalving(ctx, cssW, cssH, t, p);
    case "supply": return drawMiniSupply(ctx, cssW, cssH, t, p);
    case "tx": return drawMiniTx(ctx, cssW, cssH, t, p);
    case "price": return drawMiniPrice(ctx, cssW, cssH, t, p);
    default: return drawMiniMempool(ctx, cssW, cssH, t, p);
  }
}

export function startIllustrationLoop(getCanvases) {
  let raf = 0;
  let last = performance.now();
  let time = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;

    const items = getCanvases();
    for (const it of items) drawIllustration(it.canvas, it.kind, time);

    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame(frame);

  // redraw immediately on theme change (when your theme button toggles data-theme)
  const obs = new MutationObserver(() => {
    const items = getCanvases();
    for (const it of items) drawIllustration(it.canvas, it.kind, time);
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  window.addEventListener("resize", () => {
    const items = getCanvases();
    for (const it of items) drawIllustration(it.canvas, it.kind, time);
  });

  return () => {
    cancelAnimationFrame(raf);
    obs.disconnect();
  };
}
