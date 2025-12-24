import { ethers } from 'ethers';
import { QRAFT_TOKEN_ADDRESS, QRAFT_TOKEN_ABI, getCurrentRpcUrl } from '@/config/blockchain';

/**
 * Distribute QRAFT tokens to a user (called from backend/API)
 * @param {string} toAddress - User's wallet address
 * @param {string} amount - Amount of tokens (in QRAFT, not wei)
 * @param {string} privateKey - Deployer/backend wallet private key
 * @returns {Promise<Object>} Transaction receipt
 */
export async function distributeReward(toAddress, amount, privateKey) {
  try {
    // Connect to blockchain
    const provider = new ethers.JsonRpcProvider(getCurrentRpcUrl());
    
    // Create wallet from private key (this wallet will pay gas and send tokens)
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Connect contract with signer (wallet)
    const contract = new ethers.Contract(
      QRAFT_TOKEN_ADDRESS,
      QRAFT_TOKEN_ABI,
      wallet // Use wallet (signer), not provider
    );
    
    // Convert amount to wei (18 decimals)
    const amountInWei = ethers.parseUnits(amount.toString(), 18);
    
    // Call distributeReward function from contract (not transfer)
    const tx = await contract.distributeReward(toAddress, amountInWei, 'Quiz Reward');
    console.log('Transaction sent:', tx.hash);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log('Transaction confirmed in block:', receipt.blockNumber);
    
    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      amount: amount
    };
    
  } catch (error) {
    console.error('Error distributing reward:', error);
    throw error;
  }
}

/**
 * Batch distribute rewards to multiple users
 * @param {Array} rewards - Array of {address, amount} objects
 * @param {string} privateKey - Backend wallet private key
 */
export async function batchDistributeRewards(rewards, privateKey, reason = 'Batch Rewards') {
  const provider = new ethers.JsonRpcProvider(getCurrentRpcUrl());
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(QRAFT_TOKEN_ADDRESS, QRAFT_TOKEN_ABI, wallet);
  
  try {
    // Prepare arrays for batch call
    const addresses = rewards.map(r => r.address);
    const amounts = rewards.map(r => ethers.parseUnits(r.amount.toString(), 18));
    
    // Call contract's batchDistributeRewards function
    const tx = await contract.batchDistributeRewards(addresses, amounts, reason);
    await tx.wait();
    
    return rewards.map(r => ({ address: r.address, success: true, txHash: tx.hash }));
  } catch (error) {
    console.error('Batch distribution failed:', error);
    return rewards.map(r => ({ address: r.address, success: false, error: error.message }));
  }
}

/**
 * Check if wallet has enough tokens to distribute
 * @param {string} privateKey - Backend wallet private key
 * @param {string} requiredAmount - Amount needed
 */
export async function checkWalletBalance(privateKey, requiredAmount) {
  const provider = new ethers.JsonRpcProvider(getCurrentRpcUrl());
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(QRAFT_TOKEN_ADDRESS, QRAFT_TOKEN_ABI, provider);
  
  const balance = await contract.balanceOf(wallet.address);
  const balanceFormatted = ethers.formatUnits(balance, 18);
  
  return {
    address: wallet.address,
    balance: balanceFormatted,
    hasEnough: parseFloat(balanceFormatted) >= parseFloat(requiredAmount)
  };
}
