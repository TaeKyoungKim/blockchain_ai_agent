import hre from "hardhat";

async function main() {
  console.log("[Deploy] Deploying RealEstateContractRegistry to target network...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("[Deploy] Deployer address:", deployer.address);

  const RegistryFactory = await hre.ethers.getContractFactory("RealEstateContractRegistry");
  const registry = await RegistryFactory.deploy();
  await registry.waitForDeployment();

  const contractAddress = await registry.getAddress();
  console.log("==================================================");
  console.log("[Deploy] Contract successfully deployed!");
  console.log("[Deploy] CONTRACT_ADDRESS:", contractAddress);
  console.log("[Deploy] Set CONTRACT_ADDRESS=" + contractAddress + " in your root .env file.");
  console.log("==================================================");
}

main().catch((error) => {
  console.error("[Deploy] Deployment failed:", error);
  process.exitCode = 1;
});

