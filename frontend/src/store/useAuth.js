import login from "@/helpers/auth/signIn"
import loginWithGoogle from "@/helpers/auth/loginWithGoogle"
import getQuizByUserId from "@/helpers/quiz/getQuizByUserId"
import signUp from "@/helpers/auth/signUp"
import signIn from "@/helpers/auth/signIn"
import { getUserWithWallet } from "@/helpers/wallet/walletinit"

const defaultFirebaseUser = {
   "uid": "@@@",
   "email": "@@@",
   "emailVerified": true,
   "displayName": "No user",
   "isAnonymous": false,
   "photoURL": "default-avatar.jpg",
   "walletAddress": null
}

export const useAuthStore = (set, get) => ({
   user: defaultFirebaseUser,
   quizzes: [],
   history: [],
   hostId: null,
   authloading: false,
   dest: null,
   setDest: (dest) => {
      set({ dest })
   },
   setUser: (user) => {
      set({ user })
   },
   login: async (username, password) => {
      set({ authloading: true })
      const userCredential = await signIn(username, password)
      // Merge Firebase user with wallet address
      const userData = await getUserWithWallet(userCredential.user)
      get().setUser(userData)
      set({ authloading: false })
   },
   register: async (username, password) => {
      set({ authloading: true })
      const userCredential = await signUp(username, password)
      // Merge Firebase user with wallet address
      const userData = await getUserWithWallet(userCredential.user)
      get().setUser(userData)
      set({ authloading: false })
   },
   logout: async () => {
      set({ authloading: true });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      set({ user: null });
      set({ authloading: false });
   },
   isAuthenticated: () => {
      return get().user !== null;
   },
   loginWithGoogle: async () => {
      set({ authloading: true })
      const user = await loginWithGoogle()
      // Merge Firebase user with wallet address
      const userData = await getUserWithWallet(user)
      get().setUser(userData)
      set({ authloading: false })
      return userData
   },
   getQuizByUserId: async () => {
      const userId = get().user?.uid
      const data = await getQuizByUserId(userId)
      console.log('data', data)
      const { quizzes, history } = data
      set({ quizzes })
      set({ history })
   },
})
