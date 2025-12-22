// API endpoint to distribute QRAFT rewards
import { distributeReward } from '@/helpers/wallet/distributeRewards';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userWalletAddress, amount, reason } = req.body;

    // Validate input
    if (!userWalletAddress || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get backend wallet private key from environment variable
    const backendPrivateKey = process.env.BACKEND_WALLET_PRIVATE_KEY;
    
    if (!backendPrivateKey) {
      console.error('BACKEND_WALLET_PRIVATE_KEY not set in environment');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Distribute the reward
    const result = await distributeReward(
      userWalletAddress,
      amount,
      backendPrivateKey
    );

    // Log the reward distribution
    console.log(`Reward distributed: ${amount} QRAFT to ${userWalletAddress} for ${reason}`);

    return res.status(200).json({
      success: true,
      message: `${amount} QRAFT tokens sent`,
      txHash: result.txHash,
      blockNumber: result.blockNumber
    });

  } catch (error) {
    console.error('Error in distribute API:', error);
    return res.status(500).json({ 
      error: 'Failed to distribute reward',
      details: error.message 
    });
  }
}
