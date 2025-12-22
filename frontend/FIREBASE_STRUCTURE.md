// Firebase structure for blockchain configuration

// Store globally (once)
config/
  blockchain:
    tokenContractAddress: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
    network: "localhost"
    deployedAt: "2025-12-14T03:10:28.160Z"
    deployer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

// User wallet balances (cached, not authoritative)
users/
  {userId}/
    walletAddress: "0xABC...123"
    
    // Cached balance (updated periodically)
    cachedBalance: {
      amount: 150,
      lastUpdated: timestamp
    }
    
    // Transaction history (optional)
    transactions: [
      {
        txHash: "0x...",
        type: "reward",
        amount: 25,
        timestamp: timestamp,
        reason: "Quiz completion"
      }
    ]

// Quiz rewards (NOT contracts, just settings)
quizzes/
  {quizId}/
    rewards: {
      amount: 25,
      // This is just metadata, not a contract!
    }
