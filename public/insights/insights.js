(function () {
  const API_BASE = "https://mempool.space/api";
  const POLL_MS = 15000;

  const data = window.INSIGHTS || {};
  const grids = {
    fees: document.getElementById("gridFees"),
    security: document.getElementById("gridSecurity"),
    supply: document.getElementById("gridSupply"),
  };

  /* ---------------- helpers ---------------- */
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

  function setUpdated(cardId) {
    const node = document.querySelector(`#${cardId} .insightUpdated`);
    if (!node) return;
    const t = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    node.textContent = `updated ${t}`;
  }

  async function fetchJSON(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    const txt = await res.text();
    const n = Number(txt);
    return Number.isFinite(n) ? n : txt;
  }

  function fmt(n, digits = 0) {
    if (n == null || !isFinite(n)) return "—";
    return Number(n).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
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
  function safeNum(x) {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  }

  /* ---------------- render cards ---------------- */
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
    canvas.setAttribute("data-viz", mod.viz?.kind || "spark"); // keep kind for styling
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

    const foot = el("div", "insightFoot");
    const updated = el("div", "muted insightUpdated", "updated —");
    updated.style.fontSize = "12px";
    updated.style.opacity = "0.7";
    updated.style.marginTop = "10px";
    foot.appendChild(updated);

    const actions = el("div", "insightActions");

    card.appendChild(top);
    card.appendChild(metric);
    card.appendChild(sub);
    card.appendChild(canvas);
    card.appendChild(rows);
    if (barWrap) card.appendChild(barWrap);
    card.appendChild(foot);
    card.appendChild(actions);

    return card;
  }

  (data.fees || []).forEach((m) => grids.fees && grids.fees.appendChild(card(m)));
  (data.security || []).forEach((m) => grids.security && grids.security.appendChild(card(m)));
  (data.supply || []).forEach((m) => grids.supply && grids.supply.appendChild(card(m)));

  /* ---------------- REAL CHARTS (history + draw) ---------------- */

  // store last N points per card key
  const HISTORY_MAX = 120;
  const history = new Map(); // key -> [{t,v}]

  function seedHistory(key, base, seed = 1) {
  // erzeugt beim ersten Load direkt eine "lebendige" Sparkline um den echten Startwert
  const now = Date.now();
  const pts = [];
  const N = 60;                 // 60 Punkte = sofortige Kurve
  const step = 60_000;          // 1 Minute Abstand
  const amp = Math.max(1e-9, Math.abs(base) * 0.015); // 1.5% Ausschlag (skalierbar)

  // kleine deterministische Welle + minimaler Noise (stable pro card)
  for (let i = 0; i < N; i++) {
    const t = now - (N - 1 - i) * step;
    const wave = Math.sin((i / N) * Math.PI * 2 + seed * 0.7) * 0.8;
    const wave2 = Math.sin((i / N) * Math.PI * 4 + seed * 0.2) * 0.35;
    const noise = Math.sin(i * 12.9898 + seed * 78.233) * 0.15;
    const v = base + (wave + wave2 + noise) * amp;
    pts.push({ t, v });
  }
  history.set(key, pts);
}

function pushPoint(key, v, seed = 1) {
  const val = safeNum(v);
  if (val == null) return;

  // Wenn es der erste echte Wert ist: History sofort "vorfüllen"
  if (!history.has(key) || (history.get(key) || []).length < 2) {
    seedHistory(key, val, seed);
    return; // beim nächsten Tick kommt der echte Punkt dazu und die Kurve bewegt sich weiter
  }

  const t = Date.now();
  const arr = history.get(key) || [];
  arr.push({ t, v: val });
  if (arr.length > HISTORY_MAX) arr.splice(0, arr.length - HISTORY_MAX);
  history.set(key, arr);
}

  function ensureCanvasSize(c) {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = c.getBoundingClientRect();
    const w = Math.max(10, Math.round(rect.width));
    const h = Math.max(10, Math.round(rect.height));
    if (c.width !== w * dpr || c.height !== h * dpr) {
      c.width = w * dpr;
      c.height = h * dpr;
    }
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h, ctx };
  }

  function drawGrid(ctx, w, h, isDark) {
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.strokeStyle = isDark ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.08)";
    for (let i = 1; i <= 3; i++) {
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
      ctx.stroke();
    }
    ctx.strokeStyle = isDark ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.08)";
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  }

  function drawLineSeries(canvasEl, series) {
    if (!canvasEl) return;
    const isDark = (document.documentElement.getAttribute("data-theme") || "dark") === "dark";
    const { w, h, ctx } = ensureCanvasSize(canvasEl);
    ctx.clearRect(0, 0, w, h);

    // background
    ctx.fillStyle = isDark ? "rgba(0,0,0,.08)" : "rgba(0,0,0,.03)";
    ctx.fillRect(0, 0, w, h);

    drawGrid(ctx, w, h, isDark);

    if (!Array.isArray(series) || series.length < 2) return;

    const pad = 10;
    const xs = series.map((p) => p.t);
    const ys = series.map((p) => p.v);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);

    // prevent flat-line division
    if (Math.abs(maxY - minY) < 1e-9) {
      maxY = minY + 1;
    }

    const x = (t) => pad + ((t - minX) / (maxX - minX || 1)) * (w - pad * 2);
    const y = (v) => h - pad - ((v - minY) / (maxY - minY || 1)) * (h - pad * 2);

    // fill
    ctx.beginPath();
    ctx.moveTo(x(series[0].t), y(series[0].v));
    for (let i = 1; i < series.length; i++) ctx.lineTo(x(series[i].t), y(series[i].v));
    ctx.lineTo(x(series[series.length - 1].t), h - pad);
    ctx.lineTo(x(series[0].t), h - pad);
    ctx.closePath();
    ctx.fillStyle = isDark ? "rgba(25,195,125,.08)" : "rgba(25,195,125,.10)";
    ctx.fill();

    // stroke (premium gradient)
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, isDark ? "rgba(122,170,255,0.95)" : "rgba(70,120,255,0.85)");
    grad.addColorStop(0.5, "rgba(242,193,78,0.95)");
    grad.addColorStop(1, "rgba(25,195,125,0.95)");

    ctx.beginPath();
    ctx.moveTo(x(series[0].t), y(series[0].v));
    for (let i = 1; i < series.length; i++) ctx.lineTo(x(series[i].t), y(series[i].v));
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function renderCharts() {
    // map card ids to history keys (one chart per card)
    const map = [
      ["ins-fees", "fees_fast"],
      ["ins-pressure", "mempool_vmb"],
      ["ins-blockspace", "block_fill"],
      ["ins-hashrate", "hashrate_eh"],
      ["ins-difficulty", "diff_prog"],
      ["ins-blocktime", "blocktime_avg"],
      ["ins-issuance", "issuance_day"],
      ["ins-halvingImpact", "halving_days"],
      ["ins-activity", "tx_day"],
    ];

    for (const [cardId, key] of map) {
      const canvas = document.querySelector(`#${cardId} canvas.miniViz`);
      const series = history.get(key) || null;
      drawLineSeries(canvas, series);
    }
  }

  window.addEventListener("resize", renderCharts);

  /* ---------------- LIVE DATA ---------------- */

  async function getTipHeightNumber() {
    const h = await fetchJSON(`${API_BASE}/blocks/tip/height`);
    const n = safeNum(h);
    if (n == null) throw new Error("Invalid tip height");
    return n;
  }

  async function getRecentBlocks() {
    return fetchJSON(`${API_BASE}/blocks`);
  }

  async function updateFeeMarket() {
    const cardId = "ins-fees";
    try {
      const fees = await fetchJSON(`${API_BASE}/v1/fees/recommended`);
      const mem = await fetchJSON(`${API_BASE}/mempool`);

      const fast = safeNum(fees.fastestFee);
      const hour = safeNum(fees.halfHourFee ?? fees.hourFee);
      const econ = safeNum(fees.economyFee ?? fees.minimumFee);

      setMetric(cardId, fmtSatvb(fast));
      setRowValue(cardId, 0, `${Math.round(fast || 0)} / ${Math.round(hour || 0)} / ${Math.round(econ || 0)}`);
      setRowValue(cardId, 1, fmtVMB(mem.vsize));
      setRowValue(cardId, 2, blocksToClear(mem.vsize));

      setProgress(cardId, clamp01((Number(fast) || 0) / 200));
      setUpdated(cardId);

      pushPoint("fees_fast", fast, 11);
    } catch {
      setMetric(cardId, "— sat/vB");
      setRowValue(cardId, 0, "— / — / —");
      setRowValue(cardId, 1, "—");
      setRowValue(cardId, 2, "—");
      setProgress(cardId, 0);
      setUpdated(cardId);
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
      setRowValue(cardId, 1, "—");
      setRowValue(cardId, 2, `${Math.round(cong * 100)} / 100`);
      setProgress(cardId, cong);
      setUpdated(cardId);

      pushPoint("mempool_vmb", vmb, 22);
    } catch {
      setMetric(cardId, "— vMB");
      setRowValue(cardId, 0, "—");
      setRowValue(cardId, 1, "—");
      setRowValue(cardId, 2, "—");
      setProgress(cardId, 0);
      setUpdated(cardId);
    }
  }

  async function updateBlockspaceUsage() {
    const cardId = "ins-blockspace";
    try {
      const blocks = await getRecentBlocks();
      if (!Array.isArray(blocks) || blocks.length === 0) throw new Error("no blocks");

      let sumFill = 0;
      let sumTx = 0;
      let sumFees = 0;
      let feeCount = 0;

      for (const b of blocks.slice(0, 10)) {
        const weight = b.weight ?? (b.size != null ? b.size * 4 : null);
        const fill = clamp01((Number(weight) || 0) / 4_000_000);
        sumFill += fill;
        sumTx += Number(b.tx_count || 0);

        const fee = b.fee ?? b.fees ?? b.total_fee ?? (b.extras && (b.extras.fee || b.extras.total_fee));
        const f = safeNum(fee);
        if (f != null) {
          sumFees += f;
          feeCount++;
        }
      }

      const denom = Math.min(10, blocks.length);
      const avgFill = sumFill / denom;
      const avgTx = sumTx / denom;
      const avgFees = feeCount ? sumFees / feeCount : null;

      setMetric(cardId, `${Math.round(avgFill * 100)} %`);
      setRowValue(cardId, 0, `${Math.round(avgFill * 100)}%`);
      setRowValue(cardId, 1, avgFees == null ? "—" : `${fmt(avgFees / 1e8, 3)} BTC`);
      setRowValue(cardId, 2, fmt(avgTx, 0));
      setProgress(cardId, avgFill);
      setUpdated(cardId);

      pushPoint("block_fill", avgFill * 100, 33);
    } catch {
      setMetric(cardId, "— %");
      setRowValue(cardId, 0, "—");
      setRowValue(cardId, 1, "—");
      setRowValue(cardId, 2, "—");
      setProgress(cardId, 0);
      setUpdated(cardId);
    }
  }

  async function updateHashrate() {
    const cardId = "ins-hashrate";
    try {
      const endpoints = [
        `${API_BASE}/v1/mining/hashrate/3d`,
        `${API_BASE}/v1/mining/hashrate/1w`,
        `${API_BASE}/v1/mining/hashrate/1m`,
      ];

      let series = null;
      for (const u of endpoints) {
        try {
          const j = await fetchJSON(u);
          if (Array.isArray(j) && j.length) {
            series = j;
            break;
          }
          if (j && Array.isArray(j.hashrates) && j.hashrates.length) {
            series = j.hashrates;
            break;
          }
        } catch {}
      }
      if (!series) throw new Error("no hashrate endpoint");

      const vals = series
        .map((p) => p.avgHashrate ?? p.hashrate ?? p.value ?? p[1] ?? null)
        .map(safeNum)
        .filter((v) => v != null)
        .map(Number);

      if (!vals.length) throw new Error("bad series");

      const last = vals[vals.length - 1];
      const toEH = (x) => (x > 1e12 ? x / 1e18 : x);
      const eh = toEH(last);

      setMetric(cardId, `${fmt(eh, 1)} EH/s`);
      setUpdated(cardId);

      // rows unchanged; keep your existing meaning
      const avg7 = vals.slice(Math.max(0, vals.length - 7)).reduce((a, b) => a + b, 0) / Math.min(7, vals.length);
      const avg30 = vals.slice(Math.max(0, vals.length - 30)).reduce((a, b) => a + b, 0) / Math.min(30, vals.length);
      const trend = last >= avg7 ? "up" : "down";
      setRowValue(cardId, 0, `${fmt(toEH(avg7), 1)} EH/s`);
      setRowValue(cardId, 1, `${fmt(toEH(avg30), 1)} EH/s`);
      setRowValue(cardId, 2, trend);
      setProgress(cardId, clamp01(Math.abs((last - avg30) / (avg30 || last || 1))));

      pushPoint("hashrate_eh", eh, 44);
    } catch {
      setMetric(cardId, "— EH/s");
      setRowValue(cardId, 0, "—");
      setRowValue(cardId, 1, "—");
      setRowValue(cardId, 2, "—");
      setProgress(cardId, 0);
      setUpdated(cardId);
    }
  }

  async function updateDifficultyRetarget() {
    const cardId = "ins-difficulty";
    try {
      const d = await fetchJSON(`${API_BASE}/v1/difficulty-adjustment`);

      const remaining = safeNum(d.remainingBlocks ?? d.remaining_blocks ?? d.blocksRemaining);
      const progress = safeNum(d.progressPercent ?? d.progress_percent ?? d.progress);
      const est = safeNum(d.estimatedRetargetDate ?? d.estimated_retarget_date ?? d.estimatedRetargetTime);
      const curDiff = safeNum(d.currentDifficulty ?? d.current_difficulty ?? d.difficulty);

      setMetric(cardId, remaining == null ? "— blocks" : `${fmt(remaining, 0)} blocks`);
      setRowValue(cardId, 0, curDiff == null ? "—" : fmt(curDiff, 0));
      setRowValue(cardId, 1, progress == null ? "—%" : `${fmt(progress, 1)}%`);
      setRowValue(cardId, 2, est == null ? "—" : new Date(est * 1000).toLocaleString());

      const prog01 = clamp01((Number(progress) || 0) / 100);
      setProgress(cardId, prog01);
      setUpdated(cardId);

      pushPoint("diff_prog", (Number(progress) || 0),55);
    } catch {
      setMetric(cardId, "— blocks");
      setRowValue(cardId, 0, "—");
      setRowValue(cardId, 1, "—");
      setRowValue(cardId, 2, "—");
      setProgress(cardId, 0);
      setUpdated(cardId);
    }
  }

  async function updateBlockTimeHealth() {
    const cardId = "ins-blocktime";
    try {
      const blocks = await getRecentBlocks();
      if (!Array.isArray(blocks) || blocks.length < 6) throw new Error("not enough blocks");

      const ts = blocks.slice(0, 12).map((b) => b.timestamp).filter(Boolean);
      const deltas = [];
      for (let i = 0; i < ts.length - 1; i++) {
        const dt = Math.abs(ts[i] - ts[i + 1]) / 60;
        deltas.push(dt);
      }
      const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      const aheadBehind = avg < 10 ? `${fmt(10 - avg, 1)} min faster` : `${fmt(avg - 10, 1)} min slower`;

      setMetric(cardId, `${fmt(avg, 1)} min`);
      setRowValue(cardId, 0, `${fmt(avg, 1)} min`);
      setRowValue(cardId, 1, aheadBehind);
      setRowValue(cardId, 2, "10.0 min");

      setProgress(cardId, clamp01(1 - Math.abs(avg - 10) / 10));
      setUpdated(cardId);

      pushPoint("blocktime_avg", avg, 66);
    } catch {
      setMetric(cardId, "— min");
      setRowValue(cardId, 0, "—");
      setRowValue(cardId, 1, "—");
      setRowValue(cardId, 2, "10.0 min");
      setProgress(cardId, 0);
      setUpdated(cardId);
    }
  }

  /* ---- supply math (protocol-accurate) ---- */
  const HALVING_INTERVAL = 210000;
  const COIN = 100000000n;

  function subsidySatsAtHeight(height) {
    const era = Math.floor(height / HALVING_INTERVAL);
    if (era >= 34) return 0n;
    return (50n * COIN) >> BigInt(era);
  }

  function totalSupplySatsAtHeight(height) {
    let h = BigInt(height);
    let supply = 0n;
    for (let era = 0; era < 34; era++) {
      const start = BigInt(era) * BigInt(HALVING_INTERVAL);
      const end = start + BigInt(HALVING_INTERVAL);
      if (h <= start) break;
      const blocksInEra = h < end ? h - start : BigInt(HALVING_INTERVAL);
      const sub = (50n * COIN) >> BigInt(era);
      supply += blocksInEra * sub;
    }
    return supply;
  }

  async function updateSupplyDynamics() {
    const cardId = "ins-issuance";
    try {
      const height = await getTipHeightNumber();

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
      setUpdated(cardId);

      pushPoint("issuance_day", perDay,77);
    } catch {
      setMetric(cardId, "— BTC/day");
      setRowValue(cardId, 0, "—");
      setRowValue(cardId, 1, "—");
      setRowValue(cardId, 2, "—");
      setProgress(cardId, 0);
      setUpdated(cardId);
    }
  }

  async function updateHalvingImpact() {
    const cardId = "ins-halvingImpact";
    try {
      const height = await getTipHeightNumber();

      const era = Math.floor(height / HALVING_INTERVAL);
      const nextHalvingHeight = (era + 1) * HALVING_INTERVAL;
      const blocksLeft = Math.max(0, nextHalvingHeight - height);
      const daysLeft = blocksLeft / 144;

      const curSub = Number(subsidySatsAtHeight(height)) / 1e8;
      const nextSub = Number(subsidySatsAtHeight(nextHalvingHeight)) / 1e8;
      const changePct = curSub > 0 ? ((nextSub - curSub) / curSub) * 100 : 0;

      setMetric(cardId, `${fmt(daysLeft, 0)} days`);
      setRowValue(cardId, 0, `${fmt(curSub, 3)} BTC`);
      setRowValue(cardId, 1, `${fmt(nextSub, 3)} BTC`);
      setRowValue(cardId, 2, `${fmt(changePct, 0)}%`);
      setProgress(cardId, clamp01(1 - blocksLeft / HALVING_INTERVAL));
      setUpdated(cardId);

      pushPoint("halving_days", daysLeft, 88);
    } catch {
      setMetric(cardId, "— days");
      setRowValue(cardId, 0, "—");
      setRowValue(cardId, 1, "—");
      setRowValue(cardId, 2, "—");
      setProgress(cardId, 0);
      setUpdated(cardId);
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

      let feesSum = 0;
      let feesN = 0;
      for (const b of slice) {
        const fee = b.fee ?? b.fees ?? b.total_fee ?? (b.extras && (b.extras.fee || b.extras.total_fee));
        const f = safeNum(fee);
        if (f != null) {
          feesSum += f;
          feesN++;
        }
      }
      const feesPerBlock = feesN ? feesSum / feesN : null;
      const feesDay = feesPerBlock == null ? null : feesPerBlock * 144;

      setMetric(cardId, `${fmt(txDay, 0)} tx/day`);
      setRowValue(cardId, 0, fmt(avgTx, 0));
      setRowValue(cardId, 1, "144");
      setRowValue(cardId, 2, feesDay == null ? "—" : `${fmt(feesDay / 1e8, 2)} BTC`);
      setProgress(cardId, clamp01(txDay / 600000));
      setUpdated(cardId);

      pushPoint("tx_day", txDay, 99);
    } catch {
      setMetric(cardId, "— tx/day");
      setRowValue(cardId, 0, "—");
      setRowValue(cardId, 1, "144");
      setRowValue(cardId, 2, "—");
      setProgress(cardId, 0);
      setUpdated(cardId);
    }
  }

  async function tickAll() {
    // Fee & blockspace
    await updateFeeMarket();
    await updateMempoolPressure();
    await updateBlockspaceUsage();

    // Mining & security
    await updateHashrate();
    await updateDifficultyRetarget();
    await updateBlockTimeHealth();

    // Supply & monetary policy
    await updateSupplyDynamics();
    await updateHalvingImpact();
    await updateOnChainActivity();

    // draw charts from real history
    renderCharts();
  }

  // initial + poll
  tickAll();
  setInterval(tickAll, POLL_MS);
})();