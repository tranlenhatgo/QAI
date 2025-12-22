import { getWalletAddress } from '@/helpers/wallet/walletinit';

/**
 * Called when user completes a quiz
 */
export async function rewardUserForQuiz(userId, quizScore) {
  try {
    // Get user's wallet address from Firebase using existing function
    const walletAddress = await getWalletAddress(userId);
    
    if (!walletAddress) {
      console.error('User has no wallet address');
      return { success: false, error: 'No wallet' };
    }
    
    // Calculate reward based on score
    let rewardAmount = 0;
    let reason = '';
    
    if (quizScore >= 90) {
      rewardAmount = 50; // Perfect score
      reason = 'Perfect Quiz Score (90%+)';
    } else if (quizScore >= 70) {
      rewardAmount = 20; // Good score
      reason = 'Good Quiz Score (70-89%)';
    } else {
      rewardAmount = 10; // Participation
      reason = 'Quiz Completion';
    }
    
    // Call backend API to distribute reward
    const response = await fetch('/api/rewards/distribute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userWalletAddress: walletAddress,
        amount: rewardAmount,
        reason: reason
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Rewarded ${rewardAmount} QRAFT to user!`);
      console.log(`Transaction: ${result.txHash}`);
      return {
        success: true,
        amount: rewardAmount,
        txHash: result.txHash
      };
    } else {
      console.error('Failed to distribute reward:', result.error);
      return { success: false, error: result.error };
    }
    
  } catch (error) {
    console.error('Error rewarding user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * In Quiz completion handler:
 */
export async function handleQuizCompletion(userId, answers, correctAnswers) {
  // Calculate score
  const score = (correctAnswers / answers.length) * 100;
  
  // Save quiz results to Firebase (your existing logic)
  // ...
  
  // Reward user with QRAFT tokens
  const rewardResult = await rewardUserForQuiz(userId, score);
  
  if (rewardResult.success) {
    // Show success message to user
    return {
      score: score,
      reward: rewardResult.amount,
      message: `You earned ${rewardResult.amount} QRAFT tokens! 🎉`,
      txHash: rewardResult.txHash
    };
  } else {
    // Handle error gracefully
    return {
      score: score,
      reward: 0,
      message: 'Quiz completed, but reward distribution failed',
      error: rewardResult.error
    };
  }
}
