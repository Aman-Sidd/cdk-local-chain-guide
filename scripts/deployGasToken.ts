import {network} from "hardhat";

const {ethers} = await network.connect();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const MyGasToken = await ethers.getContractFactory("MyGasToken");
  const token = await MyGasToken.deploy(deployer.address);
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log("Gas Token deployed at:", address);
  console.log("Save this address — you'll set it as gasTokenAddress in CDK config.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});