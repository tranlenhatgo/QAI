import { ethers } from 'ethers';
import { QRAFT_TOKEN_ADDRESS, QRAFT_TOKEN_ABI, getCurrentRpcUrl } from '@/config/blockchain';

/**
 * Get QRAFT token balance for a wallet address
 * @param {string} walletAddress - The wallet address to check
 * @returns {Promise<string>} QRAFT token balance
 */
export async function getQraftBalance(walletAddress) {
  try {
    const rpcUrl = getCurrentRpcUrl();
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
      staticNetwork: true,
      polling: false // Disable polling to prevent hanging
    });
    
    // Test connection with timeout
    const balancePromise = (async () => {
      const tokenContract = new ethers.Contract(
        QRAFT_TOKEN_ADDRESS,
        QRAFT_TOKEN_ABI,
        provider
      );
      const balance = await tokenContract.balanceOf(walletAddress);
      return ethers.formatUnits(balance, 18);
    })();
    
    // 5 second timeout
    const timeoutPromise = new Promise((_resolve, reject) => 
      setTimeout(() => reject(new Error('Blockchain connection timeout')), 5000)
    );
    
    return await Promise.race([balancePromise, timeoutPromise]);
  } catch (error) {
    console.error('Error fetching QRAFT balance (blockchain may not be running):', error.message);
    return '0';
  }
}

/**
 * Get token balance for any ERC20 token
 * @param {string} walletAddress - The wallet address to check
 * @param {string} tokenContractAddress - Token contract address
 * @param {string} rpcUrl - Blockchain RPC URL (optional)
 * @returns {Promise<string>} Token balance
 */
export async function getTokenBalance(walletAddress, tokenContractAddress, rpcUrl) {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl || getCurrentRpcUrl());
    const tokenContract = new ethers.Contract(
      tokenContractAddress,
      ['function balanceOf(address) view returns (uint256)'],
      provider
    );
    
    const balance = await tokenContract.balanceOf(walletAddress);
    return ethers.formatUnits(balance, 18);
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return '0';
  }
}

/**
 * Get native network balance (ETH/MATIC/etc) for a wallet address
 * @param {string} walletAddress - The wallet address to check
 * @param {string} rpcUrl - Blockchain RPC URL (optional)
 * @returns {Promise<string>} Native token balance
 */
export async function getNativeBalance(walletAddress, rpcUrl) {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl || getCurrentRpcUrl());
    const balance = await provider.getBalance(walletAddress);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error('Error fetching native balance:', error);
    return '0';
  }
}
