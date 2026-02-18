// ChainAtlasOne Insights (Phase 1)
// 9 modules, grouped into 3 sections. Values are placeholders for now.
// Next step: wire live data sources (mempool.space + derived metrics).

window.INSIGHTS = {
  fees: [
    {
      id: "fees",
      title: "Fee Market",
      tag: "LIVE",
      metric: "— sat/vB",
      sub: "Recommended fees and current pressure.",
      viz: { kind: "spark", seed: 1 },
      rows: [
        ["Fast / Hour / Economy", "— / — / —"],
        ["Mempool size", "—"],
        ["Blocks to clear", "—"]
      ],
      progress: { label: "Pressure", value: 0.0 },
      learnHref: "/learn/lesson.html?id=FEE_MARKET"
    },
    {
      id: "pressure",
      title: "Mempool Pressure",
      tag: "LIVE",
      metric: "— MB",
      sub: "How congested the mempool is right now.",
      viz: { kind: "bars", seed: 2 },
      rows: [
        ["vsize (virtual)", "— vMB"],
        ["1h change", "—"],
        ["Congestion index", "—"]
      ],
      progress: { label: "Congestion", value: 0.0 },
      learnHref: "/learn/lesson.html?id=MEMPOOL"
    },
    {
      id: "blockspace",
      title: "Blockspace Usage",
      tag: "LIVE",
      metric: "— %",
      sub: "How full blocks are and what demand looks like.",
      viz: { kind: "spark", seed: 3 },
      rows: [
        ["Avg block fill", "—"],
        ["Avg fees / block", "—"],
        ["Tx / block (avg)", "—"]
      ],
      progress: { label: "Utilization", value: 0.0 },
      learnHref: "/learn/lesson.html?id=BLOCKSPACE"
    }
  ],
  security: [
    {
      id: "hashrate",
      title: "Hashrate",
      tag: "LIVE",
      metric: "— EH/s",
      sub: "A proxy for network security.",
      viz: { kind: "spark", seed: 4 },
      rows: [
        ["7D avg", "—"],
        ["30D avg", "—"],
        ["Trend", "—"]
      ],
      progress: { label: "Momentum", value: 0.0 },
      learnHref: "/learn/lesson.html?id=HASHRATE"
    },
    {
      id: "difficulty",
      title: "Difficulty & Retarget",
      tag: "LIVE",
      metric: "— blocks",
      sub: "Countdown to the next difficulty adjustment.",
      viz: { kind: "ring", seed: 5 },
      rows: [
        ["Difficulty", "—"],
        ["Progress", "—%"],
        ["Estimated date", "—"]
      ],
      progress: { label: "Epoch progress", value: 0.0 },
      learnHref: "/learn/lesson.html?id=DIFFICULTY"
    },
    {
      id: "blocktime",
      title: "Block Time Health",
      tag: "LIVE",
      metric: "— min",
      sub: "How close block times are to the 10-minute target.",
      viz: { kind: "spark", seed: 6 },
      rows: [
        ["Last 144 blocks", "—"],
        ["Ahead / behind", "—"],
        ["Target", "10.0 min"]
      ],
      progress: { label: "Stability", value: 0.0 },
      learnHref: "/learn/lesson.html?id=BLOCKTIME"
    }
  ],
  supply: [
    {
      id: "issuance",
      title: "Supply Dynamics",
      tag: "LIVE",
      metric: "— BTC/day",
      sub: "Issuance and inflation, derived from protocol rules.",
      viz: { kind: "spark", seed: 7 },
      rows: [
        ["Annual inflation", "—"],
        ["Issued / year", "—"],
        ["Remaining to 21M", "—"]
      ],
      progress: { label: "Supply mined", value: 0.0 },
      learnHref: "/learn/lesson.html?id=SUPPLY"
    },
    {
      id: "halvingImpact",
      title: "Halving Impact",
      tag: "LIVE",
      metric: "— days",
      sub: "What changes when the subsidy is cut in half.",
      viz: { kind: "ring", seed: 8 },
      rows: [
        ["Current subsidy", "— BTC"],
        ["Next subsidy", "— BTC"],
        ["Issuance change", "—%"]
      ],
      progress: { label: "To next halving", value: 0.0 },
      learnHref: "/learn/lesson.html?id=HALVING"
    },
    {
      id: "activity",
      title: "On-chain Activity",
      tag: "LIVE",
      metric: "— tx/day",
      sub: "A lightweight view on transaction throughput.",
      viz: { kind: "bars", seed: 9 },
      rows: [
        ["Tx / block (avg)", "—"],
        ["Blocks / day", "144"],
        ["Fees / day (est.)", "—"]
      ],
      progress: { label: "Throughput", value: 0.0 },
      learnHref: "/learn/lesson.html?id=ACTIVITY"
    }
  ]
};
