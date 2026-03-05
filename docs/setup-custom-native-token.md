# Custom Native Gas Token on Local CDK Chain

This document covers how to set up and verify a custom native gas token on a local Polygon CDK chain using [kurtosis-cdk](https://github.com/0xPolygon/kurtosis-cdk).

---

## Prerequisites

- [Kurtosis](https://docs.kurtosis.com/install/) installed
- [Foundry](https://getfoundry.sh/) installed (`cast`, `forge`)
- [Node.js](https://nodejs.org/) + Hardhat
- kurtosis-cdk repo cloned

---

## 1. Deploying the CDK Chain with Custom Gas Token

### params.yml

```yaml
args:
  gas_token_enabled: true
  gas_token_address: "0x0000000000000000000000000000000000000000" # zero = auto-deploy a new ERC-20
  sequencer_type: cdk-erigon
  consensus_contract_type: rollup
  zkevm_prover_image: hermeznetwork/zkevm-prover:v8.0.0-RC16-fork.12
```

> **Note:** Setting `gas_token_address` to the zero address tells kurtosis-cdk to automatically deploy a fresh ERC-20 token and use it as the native gas token on L2.

### Run the deployment

```bash
kurtosis run --enclave cdk --args-file ./params.yml github.com/0xPolygon/kurtosis-cdk
```

---

## 2. Verifying the Gas Token Setup

### Confirm gas_token_enabled was picked up

```bash
kurtosis files download cdk input_args.json /tmp/input_args
cat /tmp/input_args/input_args.json | grep -i gas
```

Expected output:

```json
"gas_token_address": "0x0000000000000000000000000000000000000000",
"gas_token_enabled": true,
"gas_token_network": 0,
```

### Find the deployed gas token contract address

```bash
curl http://127.0.0.1:61311/opt/agglayer-contracts/gasToken-erc20.json
```

Expected output:

```json
{
  "deployer": "0x8943545177806ED17B9F23F0a21ee5948eCaa776",
  "deployedTo": "0x72ae2643518179cF01bcA3278a37ceAD408DE8b2",
  "transactionHash": "0xa5cfc32d36982f07fd763a24347fadbeeaaa9c5408fa9ce72739f4c881904b60"
}
```

### Verify token details

```bash
# Token name
cast call 0x72ae2643518179cF01bcA3278a37ceAD408DE8b2 "name()(string)" --rpc-url http://127.0.0.1:58935
# → "CDK Gas Token"

# Token symbol
cast call 0x72ae2643518179cF01bcA3278a37ceAD408DE8b2 "symbol()(string)" --rpc-url http://127.0.0.1:58935
# → "CDK"

# Total supply
cast call 0x72ae2643518179cF01bcA3278a37ceAD408DE8b2 "totalSupply()(uint256)" --rpc-url http://127.0.0.1:58935
# → 1000000000000000000000000 (1,000,000 CDK)
```

---

## 3. Finding the Token Holder

The initial token recipient is the `initialZkEVMDeployerOwner` from deploy parameters:

```bash
kurtosis files download cdk deploy_parameters.json /tmp/deploy_params
cat /tmp/deploy_params/deploy_parameters.json | python3 -m json.tool | grep -i "initial"
```

Expected output:

```json
"initialZkEVMDeployerOwner": "0xE34aaF64b29273B7D567FCFc40544c014EEe9970"
```

### Check token balance on L1

```bash
cast call 0x72ae2643518179cF01bcA3278a37ceAD408DE8b2 \
  "balanceOf(address)(uint256)" \
  0xE34aaF64b29273B7D567FCFc40544c014EEe9970 \
  --rpc-url http://127.0.0.1:58935
# → 990000000000000000000000 (990,000 CDK — 10,000 used during deployment setup)
```

---

## 4. How the Gas Token Works on L1 vs L2

|                  | L1                        | L2                                          |
| ---------------- | ------------------------- | ------------------------------------------- |
| Gas currency     | ETH                       | CDK Gas Token                               |
| CDK Token role   | ERC-20 (bridgeable asset) | Native currency                             |
| Deployer balance | 990,000 CDK (ERC-20)      | 107,899 CDK (native, pre-funded at genesis) |

- On **L1**, the CDK Gas Token is a standard ERC-20 contract. ETH is still used to pay for L1 gas.
- On **L2**, the CDK Gas Token is the **native currency** — every transaction on L2 consumes CDK tokens as gas fees, just like ETH on Ethereum mainnet.
- The L2 deployer address was pre-funded with CDK tokens at genesis by kurtosis-cdk automatically.

---

## 5. Key Addresses & Private Keys

> ⚠️ These are **local test keys only** — never use on mainnet or any public network.

| Role             | Address                                      | Private Key                                                          |
| ---------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| Deployer / Owner | `0xE34aaF64b29273B7D567FCFc40544c014EEe9970` | `0x12d7de8621a77640c9241b2595ba78ce443d05e94090365ab3bb5e19df82c625` |
| Sequencer        | —                                            | `0x183c492d0ba156041a7f31a1b188958a7a22eebadca741a7fe64436092dc3181` |
| Aggregator       | —                                            | `0x2857ca0e7748448f3a50469f7ffe55cde7299d5696aedd72cfe18a06fb856970` |
| Sovereign Admin  | —                                            | `0xa574853f4757bfdcbb59b03635324463750b27e16df897f3d00dc6bef2997ae0` |
| Claim Sponsor    | —                                            | `0x986b325f6f855236b0b04582a19fe0301eeecb343d0f660c61805299dbf250eb` |

Retrieve keys anytime:

```bash
kurtosis files download cdk contracts.sh /tmp/contracts
cat /tmp/contracts/contracts.sh | grep -i "private_key\|DEPLOYER_PRIVATE_KEY"
```

---

## 6. Hardhat Configuration

```javascript
// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.20",
  networks: {
    l1: {
      url: "http://127.0.0.1:58935", // el-1-geth-lighthouse RPC
      chainId: 271828,
      accounts: [
        "0x12d7de8621a77640c9241b2595ba78ce443d05e94090365ab3bb5e19df82c625",
      ],
    },
    l2: {
      url: "http://127.0.0.1:55946", // cdk-erigon-rpc-001 RPC
      chainId: 2151908,
      accounts: [
        "0x12d7de8621a77640c9241b2595ba78ce443d05e94090365ab3bb5e19df82c625",
      ],
    },
  },
};
```

### Get chain IDs dynamically

```bash
# L1 chain ID
cast chain-id --rpc-url http://127.0.0.1:58935

# L2 chain ID
cast chain-id --rpc-url http://127.0.0.1:55946
```

---

## 7. Service Ports Reference

| Service             | Port  | URL                            |
| ------------------- | ----- | ------------------------------ |
| L1 RPC (geth)       | 58935 | `http://127.0.0.1:58935`       |
| L2 RPC (cdk-erigon) | 55946 | `http://127.0.0.1:55946`       |
| L2 WS RPC           | 55947 | `ws://127.0.0.1:55947`         |
| L2 Sequencer RPC    | 55939 | `http://127.0.0.1:55939`       |
| Contracts server    | 61311 | `http://127.0.0.1:61311`       |
| Bridge service      | 55954 | `http://127.0.0.1:55954`       |
| AggLayer            | 55933 | `http://127.0.0.1:55933`       |
| Postgres            | 55930 | `postgresql://127.0.0.1:55930` |

> **Note:** Ports are dynamically assigned by Kurtosis and will differ on each fresh deployment. Always check with `kurtosis enclave inspect cdk`.

---

## 8. Monitoring & Logs

```bash
# Watch sequencer logs in real-time
kurtosis service logs cdk cdk-erigon-sequencer-001 --follow

# Watch RPC node logs
kurtosis service logs cdk cdk-erigon-rpc-001 --follow

# Watch all services
kurtosis service logs cdk --follow

# Poll latest L2 block
watch -n 2 'cast block latest --rpc-url http://127.0.0.1:55946'
```

---

## 9. Next Steps

- [ ] Bridge CDK tokens from L1 → L2 via the bridge service (`http://127.0.0.1:55954`)
- [ ] Use your own pre-deployed ERC-20 as the gas token by setting `gas_token_address` in `params.yml`
- [ ] Deploy and interact with smart contracts on L2 using the CDK token as native gas

---

## References

- [kurtosis-cdk GitHub](https://github.com/0xPolygon/kurtosis-cdk)
- [Polygon CDK Docs](https://docs.polygon.technology/cdk/)
- [Kurtosis Docs](https://docs.kurtosis.com/)
- [AggLayer Docs](https://docs.agglayer.io/)
