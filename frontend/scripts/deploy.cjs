const hre = require("hardhat");

async function main() {
  console.log("Deploying QraftToken...");

  // Get the contract factory
  const QraftToken = await hre.ethers.getContractFactory("QraftToken");
  
  // Deploy the contract
  const qraftToken = await QraftToken.deploy();
  await qraftToken.waitForDeployment();

  const address = await qraftToken.getAddress();
  console.log("QraftToken deployed to:", address);

  // Get deployment info
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployed by:", deployer.address);
  
  const balance = await qraftToken.balanceOf(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatUnits(balance, 18), "QRAFT");
  
  const contractBalance = await qraftToken.getContractBalance();
  console.log("Contract balance:", hre.ethers.formatUnits(contractBalance, 18), "QRAFT");

  // Fund the contract with tokens for rewards
  console.log("\nFunding contract with 500,000 QRAFT for rewards...");
  const fundAmount = hre.ethers.parseUnits("500000", 18);
  const fundTx = await qraftToken.fundContract(fundAmount);
  await fundTx.wait();
  
  const newContractBalance = await qraftToken.getContractBalance();
  console.log("Contract balance after funding:", hre.ethers.formatUnits(newContractBalance, 18), "QRAFT");

  // Save deployment info
  const fs = require('fs');
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: address,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    tokenName: "Qraft Token",
    tokenSymbol: "QRAFT",
    initialSupply: "1000000",
    contractBalance: hre.ethers.formatUnits(newContractBalance, 18)
  };

  fs.writeFileSync(
    './deployment-info.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\nDeployment info saved to deployment-info.json");

  // Display next steps
  console.log("\n✅ Deployment complete!");
  console.log("\n📝 Next steps:");
  console.log("1. Update src/config/blockchain.js with the contract address");
  console.log("2. Set up your backend wallet as a reward distributor");
  console.log("3. Start distributing rewards to users!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
