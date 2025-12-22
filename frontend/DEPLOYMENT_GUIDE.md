# QRAFT Token Deployment Guide

## Prerequisites

Install required packages:
```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts dotenv
```

## Step 1: Local Testing (Recommended First)

### Start Local Blockchain
```bash
npx hardhat node
```
This starts a local Ethereum blockchain at `http://127.0.0.1:8545`

### Deploy to Local Network
In a new terminal:
```bash
npx hardhat run scripts/deploy.js --network localhost
```

### What This Does:
- ✅ Deploys QraftToken contract
- ✅ Mints 1,000,000 QRAFT tokens
- ✅ Funds contract with 500,000 tokens for rewards
- ✅ Creates `deployment-info.json` with contract address

### Update Your Config
Copy the contract address from the output and update:
`src/config/blockchain.js` → `QRAFT_TOKEN_ADDRESS`

## Step 2: Deploy to Testnet (Before Production)

### Get Testnet Setup

1. **Create Alchemy/Infura Account** (free RPC provider)
   - Go to https://www.alchemy.com/
   - Create account and get API key

2. **Get Test ETH/MATIC**
   - Sepolia: https://sepoliafaucet.com/
   - Mumbai: https://faucet.polygon.technology/

3. **Setup .env File**
```bash
cp .env.example .env
```

Edit `.env`:
```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY
PRIVATE_KEY=your_wallet_private_key_here
NEXT_PUBLIC_NETWORK=sepolia
```

### Deploy to Sepolia Testnet
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

### Verify Contract (Optional but Recommended)
```bash
npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS
```

## Step 3: Production Deployment

### Choose Your Network:
- **Polygon** (recommended - low fees, fast)
- **Ethereum** (expensive gas fees)

### Deploy to Polygon Mainnet
```bash
# Update .env
NEXT_PUBLIC_NETWORK=polygon
POLYGON_RPC_URL=https://polygon-rpc.com
PRIVATE_KEY=your_mainnet_wallet_private_key

# Deploy
npx hardhat run scripts/deploy.js --network polygon
```

## Step 4: Configure Frontend

Update `src/config/blockchain.js`:
```javascript
export const QRAFT_TOKEN_ADDRESS = "0xYOUR_DEPLOYED_CONTRACT_ADDRESS";
export const CURRENT_NETWORK = "polygon"; // or your chosen network
```

## Step 5: Test Your Integration

```javascript
import { getQraftBalance } from '@/helpers/wallet/getBalance';

// Get user's QRAFT balance
const balance = await getQraftBalance(userWalletAddress);
console.log(`User has ${balance} QRAFT tokens`);
```

## Step 6: Setup Backend Rewards (Next Phase)

You'll need to:
1. Create a backend wallet (for distributing rewards)
2. Authorize it as a reward distributor
3. Implement reward distribution logic

---

## Quick Commands Reference

```bash
# Install dependencies
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts

# Compile contract
npx hardhat compile

# Test contract (if you write tests)
npx hardhat test

# Deploy to local network
npx hardhat node  # Terminal 1
npx hardhat run scripts/deploy.js --network localhost  # Terminal 2

# Deploy to testnet
npx hardhat run scripts/deploy.js --network sepolia

# Deploy to mainnet
npx hardhat run scripts/deploy.js --network polygon
```

## Network Costs

| Network | Gas Cost | Speed | Recommendation |
|---------|----------|-------|----------------|
| Localhost | Free | Instant | Development |
| Sepolia | Free (testnet) | ~15s | Testing |
| Mumbai | Free (testnet) | ~2s | Testing |
| Polygon | $0.01-0.10 | ~2s | ✅ Production |
| Ethereum | $5-50 | ~15s | Expensive |

**Recommendation:** Use **Polygon** for production (cheap, fast, secure)

## Security Checklist

- [ ] Never commit `.env` file
- [ ] Never share your private key
- [ ] Test on testnet before mainnet
- [ ] Verify contract on block explorer
- [ ] Keep deployment wallet secure
- [ ] Fund contract with tokens for rewards

---

## Need Help?

- Hardhat Docs: https://hardhat.org/docs
- OpenZeppelin: https://docs.openzeppelin.com/
- Ethers.js: https://docs.ethers.org/
