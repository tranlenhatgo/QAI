import { useState, useEffect } from 'react';
import { getQraftBalance } from '@/helpers/wallet/getBalance';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/helpers/auth/firebase';

/**
 * Hook to display user's QRAFT balance with smart caching
 * Only queries blockchain when needed
 */
export function useQraftBalance(user) {
  const [balance, setBalance] = useState(user?.cachedBalance?.amount || 0);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(user?.cachedBalance?.lastUpdated);

  useEffect(() => {
    if (!user?.walletAddress) return;

    const shouldRefresh = () => {
      if (!lastUpdated) return true; // No cache
      const fiveMinutes = 5 * 60 * 1000;
      return Date.now() - lastUpdated > fiveMinutes;
    };

    // Use cached balance initially
    if (user.cachedBalance) {
      setBalance(user.cachedBalance.amount);
      setLastUpdated(user.cachedBalance.lastUpdated);
    }

    // Refresh from blockchain if cache is stale
    if (shouldRefresh()) {
      refreshBalance();
    }
  }, [user]);

  async function refreshBalance() {
    if (!user?.walletAddress || loading) return;
    
    setLoading(true);
    try {
      // Query blockchain
      const newBalance = await getQraftBalance(user.walletAddress);
      const balanceNum = parseFloat(newBalance);
      
      setBalance(balanceNum);
      setLastUpdated(Date.now());

      // Update cache in Firebase
      await updateDoc(doc(db, 'users', user.uid), {
        'cachedBalance.amount': balanceNum,
        'cachedBalance.lastUpdated': Date.now()
      });
    } catch (error) {
      console.error('Error refreshing balance (blockchain may not be running):', error);
      // Keep using cached balance if blockchain is unavailable
      if (user.cachedBalance) {
        setBalance(user.cachedBalance.amount);
      }
    } finally {
      setLoading(false);
    }
  }

  return {
    balance,
    loading,
    lastUpdated,
    refresh: refreshBalance
  };
}

// Usage in ProfileInfo component:
// const { balance, loading, refresh } = useQraftBalance(user);
