// Blockchain configuration for Qraft app

// After deploying, update this address
export const QRAFT_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // Updated after deployment

// RPC URLs for different networks
export const RPC_URLS = {
  // Local development (Hardhat)
  localhost: "http://127.0.0.1:8545",
  
  // Testnets (for testing before production)
  sepolia: "https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY",
  mumbai: "https://rpc-mumbai.maticvigil.com",
  
  // Production networks
  polygon: "https://polygon-rpc.com",
  ethereum: "https://eth.llamarpc.com"
};

// Current network (change based on environment)
export const CURRENT_NETWORK = process.env.NEXT_PUBLIC_NETWORK || "localhost";

// Get current RPC URL
export const getCurrentRpcUrl = () => {
  return RPC_URLS[CURRENT_NETWORK] || RPC_URLS.localhost;
};

// Chain IDs
export const CHAIN_IDS = {
  localhost: 1337,
  sepolia: 11155111,
  mumbai: 80001,
  polygon: 137,
  ethereum: 1
};

// Token ABI (minimal interface needed for frontend)
export const QRAFT_TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function quizReward() view returns (uint256)",
  "function correctAnswerReward() view returns (uint256)",
  "function distributeReward(address user, uint256 amount, string reason)",
  "function batchDistributeRewards(address[] users, uint256[] amounts, string reason)",
  "function setRewardDistributor(address distributor, bool authorized)",
  "function getContractBalance() view returns (uint256)",
  "function fundContract(uint256 amount)",
  "function withdrawTokens(uint256 amount)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event RewardDistributed(address indexed user, uint256 amount, string reason)"
];

// Reward amounts (for display purposes)
export const REWARDS = {
  QUIZ_COMPLETION: 10,
  CORRECT_ANSWER: 1,
  PERFECT_SCORE: 50,
  DAILY_STREAK: 5
};
