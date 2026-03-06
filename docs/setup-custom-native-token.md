# Custom Native Gas Token on Polygon CDK — Detailed Flow

This document explains the complete architecture and flow of how a custom ERC-20 token becomes the native gas currency on a local Polygon CDK L2 chain.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        KURTOSIS ENCLAVE                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    L1 (Internal Geth)                   │   │
│  │   Chain ID: 271828                                      │   │
│  │   RPC: http://127.0.0.1:59715                           │   │
│  │                                                         │   │
│  │   ┌─────────────────────────────────────────────────┐  │   │
│  │   │  MyCustomToken (ERC-20)                         │  │   │
│  │   │  Address: 0xe02298993b76cb23AcAc6bAE213a466a... │  │   │
│  │   │  Supply: 1,000,000,000 tokens                   │  │   │
│  │   │  Role: Bridgeable ERC-20 on L1                  │  │   │
│  │   └─────────────────────────────────────────────────┘  │   │
│  │                                                         │   │
│  │   ┌─────────────────────────────────────────────────┐  │   │
│  │   │  RollupManager Contract                         │  │   │
│  │   │  AggLayer Contracts                             │  │   │
│  │   │  Bridge Contract                                │  │   │
│  │   └─────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                    Bridge Protocol                              │
│                    (Lock on L1 →                               │
│                     Mint on L2)                                 │
│                           │                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    L2 (CDK Erigon)                      │   │
│  │   Chain ID: 2151908                                     │   │
│  │   RPC: http://127.0.0.1:50199                           │   │
│  │                                                         │   │
│  │   MyCustomToken = NATIVE CURRENCY                       │   │
│  │   (displayed as "ETH" in wallets but is actually MGT)   │   │
│  │                                                         │   │
│  │   Every transaction pays gas in MGT tokens              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. L1 — Internal Geth Node (`el-1-geth-lighthouse`)

| Property              | Value                              |
| --------------------- | ---------------------------------- |
| Chain ID              | 271828                             |
| RPC (host)            | `http://127.0.0.1:59715`           |
| RPC (internal Docker) | `http://el-1-geth-lighthouse:8545` |
| Consensus             | Lighthouse                         |
| Role                  | Settlement layer for L2            |

This is a full Ethereum-compatible PoS chain running inside kurtosis. All CDK contracts (RollupManager, Bridge, AggLayer) are deployed here. It acts as the **settlement layer** — L2 state roots are posted here and fraud/validity proofs are verified here.

---

### 2. MyCustomToken — ERC-20 on L1

| Property     | Value                                        |
| ------------ | -------------------------------------------- |
| Address      | `0xe02298993b76cb23AcAc6bAE213a466a1eF414ba` |
| Name         | My Gas Token (or your custom name)           |
| Symbol       | MGT (or your custom symbol)                  |
| Total Supply | 1,000,000,000 tokens                         |
| Holder       | `0xE34aaF64b29273B7D567FCFc40544c014EEe9970` |
| Network      | L1                                           |

This token was deployed **before** the CDK contracts. When kurtosis read `gas_token_address` from `params-stage2.yml`, it registered this token as the official gas token for the L2 rollup. The CDK bridge uses this token as the backing asset for L2's native currency.

---

### 3. L2 — CDK Erigon (`cdk-erigon-rpc-001`)

| Property         | Value                    |
| ---------------- | ------------------------ |
| Chain ID         | 2151908                  |
| RPC (host)       | `http://127.0.0.1:50199` |
| Sequencer RPC    | `http://127.0.0.1:50190` |
| WS RPC           | `ws://127.0.0.1:50201`   |
| Native currency  | MyCustomToken (MGT)      |
| Transaction type | Legacy (no EIP-1559)     |

On L2, MGT is the **native currency** — just like ETH on Ethereum mainnet. Every transaction (deploying contracts, sending tokens, calling functions) consumes MGT as gas fees.

---

## Deployment Flow

### Stage 1 — Deploy Internal L1 Only

```
params-stage1.yml
    deploy_l1: true
    everything else: false
          │
          ▼
kurtosis spins up:
  - el-1-geth-lighthouse (L1 Geth node)
  - cl-1-lighthouse-geth (Consensus layer)
  - vc-1-geth-lighthouse (Validator)
          │
          ▼
L1 is running at 127.0.0.1:59715
```

**Why stage separately?**
We need the L1 to exist before deploying MyToken on it. If we deployed everything at once, there would be no L1 to deploy the token to.

---

### Stage 2 — Deploy MyCustomToken on L1

```
Hardhat project (MyCustomToken.sol)
    constructor(name, symbol, initialOwner, initialSupply)
          │
          ▼
Deploy to L1 (127.0.0.1:59715)
          │
          ▼
MyCustomToken deployed at:
0xe02298993b76cb23AcAc6bAE213a466a1eF414ba
          │
          ▼
1,000,000,000 MGT minted to:
0xE34aaF64b29273B7D567FCFc40544c014EEe9970
```

**Why deploy before CDK contracts?**
The RollupManager contract on L1 needs to know the gas token address at deployment time. It stores this address and uses it to configure the bridge. If the token doesn't exist yet, deployment fails.

---

### Stage 3 — Deploy Full CDK Stack

```
params-stage2.yml
    deploy_l1: false              ← skip, already done
    gas_token_address: 0xe022...  ← our token
    l1_rpc_url: el-1-geth-lighthouse:8545
          │
          ▼
kurtosis deploys CDK contracts on L1:
  - PolygonRollupManager
  - PolygonZkEVMBridgeV2
  - AggLayer contracts
  - Registers MyCustomToken as gas token
          │
          ▼
kurtosis creates L2 genesis:
  - Sets MGT as native currency
  - Pre-funds deployer address with MGT on L2
          │
          ▼
kurtosis spins up L2 services:
  - cdk-erigon-sequencer-001
  - cdk-erigon-rpc-001
  - cdk-node-001
  - zkevm-prover-001
  - zkevm-bridge-service-001
  - agglayer
  - postgres-001
```

---

## Transaction Flow on L2

### Deploying a Smart Contract

```
User (0xE34aaF64...)
    │
    │  Deploy SimpleStorage.sol
    │  Gas paid in MGT (native token)
    ▼
cdk-erigon-sequencer-001
    │  Sequences the transaction
    │  Builds a batch
    ▼
zkevm-prover-001
    │  Generates ZK proof for the batch
    ▼
cdk-node-001 (aggregator)
    │  Submits proof + state root to L1
    ▼
PolygonRollupManager (L1 contract)
    │  Verifies the proof
    │  Updates L2 state root on L1
    ▼
SimpleStorage deployed on L2 ✅
```

### Calling a Contract Function

```
cast send SimpleStorage "set(uint256)" 45 --legacy
    │
    ▼
L2 RPC (cdk-erigon-rpc-001)
    │  Receives transaction
    │  Forwards to sequencer
    ▼
cdk-erigon-sequencer-001
    │  Includes in next batch
    │  Deducts MGT gas fee from sender
    ▼
State updated: stored value = 45 ✅
```

**Note:** `--legacy` flag is required because CDK Erigon does not support EIP-1559 transactions.

---

## Key Services and Their Roles

| Service                        | Port  | Role                                       |
| ------------------------------ | ----- | ------------------------------------------ |
| `el-1-geth-lighthouse`         | 59715 | L1 execution layer                         |
| `cl-1-lighthouse-geth`         | 59720 | L1 consensus layer                         |
| `contracts-001`                | 58644 | Serves deployed contract ABIs/addresses    |
| `cdk-erigon-sequencer-001`     | 50190 | Sequences L2 transactions into batches     |
| `cdk-erigon-rpc-001`           | 50199 | L2 RPC endpoint for users/dApps            |
| `cdk-node-001`                 | 50203 | Aggregator — submits proofs to L1          |
| `zkevm-prover-001`             | 50206 | Generates ZK proofs for batches            |
| `zkevm-stateless-executor-001` | 50187 | Executes transactions for proof generation |
| `zkevm-bridge-service-001`     | 63958 | Handles L1↔L2 token bridging               |
| `zkevm-pool-manager-001`       | 50197 | Manages transaction pool                   |
| `agglayer`                     | 50183 | Aggregates proofs across chains            |
| `postgres-001`                 | 50180 | Stores L2 state, transactions, proofs      |

---

## Gas Token on L1 vs L2

```
L1 (Chain ID: 271828)                L2 (Chain ID: 2151908)
─────────────────────                ──────────────────────
MyCustomToken = ERC-20               MyCustomToken = NATIVE CURRENCY
  - Standard token contract            - No contract needed
  - Transfer via approve/transferFrom  - Transfer via regular tx value
  - Balance: balanceOf()               - Balance: eth_getBalance()
  - Used for: bridging to L2           - Used for: paying gas fees
  - Gas paid in: ETH (L1 native)       - Gas paid in: MGT (L2 native)
```

### What "native currency" means on L2:

- When you check `cast balance <address> --rpc-url <L2>`, it returns MGT balance
- When you deploy a contract, gas is deducted in MGT
- Wallets show MGT balance where they would normally show ETH
- `msg.value` in Solidity refers to MGT on L2

---

## Key Addresses

> ⚠️ Local test keys only — never use on mainnet

| Role             | Address                                      | Private Key                                                          |
| ---------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| Deployer / Owner | `0xE34aaF64b29273B7D567FCFc40544c014EEe9970` | `0x12d7de8621a77640c9241b2595ba78ce443d05e94090365ab3bb5e19df82c625` |
| Sequencer        | `0x5b06837A43bdC3dD9F114558DAf4B26ed49842Ed` | `0x183c492d0ba156041a7f31a1b188958a7a22eebadca741a7fe64436092dc3181` |
| Aggregator       | `0xCae5b68Ff783594bDe1b93cdE627c741722c4D4d` | `0x2857ca0e7748448f3a50469f7ffe55cde7299d5696aedd72cfe18a06fb856970` |
| Mnemonic account | `0x8943545177806ED17B9F23F0a21ee5948eCaa776` | mnemonic: `giant issue aisle success...`                             |

---

## Hardhat Configuration

```typescript
// hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    l1: {
      url: "http://127.0.0.1:59715", // Internal kurtosis L1
      chainId: 271828,
      accounts: [
        "0x12d7de8621a77640c9241b2595ba78ce443d05e94090365ab3bb5e19df82c625",
      ],
    },
    l2: {
      url: "http://127.0.0.1:50199", // CDK Erigon RPC
      chainId: 2151908,
      accounts: [
        "0x12d7de8621a77640c9241b2595ba78ce443d05e94090365ab3bb5e19df82c625",
      ],
    },
  },
};

export default config;
```

> **Important:** Always use `--legacy` for L2 transactions — CDK Erigon does not support EIP-1559.

---

## params.yml Files

### params-stage1.yml — L1 only

```yaml
deployment_stages:
  deploy_l1: true
  deploy_agglayer_contracts_on_l1: false
  deploy_databases: false
  deploy_cdk_central_environment: false
  deploy_cdk_bridge_infra: false
  deploy_agglayer: false

args:
  sequencer_type: cdk-erigon
  consensus_contract_type: rollup
  zkevm_prover_image: hermeznetwork/zkevm-prover:v8.0.0-RC16-fork.12
  additional_services: []
```

### params-stage2.yml — Full CDK stack

```yaml
deployment_stages:
  deploy_l1: false
  deploy_agglayer_contracts_on_l1: true
  deploy_databases: true
  deploy_cdk_central_environment: true
  deploy_cdk_bridge_infra: true
  deploy_agglayer: true

args:
  l1_rpc_url: "http://el-1-geth-lighthouse:8545"
  gas_token_enabled: true
  gas_token_address: "0xe02298993b76cb23AcAc6bAE213a466a1eF414ba"
  sequencer_type: cdk-erigon
  consensus_contract_type: rollup
  zkevm_prover_image: hermeznetwork/zkevm-prover:v8.0.0-RC16-fork.12
  additional_services: []
```

---

## Testing Checklist

```bash
# 1. Confirm gas token in input args
kurtosis files download cdk input_args.json /tmp/input_args
cat /tmp/input_args/input_args.json | python3 -m json.tool | grep -i gas

# 2. Check L1 token details
cast call 0xe02298993b76cb23AcAc6bAE213a466a1eF414ba "name()(string)" --rpc-url http://127.0.0.1:59715
cast call 0xe02298993b76cb23AcAc6bAE213a466a1eF414ba "symbol()(string)" --rpc-url http://127.0.0.1:59715
cast call 0xe02298993b76cb23AcAc6bAE213a466a1eF414ba "totalSupply()(uint256)" --rpc-url http://127.0.0.1:59715

# 3. Check L1 token balance
cast call 0xe02298993b76cb23AcAc6bAE213a466a1eF414ba \
  "balanceOf(address)(uint256)" \
  0xE34aaF64b29273B7D567FCFc40544c014EEe9970 \
  --rpc-url http://127.0.0.1:59715

# 4. Check L2 native balance (MGT as native currency)
cast balance 0xE34aaF64b29273B7D567FCFc40544c014EEe9970 --rpc-url http://127.0.0.1:50199

# 5. Deploy contract on L2 (gas paid in MGT)
npx hardhat ignition deploy ignition/modules/SimpleStorage.ts --network l2

# 6. Interact with contract on L2
cast send <CONTRACT_ADDRESS> "set(uint256)" 45 \
  --private-key 0x12d7de8621a77640c9241b2595ba78ce443d05e94090365ab3bb5e19df82c625 \
  --rpc-url http://127.0.0.1:50199 \
  --legacy

cast call <CONTRACT_ADDRESS> "get()(uint256)" --rpc-url http://127.0.0.1:50199

# 7. Confirm L2 balance decreased after transactions (gas consumed in MGT)
cast balance 0xE34aaF64b29273B7D567FCFc40544c014EEe9970 --rpc-url http://127.0.0.1:50199
```

---

## Common Issues & Fixes

| Issue                              | Cause                                      | Fix                                                          |
| ---------------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| `RPC not ready`                    | Mnemonic account not funded on external L1 | Fund `0x8943...` with ETH before deploying                   |
| `eip1559 unsupported`              | CDK Erigon doesn't support EIP-1559        | Add `--legacy` flag to cast send                             |
| `insufficient funds`               | Deployer has no ETH/MGT                    | Fund via mnemonic account                                    |
| `gasToken-erc20.json 404`          | Expected when using custom token           | Normal — kurtosis only creates this for auto-deployed tokens |
| Agglayer waiting for genesis block | Anvil block count too high                 | Use internal L1 (two-stage deploy) instead of Anvil          |
| Container can't reach external L1  | Anvil not bound to `0.0.0.0`               | Start Anvil with `--host 0.0.0.0`                            |

---

## References

- [kurtosis-cdk GitHub](https://github.com/0xPolygon/kurtosis-cdk)
- [Polygon CDK Docs](https://docs.polygon.technology/cdk/)
- [Kurtosis Docs](https://docs.kurtosis.com/)
- [AggLayer Docs](https://docs.agglayer.io/)
- [Foundry (cast/anvil)](https://getfoundry.sh/)
