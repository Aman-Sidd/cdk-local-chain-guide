# Customizing Your Local CDK Chain

There are 3 layers where you can customize your CDK stack.

---

## Layer 1 — Kurtosis Input Args (before `kurtosis run`)

This is the **main config file** — controls the whole stack.

```bash
# Download your current args
kurtosis files download cdk input_args.json ./
cat input_args.json
```

### Common parameters

```jsonc
{
  "l2_chain_id": 2151908, // change L2 chain ID
  "l1_chain_id": 3151908, // change L1 chain ID
  "l2_block_time": 2, // block time in seconds (explains incrementing blocks)
  "gas_limit": "30000000", // L2 block gas limit
  "sequencer_type": "op-geth", // or "erigon"
  "pre_funded_accounts": true, // fund default dev accounts on genesis
  "enable_normalcy": false // enable/disable bridge spammer
}
```

Apply and restart:

```bash
kurtosis clean -a
kurtosis run github.com/0xPolygon/kurtosis-cdk \
  --enclave cdk \
  --args-file input_args.json
```

---

## Layer 2 — Genesis / Chain Config (before first block)

```bash
kurtosis files download cdk el_cl_genesis_data ./genesis-data
cat ./genesis-data/genesis.json
```

### Pre-fund any address at genesis

```jsonc
{
  "alloc": {
    "0xYourAddress": {
      "balance": "0x52B7D2DCC80CD2E4000000" // 1,000,000 ETH in wei hex
    }
  }
}
```

> ⚠️ Genesis changes require a full restart.

---

## Layer 3 — Live Tuning (no restart needed)

### Fund any address right now

```bash
cast send 0xYourNewAddress \
  --value 100ether \
  --rpc-url http://127.0.0.1:50422 \
  --private-key $PRIVATE_KEY
```

### Send a tx with custom gas settings

```bash
cast send <contract> "set(uint256)" 42 \
  --rpc-url http://127.0.0.1:50422 \
  --private-key $PRIVATE_KEY \
  --gas-limit 100000 \
  --gas-price 1gwei
```

### Check deployed contract addresses

```bash
curl http://127.0.0.1:50686 | jq
kurtosis files download cdk contracts.sh ./
cat contracts.sh
```

---

## Customization Cheat Sheet

| What to change      | Where                                | Restart needed? |
| ------------------- | ------------------------------------ | --------------- |
| Block time          | `input_args.json` → `l2_block_time`  | ✅ Full restart |
| L2 Chain ID         | `input_args.json` → `l2_chain_id`    | ✅ Full restart |
| Block gas limit     | `input_args.json` → `gas_limit`      | ✅ Full restart |
| Sequencer type      | `input_args.json` → `sequencer_type` | ✅ Full restart |
| Pre-fund address    | `genesis.json` → `alloc`             | ✅ Full restart |
| Send ETH to address | `cast send`                          | ❌ Live         |
| Deploy new contract | Hardhat / cast                       | ❌ Live         |
| Gas price on tx     | `cast send --gas-price`              | ❌ Live         |

---

## Full Restart Workflow

```bash
# 1. Edit your config
nano input_args.json

# 2. Wipe everything
kurtosis clean -a

# 3. Redeploy (~3-5 min)
kurtosis run github.com/0xPolygon/kurtosis-cdk \
  --enclave cdk \
  --args-file input_args.json

# 4. Verify
npx hardhat run scripts/checkChain.ts --network l2
```

---

## Useful Kurtosis Commands

```bash
kurtosis enclave ls                                      # list enclaves
kurtosis enclave inspect cdk                             # inspect services
kurtosis service logs cdk op-el-1-op-geth-op-node-001   # follow L2 logs
kurtosis service logs cdk agglayer                       # follow AggLayer logs
kurtosis service logs cdk op-batcher-001                 # follow batcher logs
kurtosis files download cdk input_args.json ./           # download config
kurtosis clean -a                                        # wipe everything
```
