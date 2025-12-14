// Quick test to verify your QRAFT token is working
import { ethers } from 'ethers';

const QRAFT_TOKEN_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const RPC_URL = "http://127.0.0.1:8545";

const QRAFT_TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function getContractBalance() view returns (uint256)"
];

async function testToken() {
  try {
    console.log("🔍 Testing QRAFT Token...\n");
    
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(QRAFT_TOKEN_ADDRESS, QRAFT_TOKEN_ABI, provider);
    
    // Get token info
    const name = await contract.name();
    const symbol = await contract.symbol();
    const totalSupply = await contract.totalSupply();
    const contractBalance = await contract.getContractBalance();
    
    console.log("✅ Token Details:");
    console.log(`   Name: ${name}`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Total Supply: ${ethers.formatUnits(totalSupply, 18)} ${symbol}`);
    console.log(`   Contract Balance (for rewards): ${ethers.formatUnits(contractBalance, 18)} ${symbol}`);
    
    // Test wallet balance (deployer)
    const deployerAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const deployerBalance = await contract.balanceOf(deployerAddress);
    console.log(`\n💰 Deployer Balance: ${ethers.formatUnits(deployerBalance, 18)} ${symbol}`);
    
    console.log("\n🎉 Your QRAFT token is working perfectly!");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testToken();
