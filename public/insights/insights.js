(function () {
  const API_BASE = "https://mempool.space/api";
  const POLL_MS = 15000;

  const data = window.INSIGHTS || {};
  const grids = {
    fees: document.getElementById("gridFees"),
    security: document.getElementById("gridSecurity"),
    supply: document.getElementById("gridSupply"),
  };

  // ---------- helpers ----------
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function setText(sel, text) {
    const n = document.querySelector(sel);
    if (n) n.textContent = text;
  }

  function setMetric(cardId, text) {
    setText(`#${cardId} .insightMetric`, text);
  }

  function setRowValue(cardId, rowIndex, valueText) {
    setText(`#${cardId} .row[data-row="${rowIndex}"] .v[data-val="1"]`, valueText);
  }

  function setProgress(cardId, value01) {
    const fill = document.querySelector(`#${cardId} .barFill[data-barfill="1"]`);
    if (!fill) return;
    const v = Math.max(0, Math.min(1, Number(value01 || 0)));
    fill.style.width = `${Math.round(v * 100)}%`;
  }

  async function fetchJSON(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }

  function fmt(n, digits = 0) {
    if (n == null || !isFinite(n)) return "—";
    return Number(n).toLocaleString(undefined, {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    });
  }

  function fmtSatvb(n) {
    if (n == null || !isFinite(n)) return "—";
    return `${Math.round(n)} sat/vB`;
  }

  function fmtVMB(vbytes) {
    if (vbytes == null || !isFinite(vbytes)) return "—";
    return `${(vbytes / 1_000_000).toFixed(1)} vMB`;
  }

  function blocksToClear(vbytes) {
    if (vbytes == null || !isFinite(vbytes)) return "—";
    return String(Math.max(1, Math.ceil(vbytes / 1_000_000)));
  }

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  // ---------- render cards ----------
  function card(mod) {
    const card = el("section", "card insightCard");
    card.id = `ins-${mod.id}`;

    const top = el("div", "insightTop");
    top.appendChild(el("h3", "insightTitle", mod.title));
    top.appendChild(el("div", "tagLive", mod.tag || "LIVE"));

    const metric = el("div", "insightMetric", mod.metric);
    const sub = el("p", "insightSub", mod.sub);

    const canvas = document.createElement("canvas");
    canvas.className = "miniViz";
    canvas.setAttribute("data-viz", mod.viz?.kind || "spark");
    canvas.setAttribute("data-seed", String(mod.viz?.seed || 1));

    const rows = el("div", "insightRows");
    (mod.rows || []).forEach(([k, v], i) => {
      const r = el("div", "row");
      r.setAttribute("data-row", String(i));
      r.appendChild(el("div", "k", k));
      const vv = el("div", "v", v);
      vv.setAttribute("data-val", "1");
      r.appendChild(vv);
      rows.appendChild(r);
    });

    let barWrap = null;
    if (mod.progress) {
      barWrap = el("div", "");
      const label = el("div", "muted", `${mod.progress.label}`);
      label.style.fontSize = "12px";
      label.style.fontWeight = "900";
      label.style.letterSpacing = ".02em";
      label.style.margin = "0 0 8px 2px";

      const bar = el("div", "bar");
      const fill = el("div", "barFill");
      fill.setAttribute("data-barfill", "1");
      fill.style.width = `${Math.round(clamp01(mod.progress.value || 0) * 100)}%`;
      bar.appendChild(fill);

      barWrap.appendChild(label);
      barWrap.appendChild(bar);
    }

    const actions = el("div", "insightActions");
   
    card.appendChild(top);
    card.appendChild(metric);
    card.appendChild(sub);
    card.appendChild(canvas);
    card.appendChild(rows);
    if (barWrap) card.appendChild(barWrap);
    card.appendChild(actions);

    return card;
  }

  (data.fees || []).forEach((m) => grids.fees && grids.fees.appendChild(card(m)));
  (data.security || []).forEach((m) => grids.security && grids.security.appendChild(card(m)));
  (data.supply || []).forEach((m) => grids.supply && grids.supply.appendChild(card(m)));

  // ---------- mini visuals (draw after DOM exists) ----------
  function rng(seed) {
    let t = seed + 0x6d2b79f5;
    return function () {
      t |= 0;
      t = (t + 0x6d2b79f5) | 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function ensureCanvasSize(c) {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = c.getBoundingClientRect();
    const w = Math.max(10, Math.round(rect.width));
    const h = Math.max(10, Math.round(rect.height));
    if (c.width !== w * dpr || c.height !== h * dpr) {
      c.width = w * dpr;
      c.height = h * dpr;
      const ctx = c.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return { w, h };
  }

  function drawSpark(ctx, w, h, seed, tick) {
    const r = rng(seed);
    ctx.clearRect(0, 0, w, h);

    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    for (let i = 1; i <= 3; i++) {
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(122,170,255,.95)";
    ctx.beginPath();
    const pts = 28;
    for (let i = 0; i < pts; i++) {
      const x = (w / (pts - 1)) * i;
      const n =
        Math.sin(i * 0.35 + tick * 0.04 + seed * 0.2) * 0.45 + r() * 0.25;
      const y = h * 0.58 - n * (h * 0.34);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "rgba(25,195,125,.9)";
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawBars(ctx, w, h, seed, tick) {
    const r = rng(seed);
    ctx.clearRect(0, 0, w, h);

    const bars = 22;
    const gap = 4;
    const bw = (w - gap * (bars - 1)) / bars;

    for (let i = 0; i < bars; i++) {
      const phase = tick * 0.03 + i * 0.35 + seed * 0.2;
      const base = 0.25 + 0.75 * Math.abs(Math.sin(phase));
      const noise = r() * 0.18;
      const v = Math.min(1, base * 0.75 + noise);
      const bh = v * (h - 10);
      const x = i * (bw + gap);
      const y = h - bh;
      const col =
        i > bars * 0.66
          ? "rgba(25,195,125,.85)"
          : i > bars * 0.33
          ? "rgba(242,193,78,.85)"
          : "rgba(122,170,255,.85)";
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, y, bw, bh);
    }

    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  }

  function drawRing(ctx, w, h, seed, tick) {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2,
      cy = h / 2;
    const R = Math.min(w, h) * 0.34;
    const p = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(tick * 0.02 + seed));

    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(255,255,255,.14)";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(25,195,125,.85)";
    ctx.beginPath();
    ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    ctx.stroke();

    const a = -Math.PI / 2 + p * Math.PI * 2;
    ctx.fillStyle = "rgba(122,170,255,.95)";
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function startVisualLoop() {
    const canvases = Array.from(document.querySelectorAll("canvas[data-viz]"));
    let tick = 0;

    function frame() {
      tick++;
      for (const c of canvases) {
        const { w, h } = ensureCanvasSize(c);
        const ctx = c.getContext("2d");
        const kind = c.getAttribute("data-viz");
        const seed = Number(c.getAttribute("data-seed") || "1");

        if (kind === "bars") drawBars(ctx, w, h, seed, tick);
        else if (kind === "ring") drawRing(ctx, w, h, seed, tick);
        else drawSpark(ctx, w, h, seed, tick);
      }
      requestAnimationFrame(frame);
    }

    window.addEventListener("resize", () => canvases.forEach(ensureCanvasSize));
    requestAnimationFrame(frame);
  }

  startVisualLoop();

  // ---------- LIVE DATA: all 9 cards (defensive) ----------
  async function getTipHeight() {
    return fetchJSON(`${API_BASE}/blocks/tip/height`);
  }

  async function getRecentBlocks() {
    // mempool.space: /api/blocks returns recent blocks
    return fetchJSON(`${API_BASE}/blocks`);
  }

  async function updateFeeMarket() {
    const cardId = "ins-fees";
    try {
      const fees = await fetchJSON(`${API_BASE}/v1/fees/recommended`);
      const mem = await fetchJSON(`${API_BASE}/mempool`);

      const fast = fees.fastestFee;
      const hour = fees.halfHourFee ?? fees.hourFee;
      const econ = fees.economyFee ?? fees.minimumFee;

      setMetric(cardId, fmtSatvb(fast));
      setRowValue(cardId, 0, `${Math.round(fast)} / ${Math.round(hour)} / ${Math.round(econ)}`);
      setRowValue(cardId, 1, fmtVMB(mem.vsize));
      setRowValue(cardId, 2, blocksToClear(mem.vsize));

      setProgress(cardId, clamp01((Number(fast) || 0) / 200));
    } catch {
      setMetric(cardId, "— sat/vB");
      setRowValue(cardId, 0, "— / — / —");
      setRowValue(cardId, 1, "—");
      setRowValue(cardId, 2, "—");
      setProgress(cardId, 0);
    }
  }

  async function updateMempoolPressure() {
    const cardId = "ins-pressure";
    try {
      const mem = await fetchJSON(`${API_BASE}/mempool`);

      const vmb = (mem.vsize || 0) / 1_000_000;
      const cong = clamp01(vmb / 300);

      setMetric(cardId, fmtVMB(mem.vsize));
      setRowValue(cardId, 0, fmtVMB(mem.vsize));
      setRowValue(cardId, 1, "—"); // Phase 2: compute from stored history
      setRowValue(cardId, 2, `${Math.round(cong * 100)} / 100`);
      setProgress(cardId, cong);
    } catch {
      setMetric(cardId, "— MB");
      setRowValue(cardId, 0, "—");
      setRowValue(cardId, 1, "—");
      setRowValue(cardId, 2, "—");
      setProgress(cardId, 0);
    }
  }

  async function updateBlockspaceUsage() {
    const cardId = "ins-blockspace";
    try {
      const blocks = await getRecentBlocks();
      if (!Array.isArray(blocks) || blocks.length === 0) throw new Error("no blocks");

      // Typical max weight: 4,000,000
      let sumFill = 0;
      let sumTx = 0;
      let sumFees = 0;
      let feeCount = 0;

      for (const b of blocks.slice(0, 10)) {
        const weight = b.weight ?? b.size * 4; // fallback
        sumFill += clamp01((weight || 0) / 4_000_000);
        sumTx += (b.tx_count || 0);

        // many mempool block objects include "fee" or "fees" or extras; try common keys:
        const fee = b.fee ?? b.fees ?? b.total_fee ?? (b.extras && (b.extras.fee || b.extras.total_fee));
        if (fee != null && isFinite(fee)) {
          sumFees += Number(fee);
          feeCount++;
        }
      }

      const avgFill = sumFill / Math.min(10, blocks.length);
      const avgTx = sumTx / Math.min(10, blocks.length);
      const avgFees = feeCount ? (sumFees / feeCount) : null;

      setMetric(cardId, `${Math.round(avgFill * 100)} %`);
      setRowValue(cardId, 0, `${Math.round(avgFill * 100)}%`);
      setRowValue(cardId, 1, avgFees == null ? "—" : `${fmt(avgFees / 1e8, 3)} BTC`);
      setRowValue(cardId, 2, fmt(avgTx, 0));
      setProgress(cardId, avgFill);
    } catch {
      setMetric(cardId, "— %");
      setRowValue(cardId, 0, "—");
      setRowValue(cardId, 1, "—");
      setRowValue(cardId, 2, "—");
      setProgress(cardId, 0);
    }
  }

  async function updateHashrate() {
    const cardId = "ins-hashrate";
    try {
      // mempool.space commonly provides hashrate endpoints under /v1/mining/hashrate/*
      // We'll try a few; first that works wins.
      const endpoints = [
        `${API_BASE}/v1/mining/hashrate/3d`,
        `${API_BASE}/v1/mining/hashrate/1w`,
        `${API_BASE}/v1/mining/hashrate/1m`,
      ];

      let series = null;
      for (const u of endpoints) {
        try {
          const j = await fetchJSON(u);
          if (Array.isArray(j) && j.length) { series = j; break; }
          if (j && Array.isArray(j.hashrates) && j.hashrates.length) { series = j.hashrates; break; }
        } catch {}
      }
      if (!series) throw new Error("no hashrate endpoint");

      // Try to read numeric hashrate from objects
      const vals = series
        .map(p => p.avgHashrate ?? p.hashrate ?? p.value ?? p[1] ?? null)
        .filter(v => v != null && isFinite(v))
        .map(Number);

      if (!vals.length) throw new Error("bad series");

      const last = vals[vals.length - 1];
      const avg7 = vals.slice(Math.max(0, vals.length - 7)).reduce((a,b)=>a+b,0) / Math.min(7, vals.length);
      const avg30 = vals.slice(Math.max(0, vals.length - 30)).reduce((a,b)=>a+b,0) / Math.min(30, vals.length);
      const trend = (last >= avg7) ? "up" : "down";

      // Many APIs return H/s. If it’s already EH/s, keep. If it’s huge, convert to EH/s.
      const eh = (last > 1e12) ? (last / 1e18) : last;

      setMetric(cardId, `${fmt(eh, 1)} EH/s`);
      setRowValue(cardId, 0, `${fmt(avg7 > 1e12 ? avg7/1e18 : avg7, 1)} EH/s`);
      setRowValue(cardId, 1, `${fmt(avg30 > 1e12 ? avg30/1e18 : avg30, 1)} EH/s`);
      setRowValue(cardId, 2, trend);
      setProgress(cardId, clamp01(Math.abs((last - avg30) / (avg30 || last || 1))));
    } catch {
      setMetric(cardId, "— EH/s");
      setRowValue(cardId, 0, "—");
      setRowValue(cardId, 1, "—");
      setRowValue(cardId, 2, "—");
      setProgress(cardId, 0);
    }
  }

  async function updateDifficultyRetarget() {
    const cardId = "ins-difficulty";
    try {
      // mempool.space has /v1/difficulty-adjustment
      const d = await fetchJSON(`${API_BASE}/v1/difficulty-adjustment`);

      const remaining = d.remainingBlocks ?? d.remaining_blocks ?? d.blocksRemaining ?? null;
      const progress = d.progressPercent ?? d.progress_percent ?? d.progress ?? null;
      const est = d.estimatedRetargetDate ?? d.estimated_retarget_date ?? d.estimatedRetargetTime ?? null;
      const curDiff = d.currentDifficulty ?? d.current_difficulty ?? d.difficulty ?? null;

      setMetric(cardId, remaining == null ? "— blocks" : `${fmt(remaining,0)} blocks`);
      setRowValue(cardId, 0, curDiff == null ? "—" : fmt(curDiff, 0));
      setRowValue(cardId, 1, progress == null ? "—%" : `${fmt(progress, 1)}%`);
      setRowValue(cardId, 2, est == null ? "—" : new Date(est * 1000).toLocaleString());

      setProgress(cardId, clamp01((Number(progress) || 0) / 100));
    } catch {
      setMetric(cardId, "— blocks");
      setRowValue(cardId, 0, "—");
      setRowValue(cardId, 1, "—");
      setRowValue(cardId, 2, "—");
      setProgress(cardId, 0);
    }
  }

  async function updateBlockTimeHealth() {
    const cardId = "ins-blocktime";
    try {
      const blocks = await getRecentBlocks();
      if (!Array.isArray(blocks) || blocks.length < 6) throw new Error("not enough blocks");

      // blocks are usually newest-first; compute deltas in minutes
      const ts = blocks.slice(0, 12).map(b => b.timestamp).filter(Boolean);
      const deltas = [];
      for (let i = 0; i < ts.length - 1; i++) {
        const dt = Math.abs(ts[i] - ts[i + 1]) / 60;
        deltas.push(dt);
      }
      const avg = deltas.reduce((a,b)=>a+b,0) / deltas.length;
      const aheadBehind = avg < 10 ? `${fmt(10-avg,1)} min faster` : `${fmt(avg-10,1)} min slower`;

      setMetric(cardId, `${fmt(avg, 1)} min`);
      setRowValue(cardId, 0, `${fmt(avg, 1)} min`);
      setRowValue(cardId, 1, aheadBehind);
      setRowValue(cardId, 2, "10.0 min");

      setProgress(cardId, clamp01(1 - Math.abs(avg - 10) / 10));
    } catch {
      setMetric(cardId, "— min");
      setRowValue(cardId, 0, "—");
      setRowValue(cardId, 1, "—");
      setRowValue(cardId, 2, "10.0 min");
      setProgress(cardId, 0);
    }
  }

  // ---- supply math (precise from protocol rules) ----
  const HALVING_INTERVAL = 210000;
  const COIN = 100000000n;

  function subsidySatsAtHeight(height) {
    const era = Math.floor(height / HALVING_INTERVAL);
    if (era >= 34) return 0n;
    return (50n * COIN) >> BigInt(era);
  }

  function totalSupplySatsAtHeight(height) {
    // supply after 'height' blocks have been mined (coinbase count = height)
    let h = BigInt(height);
    let supply = 0n;
    for (let era = 0; era < 34; era++) {
      const start = BigInt(era) * BigInt(HALVING_INTERVAL);
      const end = start + BigInt(HALVING_INTERVAL);
      if (h <= start) break;

      const blocksInEra = (h < end) ? (h - start) : BigInt(HALVING_INTERVAL);
      const sub = (50n * COIN) >> BigInt(era);
      supply += blocksInEra * sub;
    }
    return supply;
  }

  function satsToBTC(satsBig) {
    // return number-ish string with 8 decimals
    const whole = satsBig / COIN;
    const frac = satsBig % COIN;
    return `${whole.toString()}.${frac.toString().padStart(8, "0")}`;
  }

  async function updateSupplyDynamics() {
    const cardId = "ins-issuance";
    try {
      const height = await getTipHeight();
      const subSats = subsidySatsAtHeight(height);
      const subBTC = Number(subSats) / 1e8;

      const supplySats = totalSupplySatsAtHeight(height);
      const supplyBTC = Number(supplySats) / 1e8;

      const perDay = subBTC * 144;
      const perYear = perDay * 365;
      const inflation = supplyBTC > 0 ? (perYear / supplyBTC) * 100 : 0;

      const remainingBTC = 21000000 - supplyBTC;
      const minedPct = supplyBTC / 21000000;

      setMetric(cardId, `${fmt(perDay, 0)} BTC/day`);
      setRowValue(cardId, 0, `${fmt(inflation, 2)}%`);
      setRowValue(cardId, 1, `${fmt(perYear, 0)} BTC`);
      setRowValue(cardId, 2, `${fmt(remainingBTC, 0)} BTC`);
      setProgress(cardId, clamp01(minedPct));
    } catch {
      setMetric(cardId, "— BTC/day");
      setRowValue(cardId, 0, "—");
      setRowValue(cardId, 1, "—");
      setRowValue(cardId, 2, "—");
      setProgress(cardId, 0);
    }
  }

  async function updateHalvingImpact() {
    const cardId = "ins-halvingImpact";
    try {
      const height = await getTipHeight();
      const era = Math.floor(height / HALVING_INTERVAL);
      const nextHalvingHeight = (era + 1) * HALVING_INTERVAL;
      const blocksLeft = Math.max(0, nextHalvingHeight - height);
      const daysLeft = blocksLeft / 144;

      const curSub = Number(subsidySatsAtHeight(height)) / 1e8;
      const nextSub = Number(subsidySatsAtHeight(nextHalvingHeight)) / 1e8; // after halving
      const changePct = curSub > 0 ? ((nextSub - curSub) / curSub) * 100 : 0;

      setMetric(cardId, `${fmt(daysLeft, 0)} days`);
      setRowValue(cardId, 0, `${fmt(curSub, 3)} BTC`);
      setRowValue(cardId, 1, `${fmt(nextSub, 3)} BTC`);
      setRowValue(cardId, 2, `${fmt(changePct, 0)}%`);

      setProgress(cardId, clamp01(1 - blocksLeft / HALVING_INTERVAL));
    } catch {
      setMetric(cardId, "— days");
      setRowValue(cardId, 0, "—");
      setRowValue(cardId, 1, "—");
      setRowValue(cardId, 2, "—");
      setProgress(cardId, 0);
    }
  }

  async function updateOnChainActivity() {
    const cardId = "ins-activity";
    try {
      const blocks = await getRecentBlocks();
      if (!Array.isArray(blocks) || blocks.length === 0) throw new Error("no blocks");

      const slice = blocks.slice(0, 12);
      const avgTx = slice.reduce((a, b) => a + (b.tx_count || 0), 0) / slice.length;
      const txDay = avgTx * 144;

      // fees/day estimate if fee present
      let feesSum = 0;
      let feesN = 0;
      for (const b of slice) {
        const fee = b.fee ?? b.fees ?? b.total_fee ?? (b.extras && (b.extras.fee || b.extras.total_fee));
        if (fee != null && isFinite(fee)) { feesSum += Number(fee); feesN++; }
      }
      const feesPerBlock = feesN ? (feesSum / feesN) : null;
      const feesDay = feesPerBlock == null ? null : (feesPerBlock * 144);

      setMetric(cardId, `${fmt(txDay, 0)} tx/day`);
      setRowValue(cardId, 0, fmt(avgTx, 0));
      setRowValue(cardId, 1, "144");
      setRowValue(cardId, 2, feesDay == null ? "—" : `${fmt(feesDay / 1e8, 2)} BTC`);

      setProgress(cardId, clamp01(txDay / 600000)); // 600k/day as rough scale
    } catch {
      setMetric(cardId, "— tx/day");
      setRowValue(cardId, 0, "—");
      setRowValue(cardId, 1, "144");
      setRowValue(cardId, 2, "—");
      setProgress(cardId, 0);
    }
  }

  async function tickAll() {
    // Fee & blockspace
    updateFeeMarket();
    updateMempoolPressure();
    updateBlockspaceUsage();

    // Mining & security
    updateHashrate();
    updateDifficultyRetarget();
    updateBlockTimeHealth();

    // Supply & monetary policy
    updateSupplyDynamics();
    updateHalvingImpact();
    updateOnChainActivity();
  }

  // initial + poll
  tickAll();
  setInterval(tickAll, POLL_MS);
})();
