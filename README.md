# CDK Pessimistic Proof — Local Chain Guide

> A complete guide to deploying smart contracts and understanding the end-to-end transaction flow on a **Polygon CDK Pessimistic Proof** local chain using **Kurtosis** + **Hardhat v3**.

---

## Table of Contents

- [Overview](#overview)
- [Stack Architecture](#stack-architecture)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Chain Configuration](#chain-configuration)
- [Contracts](#contracts)
- [Scripts](#scripts)
- [Transaction Flow](#transaction-flow)
- [Validators & Consensus](#validators--consensus)
- [Customization](#customization)
- [Useful Commands](#useful-commands)

---

## Overview

This repo demonstrates how to:

1. Connect to a locally running **CDK Pessimistic Proof** chain (via Kurtosis)
2. Deploy smart contracts using **Hardhat v3 Ignition**
3. Interact with deployed contracts
4. Understand the full **L2 → L1 finality** pipeline
5. Customize your local chain

### Kurtosis Services (from your running enclave)

| Service                | URL                      | Description                 |
| ---------------------- | ------------------------ | --------------------------- |
| L1 el-1-geth           | `http://127.0.0.1:57872` | L1 execution layer          |
| L2 op-el-1 (primary)   | `http://127.0.0.1:50422` | L2 sequencer (deploy here)  |
| L2 op-el-2 (secondary) | `http://127.0.0.1:50689` | L2 replica node             |
| L2 op-cl-1 (op-node)   | `http://127.0.0.1:50629` | L2 consensus layer          |
| AggLayer readRPC       | `http://127.0.0.1:52205` | Pessimistic proof RPC       |
| AggLayer admin         | `http://127.0.0.1:52206` | AggLayer admin API          |
| AggLayer dashboard     | `http://127.0.0.1:52449` | Visual dashboard            |
| aggkit-001 RPC         | `http://127.0.0.1:60755` | AggKit RPC                  |
| aggkit-bridge REST     | `http://127.0.0.1:60825` | Bridge REST API             |
| bridge-service RPC     | `http://127.0.0.1:60952` | zkEVM bridge service        |
| op-batcher             | `http://127.0.0.1:58456` | Batches L2 blocks to L1     |
| op-proposer            | `http://127.0.0.1:58646` | Posts state roots to L1     |
| proxyd                 | `http://127.0.0.1:58703` | RPC proxy                   |
| contracts-001          | `http://127.0.0.1:50686` | Deployed contract addresses |
| L1 Lighthouse beacon   | `http://127.0.0.1:57877` | L1 beacon chain             |

---

## Stack Architecture

```
Your Wallet / Hardhat
        │
        │  signed tx
        ▼
┌─────────────────┐
│   op-el-1       │  ← op-geth (execution layer)
│   :50422        │    validates tx, adds to mempool
└────────┬────────┘
         │
         │  engine API (every 2 seconds)
         ▼
┌─────────────────┐
│   op-cl-1       │  ← op-node (consensus layer)
│   :50629        │    drives block building
└────────┬────────┘
         │
         │  sealed block
         ▼
┌─────────────────┐
│   op-el-1       │  ← block executed, state updated
│   (state root)  │    tx is now "unsafe" confirmed
└────────┬────────┘
         │
    ┌────┴──────────────────────────┐
    │                               │
    ▼                               ▼
┌──────────┐                ┌──────────────┐
│ op-el-2  │                │  op-batcher  │
│ :50689   │                │  :58456      │
│ (replica)│                │ posts batch  │
└──────────┘                │ to L1        │
                            └──────┬───────┘
                                   │
                                   ▼
                         ┌──────────────────┐
                         │   L1 el-1-geth   │
                         │   :57872         │
                         │ batch stored     │
                         └────────┬─────────┘
                                  │
                     ┌────────────┴─────────────┐
                     │                          │
                     ▼                          ▼
           ┌──────────────────┐     ┌───────────────────┐
           │  op-proposer     │     │    AggLayer        │
           │  :58646          │     │    :52205          │
           │ posts state root │     │ Pessimistic Proof  │
           │ to L1            │     │ → verified on L1   │
           └──────────────────┘     └───────────────────┘
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Kurtosis CLI](https://docs.kurtosis.com/install)
- [Foundry](https://getfoundry.sh/) (for `cast` commands)
- A running CDK Pessimistic Proof enclave:

```bash
kurtosis run github.com/0xPolygon/kurtosis-cdk --enclave cdk
```

---

## Project Structure

```
cdk-local-chain-guide/
├── contracts/
│   └── SimpleStorage.sol        # Simple storage contract
├── ignition/
│   └── modules/
│       └── SimpleStorage.ts     # Hardhat Ignition deploy module
├── scripts/
│   └── checkChain.ts            # Chain health + contract verification
├── docs/
│   ├── transaction-flow.md      # Detailed tx flow explanation
│   ├── validators.md            # Validator / consensus explanation
│   └── customization.md        # How to customize your local chain
├── hardhat.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Verify chain IDs match your kurtosis enclave
cast chain-id --rpc-url http://127.0.0.1:57872   # L1 (expect: 3151908)
cast chain-id --rpc-url http://127.0.0.1:50422   # L2 (expect: 2151908)

# 3. Check chain health + all service status
npx hardhat run scripts/checkChain.ts --network l2

# 4. Compile contracts
npx hardhat compile

# 5. Deploy to L2
npx hardhat ignition deploy ignition/modules/SimpleStorage.ts --network l2

# 6. Run checkChain again — now it reads + interacts with deployed contract
npx hardhat run scripts/checkChain.ts --network l2
```

---

## Chain Configuration

See [`hardhat.config.ts`](./hardhat.config.ts).

> ⚠️ **Chain IDs**: Always verify before deploying:
>
> ```bash
> cast chain-id --rpc-url http://127.0.0.1:57872   # L1
> cast chain-id --rpc-url http://127.0.0.1:50422   # L2
> ```

### Custom deployer key

```bash
export PRIVATE_KEY=0xYourPrivateKey
npx hardhat ignition deploy ignition/modules/SimpleStorage.ts --network l2
```

### Finding your funded key

```bash
# Check pre-funded accounts from kurtosis genesis
kurtosis files download cdk el_cl_genesis_data ./genesis-data
cat ./genesis-data/genesis.json | grep -A5 "alloc"

# Check deployer keystores
kurtosis files download cdk deploy_parameters.json ./
cat ./deploy_parameters.json | grep -i "deployer\|private\|key"
```

---

## Contracts

### SimpleStorage.sol

A minimal contract — perfect for verifying a chain is alive and accepting transactions.

```solidity
// Store a value
function set(uint256 _value) external;

// Read the value
function get() external view returns (uint256);
```

**Deploy:**

```bash
npx hardhat ignition deploy ignition/modules/SimpleStorage.ts --network l2

# With custom initial value
npx hardhat ignition deploy ignition/modules/SimpleStorage.ts \
  --network l2 \
  --parameters '{"SimpleStorageModule": {"initialValue": 100}}'
```

---

## Scripts

### checkChain.ts

Comprehensive chain health check. Probes all 15 kurtosis services and interacts with the deployed contract.

```bash
npx hardhat run scripts/checkChain.ts --network l2
```

**Output includes:**

- Chain ID, latest block, block timestamp, gas limit, base fee
- Signer address, balance, nonce
- Status of all 15 kurtosis services (✔/✘)
- If SimpleStorage is deployed: reads value, sends `set(999)` tx, shows receipt

---

## Transaction Flow

See [`docs/transaction-flow.md`](./docs/transaction-flow.md) for the full explanation.

### Confirmation stages

| Stage         | Trigger                 | Latency    | Meaning                       |
| ------------- | ----------------------- | ---------- | ----------------------------- |
| **Unsafe**    | Sequencer seals block   | ~2 sec     | Tx in L2 block, not on L1 yet |
| **Safe**      | Batcher posts to L1     | ~1–2 min   | L2 data permanently on L1     |
| **Finalized** | AggLayer proof verified | ~10–30 min | Mathematically proven         |

### Watch all 3 stages live

```bash
watch -n 2 'echo "=== Block Stages ===" && \
  echo "LATEST   (unsafe)  : $(cast block latest    --rpc-url http://127.0.0.1:50422 2>/dev/null | grep "^number" | awk "{print \$2}")" && \
  echo "SAFE               : $(cast block safe       --rpc-url http://127.0.0.1:50422 2>/dev/null | grep "^number" | awk "{print \$2}")" && \
  echo "FINALIZED          : $(cast block finalized  --rpc-url http://127.0.0.1:50422 2>/dev/null | grep "^number" | awk "{print \$2}")"'
```

---

## Validators & Consensus

See [`docs/validators.md`](./docs/validators.md) for the full explanation.

### TL;DR

Your L2 uses a **trusted sequencer model** — no validators on L2. Your L1 has **128 Lighthouse validators** doing PoS consensus.

```bash
# Check L1 validator count
curl -s http://127.0.0.1:57877/eth/v1/beacon/states/head/validators | jq '.data | length'

# Check validator status breakdown
curl -s http://127.0.0.1:57877/eth/v1/beacon/states/head/validators | jq '
{
  active:  [.data[] | select(.status == "active_ongoing")] | length,
  slashed: [.data[] | select(.status == "active_slashed")] | length,
  pending: [.data[] | select(.status == "pending_queued")] | length
}'

# Who proposed the latest L1 block?
curl -s http://127.0.0.1:57877/eth/v1/beacon/headers/head | jq '
{
  slot:           .data.header.message.slot,
  proposer_index: .data.header.message.proposer_index
}'
```

---

## Customization

See [`docs/customization.md`](./docs/customization.md) for full details.

### Common customizations

| What                | Where                               | Restart? |
| ------------------- | ----------------------------------- | -------- |
| Block time          | `input_args.json` → `l2_block_time` | ✅ Yes   |
| Chain ID            | `input_args.json` → `l2_chain_id`   | ✅ Yes   |
| Gas limit           | `input_args.json` → `gas_limit`     | ✅ Yes   |
| Pre-fund address    | `genesis.json` → `alloc`            | ✅ Yes   |
| Send ETH to address | `cast send`                         | ❌ No    |
| Deploy new contract | Hardhat / cast                      | ❌ No    |

### Edit and restart

```bash
# Download current args
kurtosis files download cdk input_args.json ./

# Edit as needed
nano input_args.json

# Wipe and redeploy (~3–5 min)
kurtosis clean -a
kurtosis run github.com/0xPolygon/kurtosis-cdk \
  --enclave cdk \
  --args-file input_args.json
```

---

## Useful Commands

```bash
# ── Chain info ────────────────────────────────────────────────
cast chain-id     --rpc-url http://127.0.0.1:50422
cast block-number --rpc-url http://127.0.0.1:50422
cast base-fee     --rpc-url http://127.0.0.1:50422

# ── Account info ──────────────────────────────────────────────
cast balance  <address> --rpc-url http://127.0.0.1:50422
cast nonce    <address> --rpc-url http://127.0.0.1:50422

# ── Send ETH ──────────────────────────────────────────────────
cast send <recipient> --value 1ether \
  --rpc-url http://127.0.0.1:50422 \
  --private-key $PRIVATE_KEY

# ── Call a contract ───────────────────────────────────────────
cast call <contract> "get()(uint256)" --rpc-url http://127.0.0.1:50422

# ── Send a contract tx ────────────────────────────────────────
cast send <contract> "set(uint256)" 42 \
  --rpc-url http://127.0.0.1:50422 \
  --private-key $PRIVATE_KEY

# ── Block finality stages ─────────────────────────────────────
cast block latest    --rpc-url http://127.0.0.1:50422 | grep number
cast block safe      --rpc-url http://127.0.0.1:50422 | grep number
cast block finalized --rpc-url http://127.0.0.1:50422 | grep number

# ── AggLayer status ───────────────────────────────────────────
curl http://127.0.0.1:52205 | jq
curl http://127.0.0.1:52206 | jq

# ── Kurtosis enclave management ───────────────────────────────
kurtosis enclave ls
kurtosis enclave inspect cdk
kurtosis service logs cdk op-el-1-op-geth-op-node-001
kurtosis service logs cdk agglayer
kurtosis clean -a    # wipe everything
```

---

## Why blocks keep incrementing

Your L2 produces a **new block every 2 seconds** regardless of transactions. This is normal OP-stack behavior — the op-node drives continuous block production to stay in sync with L1. Empty blocks (zero txs, zero gas used) are expected.

```bash
# Verify empty block production
cast block latest --rpc-url http://127.0.0.1:50422 | grep -E "transactions|gasUsed"
```

---

## License

MIT
