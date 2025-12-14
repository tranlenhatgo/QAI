import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ethers } from 'ethers';
import { db, auth } from '../auth/firebase';

// Create wallet when user signs up
async function createUserWallet(firebaseUser) {
  const wallet = ethers.Wallet.createRandom();
  
  await setDoc(doc(db, 'users', firebaseUser.uid), {
    walletAddress: wallet.address,
    createdAt: new Date()
  });
  
  return wallet;
}

// Get wallet address from Firestore
async function getWalletAddress(uid) {
  const userDoc = await getDoc(doc(db, 'users', uid));
  return userDoc.data()?.walletAddress || null;
}

// Merge Firebase Auth user with wallet data
async function getUserWithWallet(firebaseUser) {
  const walletAddress = await getWalletAddress(firebaseUser.uid);
  
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    emailVerified: firebaseUser.emailVerified,
    displayName: firebaseUser.displayName,
    isAnonymous: firebaseUser.isAnonymous,
    photoURL: firebaseUser.photoURL,
    walletAddress: walletAddress
  };
}

export { createUserWallet, getWalletAddress, getUserWithWallet };