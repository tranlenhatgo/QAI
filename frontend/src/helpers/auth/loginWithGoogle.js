import { signInWithPopup } from "firebase/auth";
import { auth, provider, db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ethers } from "ethers";

export default async function loginWithGoogle() {
   try {
      const result = await signInWithPopup(auth, provider);
      const token = await result.user.getIdToken();

      console.log("Google login successful:", result);
      console.log("Token:", token);

      await fetch("/api/auth/set-token", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({ token }),
      });

      // Check if user has wallet, create if not
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (!userDoc.exists() || !userDoc.data()?.walletAddress) {
         const wallet = ethers.Wallet.createRandom();
         await setDoc(doc(db, 'users', result.user.uid), {
            walletAddress: wallet.address,
            createdAt: new Date()
         }, { merge: true });
         if (process.env.NODE_ENV !== "production") {
            console.log("Wallet created:", wallet.address);
         }
         // Store private key securely or prompt user to save it
         localStorage.setItem(`wallet_${result.user.uid}`, wallet.privateKey);
      }

      return result.user;
      // ✅ Send token to backend
      // const response = await fetch("http://localhost:8080/api/auth/check", {
      //    method: "POST",
      //    headers: {
      //       Authorization: `Bearer ${token}`,
      //       "Content-Type": "application/json",
      //    },
      // });

      // const data = await response.json();

      // return {
      //    user: result.user,
      //    euser: data.user,
      // };
   } catch (error) {
      console.error("Google login failed:", error);
   }
};