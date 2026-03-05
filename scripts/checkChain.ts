import {network} from "hardhat";
import { formatEther, JsonRpcProvider } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Kurtosis services to probe ────────────────────────────────────────────────
const SERVICES: { name: string; url: string; type: "evm" | "http" }[] = [
  { name: "L1  el-1-geth",           url: "http://127.0.0.1:56140", type: "evm"  },
  { name: "L2  op-el-1 (primary)",   url: "http://127.0.0.1:53094", type: "evm"  },
  { name: "L2  op-el-2 (secondary)", url: "http://127.0.0.1:53610", type: "evm"  },
  { name: "L2  op-cl-1 (op-node)",   url: "http://127.0.0.1:53595", type: "http" },
  { name: "L2  op-cl-2 (op-node)",   url: "http://127.0.0.1:53837", type: "http" },
  { name: "AggLayer readRPC",         url: "http://127.0.0.1:50718", type: "http" },
  { name: "AggLayer admin",           url: "http://127.0.0.1:50721", type: "http" },
  { name: "AggLayer dashboard",       url: "http://127.0.0.1:62637", type: "http" },
  { name: "aggkit-001 RPC",           url: "http://127.0.0.1:51220", type: "http" },
  { name: "aggkit-bridge REST",       url: "http://127.0.0.1:51274", type: "http" },
  { name: "bridge-service RPC",       url: "http://127.0.0.1:51334", type: "http" },
  { name: "op-batcher",               url: "http://127.0.0.1:65253", type: "http" },
  { name: "op-proposer",              url: "http://127.0.0.1:65334", type: "http" },
  { name: "proxyd",                   url: "http://127.0.0.1:65384", type: "evm"  },
  { name: "contracts-001",            url: "http://127.0.0.1:56898", type: "http" },
];

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const bold  = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red   = (s: string) => `\x1b[31m${s}\x1b[0m`;
const gray  = (s: string) => `\x1b[90m${s}\x1b[0m`;
const ok    = green("✔");
const fail  = red("✘");
const PAD   = 30;
const LINE  = "─".repeat(64);

// ── Probe helpers ─────────────────────────────────────────────────────────────
async function probeEvm(url: string) {
  try {
    const p = new JsonRpcProvider(url, undefined, { staticNetwork: true });
    const [net, block] = await Promise.all([p.getNetwork(), p.getBlockNumber()]);
    return { up: true, chainId: net.chainId.toString(), block };
  } catch (e: any) {
    return { up: false, error: e.message.split("\n")[0].slice(0, 60) };
  }
}

async function probeHttp(url: string) {
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res   = await fetch(url, { signal: ctrl.signal }).catch(() => null);
    clearTimeout(timer);
    return { up: res !== null, status: res?.status };
  } catch {
    return { up: false };
  }
}

function loadDeployedAddress(chainId: string): string | null {
  const p = path.join(
    __dirname, "..", "ignition", "deployments",
    `chain-${chainId}`, "deployed_addresses.json"
  );
  if (!fs.existsSync(p)) return null;
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  return data["SimpleStorageModule#SimpleStorage"] ?? null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const { ethers, networkName} = await network.connect();
  const [signer]  = await ethers.getSigners();
  const provider  = ethers.provider;
  const net       = await provider.getNetwork();
  const chainId   = net.chainId.toString();
  const blockNum  = await provider.getBlockNumber();
  const balance   = await provider.getBalance(signer.address);
  const feeData   = await provider.getFeeData();
  const block     = await provider.getBlock(blockNum);
  const nonce     = await provider.getTransactionCount(signer.address);

  console.log(`\n${bold("╔══════════════════════════════════════════════════════════════╗")}`);
  console.log(  bold("║        CDK Pessimistic Proof — Chain Check                   ║"));
  console.log(  bold("╚══════════════════════════════════════════════════════════════╝"));

  // ── Connected chain ──────────────────────────────────────────────
  console.log(`\n${bold("▸ Connected chain")}`);
  console.log(`  ${"Network".padEnd(PAD)} ${networkName}`);
  console.log(`  ${"Chain ID".padEnd(PAD)} ${chainId}`);
  console.log(`  ${"Latest block".padEnd(PAD)} #${blockNum}`);
  console.log(`  ${"Block timestamp".padEnd(PAD)} ${new Date(Number(block!.timestamp) * 1000).toISOString()}`);
  console.log(`  ${"Gas limit".padEnd(PAD)} ${block!.gasLimit.toLocaleString()}`);
  console.log(`  ${"Gas used".padEnd(PAD)} ${block!.gasUsed.toLocaleString()}`);
  console.log(`  ${"Base fee".padEnd(PAD)} ${feeData.gasPrice != null ? formatEther(feeData.gasPrice) + " ETH/gas" : "n/a"}`);

  // ── Signer ────────────────────────────────────────────────────────
  console.log(`\n${bold("▸ Signer")}`);
  console.log(`  ${"Address".padEnd(PAD)} ${signer.address}`);
  console.log(`  ${"Balance".padEnd(PAD)} ${formatEther(balance)} ETH`);
  console.log(`  ${"Nonce".padEnd(PAD)} ${nonce}`);



  // ── SimpleStorage contract ────────────────────────────────────────
  console.log(`\n${bold("▸ SimpleStorage contract")}`);
  const addr = loadDeployedAddress(chainId);

  if (!addr) {
    console.log(`  ${gray("Not deployed yet on chain " + chainId)}`);
    console.log(`  ${gray("Run: npx hardhat ignition deploy ignition/modules/SimpleStorage.ts --network " + networkName)}`);
  } else {
    console.log(`  ${"Address".padEnd(PAD)} ${addr}`);
    try {
      const contract = await ethers.getContractAt("SimpleStorage", addr);
      const stored   = await contract.get();
      const setter   = await contract.lastSetter();
      const code     = await provider.getCode(addr);

      console.log(`  ${"Bytecode size".padEnd(PAD)} ${(code.length - 2) / 2} bytes`);
      console.log(`  ${"Stored value".padEnd(PAD)} ${stored}`);
      console.log(`  ${"Last setter".padEnd(PAD)} ${setter}`);

      console.log(`\n  ${bold("→ Sending test tx: set(999)...")}`);
      const tx      = await contract.set(48n);
      const receipt = await tx.wait();
      const updated = await contract.get();

      console.log(`  ${"Tx hash".padEnd(PAD)} ${receipt!.hash}`);
      console.log(`  ${"Block".padEnd(PAD)} #${receipt!.blockNumber}`);
      console.log(`  ${"Gas used".padEnd(PAD)} ${receipt!.gasUsed.toLocaleString()}`);
      console.log(`  ${"Value after set(999)".padEnd(PAD)} ${green(updated.toString())}`);
    } catch (e: any) {
      console.log(`  ${red("Error reading contract:")} ${e.message}`);
    }
  }

  console.log(`\n${bold("▸ Done")} ${new Date().toISOString()}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });