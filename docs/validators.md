# Validators & Consensus

This document explains who produces blocks and how consensus works in your CDK Pessimistic Proof local chain.

---

## TL;DR

| Layer | Model                      | "Validators"?                      |
| ----- | -------------------------- | ---------------------------------- |
| L2    | Trusted sequencer          | ❌ Single sequencer, no validators |
| L1    | Ethereum PoS (Lighthouse)  | ✅ 128 validators                  |
| Proof | AggLayer pessimistic proof | ❌ Prover, not validator           |

---

## L2 — Trusted Sequencer Model

Your L2 does **not** use validators. It uses a single **trusted sequencer**:

```
op-el-1-op-geth + op-cl-1-op-node
```

- One node decides all blocks
- No voting, no BFT consensus among multiple validators
- The sequencer produces a block every **2 seconds** and that's final on L2
- "Trusted" means: in a local dev setup, we trust the sequencer is honest
- In production CDK, the **Pessimistic Proof** is what replaces the need for L2 validators — math replaces trust

### The 3 L2 actors

| Actor     | Service               | Role                       |
| --------- | --------------------- | -------------------------- |
| Sequencer | `op-el-1` + `op-cl-1` | Produces all L2 blocks     |
| Batcher   | `op-batcher-001`      | Posts L2 data to L1        |
| Proposer  | `op-proposer-001`     | Posts L2 state roots to L1 |

---

## L1 — 128 Lighthouse Validators

Your L1 _does_ have validators — these are Lighthouse beacon chain validators doing standard Ethereum PoS:

```bash
# Total validator count
curl -s http://127.0.0.1:57877/eth/v1/beacon/states/head/validators | jq '.data | length'
# → 128

# Status breakdown
curl -s http://127.0.0.1:57877/eth/v1/beacon/states/head/validators | jq '
{
  active:  [.data[] | select(.status == "active_ongoing")] | length,
  exiting: [.data[] | select(.status == "active_exiting")] | length,
  slashed: [.data[] | select(.status == "active_slashed")] | length,
  pending: [.data[] | select(.status == "pending_queued")] | length
}'

# All validators with balances
curl -s http://127.0.0.1:57877/eth/v1/beacon/states/head/validators | jq '
[.data[] | {
  index:       .index,
  pubkey:      .validator.pubkey,
  status:      .status,
  balance_eth: (.balance | tonumber / 1e9)
}]'

# Who proposed the latest L1 block?
curl -s http://127.0.0.1:57877/eth/v1/beacon/headers/head | jq '
{
  slot:           .data.header.message.slot,
  proposer_index: .data.header.message.proposer_index,
  block_root:     .data.root
}'

# Finality checkpoints
curl -s http://127.0.0.1:57877/eth/v1/beacon/states/head/finality_checkpoints | jq '
{
  finalized_epoch: .data.finalized.epoch,
  justified_epoch: .data.current_justified.epoch
}'
```

### Download validator keystores

```bash
kurtosis files download cdk 1-lighthouse-geth-0-127 ./validator-keys
ls ./validator-keys | wc -l   # → 128
```

All 128 validators run inside the single `vc-1-geth-lighthouse` service — not separate nodes, just 128 validator keys managed by one validator client (indices 0–127).

---

## AggLayer — The Prover (Not a Validator)

The AggLayer is a **proof generator**, not a validator:

```
L2 blocks → Sequencer → Batcher → L1
                    ↓
              AggLayer generates
              Pessimistic Proof
                    ↓
              Proof posted to L1
              (proves L2 state is valid)
```

- Reads L2 state transitions
- Generates a ZK proof that the transition is valid
- Posts proof to the `PolygonRollupManager` contract on L1
- L1 verifies the proof — no need to trust anyone

```bash
# Check AggLayer status
curl http://127.0.0.1:52205 | jq   # readRPC
curl http://127.0.0.1:52206 | jq   # admin
```

---

## Why "Pessimistic" Proof?

| Term                  | Meaning                                                                            |
| --------------------- | ---------------------------------------------------------------------------------- |
| **Optimistic rollup** | Assumes txs are valid unless challenged (7-day challenge window)                   |
| **ZK rollup**         | Proves txs are valid with a ZK proof                                               |
| **Pessimistic proof** | Proves txs are valid AND pessimistically checks worst-case cross-chain asset flows |

Pessimistic = assumes the worst case for security, proves everything mathematically, trusts nothing.
