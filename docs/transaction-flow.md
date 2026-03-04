# Transaction Flow — End to End

This document explains exactly what happens from the moment you submit a transaction until it is mathematically finalized on L1.

---

## The Simple Analogy

Think of your setup like a city with two banks:

```
L2 (your city's local bank)  →  L1 (the central/federal bank)
     fast, cheap                    slow, expensive, trusted
```

When you send a transaction, it goes through **4 stages** before it's truly final:

| Stage                     | Analogy            | Your tx       |
| ------------------------- | ------------------ | ------------- |
| You hand over a cheque    | Receiver has it    | Tx in mempool |
| Local branch logs it      | Local confirmation | Unsafe block  |
| Central bank records it   | National record    | Safe (on L1)  |
| Auditor verifies no fraud | Fraud proof done   | Finalized     |

---

## Stage 1 — You Submit the Transaction

```bash
npx hardhat run scripts/interact.ts --network l2
# or
cast send 0xContractAddress "set(uint256)" 42 --rpc-url http://127.0.0.1:50422
```

What happens:

```
Your signed transaction
        │
        │   "Hey op-geth, here's a transaction"
        ▼
  op-el-1-op-geth (:50422)
  ┌─────────────────────────────────────────┐
  │  Checks:                                │
  │  ✔ Is signature valid?                  │
  │  ✔ Does sender have enough ETH for gas? │
  │  ✔ Is nonce correct?                    │
  │                                         │
  │  Result: tx added to MEMPOOL            │
  │  (waiting room for transactions)        │
  └─────────────────────────────────────────┘
```

Your tx is just **sitting in a waiting room** at this point. Nothing has been committed yet.

---

## Stage 2 — Sequencer Builds a Block (every 2 seconds)

Every **2 seconds**, the sequencer wakes up automatically:

```
op-cl-1-op-node (:50629)
┌──────────────────────────────────────────────────┐
│                                                  │
│  "Hey op-geth, time to build a new block!"       │
│         │                                        │
│         ▼                                        │
│  op-el-1-op-geth                                 │
│  ┌────────────────────────────────────────────┐  │
│  │  1. Grabs your tx from the mempool         │  │
│  │  2. Executes it (runs the contract code)   │  │
│  │  3. Updates the state                      │  │
│  │     e.g. SimpleStorage.value = 42          │  │
│  │  4. Computes new STATE ROOT                │  │
│  │     (a hash fingerprint of entire state)   │  │
│  │  5. Seals the block                        │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘

Block #N produced ✓
Your tx is now CONFIRMED on L2 → "UNSAFE"
```

**"Unsafe" means:** L2 says your tx is done, but L1 doesn't know yet. The sequencer _could_ theoretically lie or crash at this point.

```bash
# Verify immediately after tx
cast receipt <txHash> --rpc-url http://127.0.0.1:50422

# See the latest (unsafe) block
cast block latest --rpc-url http://127.0.0.1:50422 | grep -E "number|hash"
```

---

## Stage 3 — Batcher Compresses and Posts to L1

The `op-batcher` runs continuously in the background:

```
op-batcher-001 (:58456)
┌──────────────────────────────────────────────────────┐
│                                                      │
│  Watches L2 for new blocks...                        │
│                                                      │
│  Collects: Block #N-2, #N-1, #N (your tx) ...        │
│                                                      │
│  Compresses them into a BATCH                        │
│  (like zipping multiple files into one .zip)         │
│                                                      │
│  Posts the batch as a TRANSACTION on L1:             │
│   → sent to el-1-geth (:57872)                       │
│   → stored as calldata or EIP-4844 blob              │
│                                                      │
└──────────────────────────────────────────────────────┘

Once this L1 tx is mined:
  → Your L2 tx is now "SAFE"
  → Anyone can reconstruct L2 state from L1 data alone
  → Even if the sequencer disappears, your tx is preserved forever
```

```bash
# See the gap between latest vs safe
cast block latest --rpc-url http://127.0.0.1:50422 | grep number
cast block safe   --rpc-url http://127.0.0.1:50422 | grep number
# safe will lag behind latest — that's the batcher delay (~30-60 blocks)
```

---

## Stage 4 — Proposer Posts the State Root to L1

```
op-proposer-001 (:58646)
┌──────────────────────────────────────────────────────┐
│                                                      │
│  Reads L2 state root at block #N                     │
│  (state root = hash fingerprint of ALL state:        │
│   balances, contract storage, nonces, etc.)          │
│                                                      │
│  Posts to L1 contract (L2OutputOracle):              │
│  "At L2 block #N, the state root is 0xABC..."        │
│                                                      │
└──────────────────────────────────────────────────────┘

This enables:
  → L2 → L1 withdrawals (bridge out)
  → Anyone to independently verify L2 state
```

---

## Stage 5 — AggLayer Generates the Pessimistic Proof

This is the **CDK-specific step** — unique to your setup vs plain OP-stack:

```
AggLayer (:52205)
┌──────────────────────────────────────────────────────┐
│                                                      │
│  Gets the L2 state transition:                       │
│  "State was X before block #N"                       │
│  "State is  Y after  block #N"                       │
│                                                      │
│  Generates a PESSIMISTIC PROOF:                      │
│                                                      │
│  "I mathematically prove that:                       │
│   - Every tx in block #N was valid                   │
│   - No tokens were created from thin air             │
│   - The state transition X → Y is correct"           │
│                                                      │
│  Why "pessimistic"?                                  │
│  Assumes the WORST CASE — checks everything,         │
│  trusts nothing, proves everything cryptographically │
│                                                      │
│  Posts proof → PolygonRollupManager on L1            │
│                                                      │
└──────────────────────────────────────────────────────┘

Once proof is verified on L1:
  → Your tx is FINALIZED
  → Mathematically impossible to reverse
```

```bash
# Check AggLayer status
curl http://127.0.0.1:52205 | jq
curl http://127.0.0.1:52206 | jq
```

---

## Full Pipeline Summary

```
YOU
 │
 │ send tx
 ▼
MEMPOOL ─────────────────────────── waiting room
 │
 │ every 2 seconds
 ▼
L2 BLOCK SEALED ─────────────────── UNSAFE ✓
 │                                   L2 knows, L1 doesn't
 │ op-batcher collects + posts
 ▼
L1 BATCH POSTED ─────────────────── SAFE ✓✓
 │                                   L1 has the raw data
 │ op-proposer posts state root
 ▼
STATE ROOT ON L1 ────────────────── WITHDRAWABLE ✓✓✓
 │                                   can bridge back to L1
 │ AggLayer proves it
 ▼
PESSIMISTIC PROOF ON L1 ──────────── FINALIZED ✓✓✓✓
                                     mathematically proven
```

---

## Confirmation Timelines

```
0s     ── You send tx
2s     ── Block sealed              → UNSAFE   (readable immediately)
~60s   ── Batcher posts to L1       → SAFE
~5min  ── Proposer posts state root → WITHDRAWABLE
~10min ── AggLayer proof verified   → FINALIZED
```

---

## Watch All 3 Stages Live

```bash
watch -n 2 'echo "=== Block Stages ===" && \
  echo "LATEST   (unsafe)  : $(cast block latest    --rpc-url http://127.0.0.1:50422 2>/dev/null | grep "^number" | awk "{print \$2}")" && \
  echo "SAFE               : $(cast block safe       --rpc-url http://127.0.0.1:50422 2>/dev/null | grep "^number" | awk "{print \$2}")" && \
  echo "FINALIZED          : $(cast block finalized  --rpc-url http://127.0.0.1:50422 2>/dev/null | grep "^number" | awk "{print \$2}")"'
```

The gap between `latest` and `finalized` is your pipeline in action.

---

## What Each Service Does 24/7

| Service       | Role                                            |
| ------------- | ----------------------------------------------- |
| `op-geth`     | Executes txs, maintains state, serves RPC       |
| `op-node`     | Every 2s: "build a block!" (the heartbeat)      |
| `op-batcher`  | Every ~1min: zips L2 blocks, posts to L1        |
| `op-proposer` | Every few mins: posts L2 state root to L1       |
| `agglayer`    | Continuously: generates ZK proofs, posts to L1  |
| `op-el-2`     | Follows op-el-1, stays in sync (backup/replica) |
| `lighthouse`  | 128 validators finalizing L1 blocks (PoS)       |
