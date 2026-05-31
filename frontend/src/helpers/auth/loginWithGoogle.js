import { getAdditionalUserInfo, signInWithPopup } from "firebase/auth";
import { auth, provider } from "./firebase";

export default async function loginWithGoogle() {
   try {
      const result = await signInWithPopup(auth, provider);
      const additionalInfo = getAdditionalUserInfo(result);
      const token = await result.user.getIdToken();

      await fetch("/api/auth/set-token", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({ token }),
      });

      return {
         user: result.user,
         isNewUser: !!additionalInfo?.isNewUser,
      };
   } catch (error) {
      console.error("Google login failed:", error.code || error.message);
   }
};
