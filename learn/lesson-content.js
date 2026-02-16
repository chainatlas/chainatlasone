export const LESSON_CONTENT = {
  "foundations-what-is-bitcoin": {
    intro:
      "Bitcoin is a digital monetary network. It lets people send value globally without needing a central operator to approve transactions.",
    bullets: [
      "Bitcoin is not a company. It is software + a network of independent nodes.",
      "Scarcity is enforced by rules (21M cap) that anyone can verify.",
      "Ownership is controlled by keys: whoever controls the private key controls the coins.",
      "Transactions are public, but identities are not built into the protocol."
    ],
    example:
      "Think of Bitcoin like a public rulebook for money. Anyone can join, verify the rules, and send value—no special permissions required."
  },

  "foundations-blockchain-basics": {
    intro:
      "A blockchain is a history of blocks. Each block contains transactions and references the previous block, forming a verifiable chain.",
    bullets: [
      "Blocks are batches of transactions.",
      "Each block references the previous block, making history hard to rewrite.",
      "Nodes verify blocks and transactions using consensus rules.",
      "The chain with the most accumulated work becomes the accepted history."
    ],
    example:
      "If someone tries to change an old transaction, they would need to redo enormous work and convince the network—practically impossible at scale."
  },

  "how-transactions-work": {
    intro:
      "Bitcoin uses the UTXO model: transactions spend old outputs and create new outputs.",
    bullets: [
      "Inputs spend previous outputs (UTXOs). Outputs define who can spend next.",
      "Fees are not explicit fields; fees = inputs minus outputs.",
      "Higher fee rates generally get confirmed faster.",
      "A TXID identifies a transaction, but details can be explored publicly."
    ],
    example:
      "If you spend 0.010 BTC and your inputs total 0.0102 BTC, the remaining 0.0002 BTC becomes change + fee (depending on the outputs)."
  },

  "mempool-and-fees": {
    intro:
      "The mempool is the waiting room for valid transactions that are not yet confirmed in a block.",
    bullets: [
      "When blocks are full, transactions compete on fee rate (sat/vB).",
      "A spike in demand can raise fees quickly.",
      "Wallets estimate fees, but it’s always a market.",
      "Watching the mempool helps you understand real confirmation delays."
    ],
    example:
      "During congestion, a low-fee transaction can wait longer until demand drops or blocks clear the backlog."
  },

  "blocks-and-confirmations": {
    intro:
      "A transaction is ‘confirmed’ when it is included in a mined block. Each new block after that adds another confirmation.",
    bullets: [
      "1 confirmation = included in one block.",
      "More confirmations reduce the chance of a reorg affecting your transaction.",
      "For small amounts, fewer confirmations may be acceptable; for larger amounts, wait longer.",
      "Finality is probabilistic in Proof-of-Work systems."
    ],
    example:
      "For higher-value transfers, many services wait 3–6 confirmations to reduce reorg risk."
  },

  "mining-plain-english": {
    intro:
      "Mining is how Bitcoin selects the next block producer while making it costly to rewrite history.",
    bullets: [
      "Miners perform Proof-of-Work to propose blocks.",
      "Difficulty adjusts to target ~10 minutes per block on average.",
      "Mining secures the chain by making attacks expensive.",
      "Miners earn block subsidy + transaction fees."
    ],
    example:
      "If more miners join, blocks would come faster—so difficulty rises to keep the schedule stable."
  },

  "supply-and-halving": {
    intro:
      "Bitcoin’s issuance is predictable. The block subsidy halves every 210,000 blocks, slowing new supply over time.",
    bullets: [
      "New BTC enters through the block reward (subsidy).",
      "Halvings reduce new issuance by 50% each epoch.",
      "Fees matter more as subsidy declines.",
      "Total supply approaches 21 million asymptotically."
    ],
    example:
      "After the next halving, the block reward drops, changing miners’ revenue mix (subsidy vs fees)."
  },

  "self-custody-basics": {
    intro:
      "Self-custody means you control the keys. Exchanges hold keys on your behalf (custodial).",
    bullets: [
      "A seed phrase is a backup of your wallet keys—protect it like cash.",
      "Never share your seed phrase. No support agent will ever need it.",
      "Hardware wallets reduce attack surface compared to hot wallets.",
      "Use test transactions before sending large amounts."
    ],
    example:
      "A safe workflow: set up wallet → write seed offline → receive a small amount → send a small test → then move larger funds."
  },

  "safety-and-scams": {
    intro:
      "Most Bitcoin losses come from scams or poor backup practices—not from the protocol itself.",
    bullets: [
      "Avoid phishing: verify domains and never enter seed phrases online.",
      "Backups: store your seed phrase securely in multiple safe locations.",
      "Plan for inheritance: document instructions safely.",
      "Use strong device security and keep software updated."
    ],
    example:
      "If someone asks for your seed phrase ‘to verify your wallet’, it’s always a scam—no exceptions."
  }
};
