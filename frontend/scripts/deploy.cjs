const hre = require("hardhat");

async function main() {
  console.log("Deploying QAIToken...");

  // Get the contract factory
  const QAIToken = await hre.ethers.getContractFactory("QAIToken");
  
  // Deploy the contract
  const qaiToken = await QAIToken.deploy();
  await qaiToken.waitForDeployment();

  const address = await qaiToken.getAddress();
  console.log("QAIToken deployed to:", address);

  // Get deployment info
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployed by:", deployer.address);
  
  const balance = await qaiToken.balanceOf(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatUnits(balance, 18), "QAI");
  
  const contractBalance = await qaiToken.getContractBalance();
  console.log("Contract balance:", hre.ethers.formatUnits(contractBalance, 18), "QAI");

  // Fund the contract with tokens for rewards
  console.log("\nFunding contract with 500,000 QAI for rewards...");
  const fundAmount = hre.ethers.parseUnits("500000", 18);
  const fundTx = await qaiToken.fundContract(fundAmount);
  await fundTx.wait();
  
  const newContractBalance = await qaiToken.getContractBalance();
  console.log("Contract balance after funding:", hre.ethers.formatUnits(newContractBalance, 18), "QAI");

  // Save deployment info
  const fs = require('fs');
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: address,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    tokenName: "QAI Token",
    tokenSymbol: "QAI",
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
