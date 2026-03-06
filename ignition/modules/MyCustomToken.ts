import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

module.exports = buildModule("MyCustomTokenModule", (m) => {

  const myCustomToken = m.contract("MyCustomToken",["0xEdE9cf798E0fE25D35469493f43E88FeA4a5da0E"]);

  return { myCustomToken };
});