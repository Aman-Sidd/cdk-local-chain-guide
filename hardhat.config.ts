import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
     // ── Layer 1 — el-1-geth-lighthouse ────────────────────────────
      l1: {
      url: "http://127.0.0.1:58935",
      type:'http',
      accounts: ["0x12d7de8621a77640c9241b2595ba78ce443d05e94090365ab3bb5e19df82c625"],
    },
    // L2 - OP Chain (via proxyd)
    l2: {
      url: "http://127.0.0.1:55946",
      type:"http",
      accounts: ["0x12d7de8621a77640c9241b2595ba78ce443d05e94090365ab3bb5e19df82c625"],
    },
    // L2 - OP EL direct
    op_el: {
      url: "http://127.0.0.1:53094",
      type:"http",
      accounts: ["0x12d7de8621a77640c9241b2595ba78ce443d05e94090365ab3bb5e19df82c625"],
    },
  },
});
