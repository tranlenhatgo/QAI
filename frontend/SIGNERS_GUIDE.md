# Understanding Signers and Private Keys in Ethers.js

## The Problem You Identified ✅

You correctly noticed that `contract.transfer(user, amount)` needs a private key to sign the transaction!

## How It Works

### 1. **Provider (Read-Only)**
```javascript
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
const contract = new ethers.Contract(address, abi, provider);

// ✅ Can READ blockchain data:
await contract.balanceOf(user);
await contract.totalSupply();

// ❌ CANNOT WRITE (send transactions):
await contract.transfer(user, 100); // ERROR: no signer
```

### 2. **Signer (Can Write)**
```javascript
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
const wallet = new ethers.Wallet(privateKey, provider); // ⭐ Has private key
const contract = new ethers.Contract(address, abi, wallet); // Use wallet as signer

// ✅ Can READ:
await contract.balanceOf(user);

// ✅ Can WRITE (sends transactions):
await contract.transfer(user, 100); // Works! Signed with wallet's private key
```

## Where Private Keys Come From

### **Hardhat's 20 Test Accounts**

When you run `npx hardhat node`, you get 20 accounts with private keys:

```
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

... (18 more accounts)
```

**For development, use Account #0 as your "backend wallet"** to distribute rewards.

## Setup for Your Qraft App

### **Step 1: Add Backend Private Key to .env**

```bash
# Copy .env.example to .env
cp .env.example .env
```

Edit `.env`:
```env
# Use Hardhat Account #0 private key for localhost development
BACKEND_WALLET_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

⚠️ **Important:** Never commit your `.env` file! Add it to `.gitignore`

### **Step 2: Backend API Distributes Rewards**

```javascript
// src/pages/api/rewards/distribute.js
const backendPrivateKey = process.env.BACKEND_WALLET_PRIVATE_KEY;
const wallet = new ethers.Wallet(backendPrivateKey, provider);
const contract = new ethers.Contract(address, abi, wallet);

// Now this works! (signed with backend wallet)
await contract.transfer(userAddress, amount);
```

### **Step 3: Frontend Calls Backend**

```javascript
// Frontend: Request reward distribution
await fetch('/api/rewards/distribute', {
  method: 'POST',
  body: JSON.stringify({
    userWalletAddress: user.walletAddress,
    amount: 10
  })
});

// Backend: Signs and sends transaction
// User: Receives tokens! 🎉
```

## Security Model

### ✅ **What's Safe:**
- Frontend can READ balances (no private key needed)
- Backend API distributes rewards (private key secured server-side)
- Users can't fake rewards (only backend can send)

### ❌ **What's Unsafe:**
- NEVER send private keys to frontend
- NEVER store private keys in Firebase
- NEVER commit `.env` to git

## Flow Diagram

```
User completes quiz
       ↓
Frontend calls /api/rewards/distribute
       ↓
Backend API (has private key)
       ↓
Signs transaction with backend wallet
       ↓
Sends tokens to user's wallet
       ↓
User sees updated balance! 🎉
```

## Quick Reference

### **Read Operations (No Signer Needed)**
```javascript
const provider = new ethers.JsonRpcProvider(rpcUrl);
const contract = new ethers.Contract(address, abi, provider);
await contract.balanceOf(user); // ✅ Works
```

### **Write Operations (Signer Required)**
```javascript
const wallet = new ethers.Wallet(privateKey, provider);
const contract = new ethers.Contract(address, abi, wallet);
await contract.transfer(user, amount); // ✅ Works (signed)
```

## For Your Exam

You can explain:

> "The smart contract requires a cryptographic signature to authorize token transfers. We use a backend wallet with a private key to sign reward transactions server-side. This prevents users from forging rewards while maintaining security. The frontend can read balances without a key, but only our authorized backend can distribute tokens."

This demonstrates understanding of:
- ✅ Public/private key cryptography
- ✅ Transaction signing
- ✅ Security best practices
- ✅ Client-server architecture

---

## Files Created

1. **`src/helpers/wallet/distributeRewards.js`** - Functions to send tokens
2. **`src/pages/api/rewards/distribute.js`** - Backend API endpoint
3. **`src/helpers/quiz/rewardUser.js`** - Example integration
4. **`.env.example`** - Configuration template

## Next Steps

1. Copy `.env.example` to `.env` (already has Hardhat test private key)
2. Update your quiz completion logic to call `rewardUserForQuiz()`
3. Test by completing a quiz and checking user's QRAFT balance!
