import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

module.exports = buildModule("SimpleStorageModule", (m) => {

  const storage = m.contract("SimpleStorage", [42n]);

  return { storage };
});