import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "./firebase"; // Adjust the import path as necessary

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