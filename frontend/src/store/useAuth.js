import login from "@/helpers/auth/signIn"
import loginWithGoogle from "@/helpers/auth/loginWithGoogle"
import getQuizByUserId from "@/helpers/quiz/getQuizByUserId"
import signUp from "@/helpers/auth/signUp"
import signIn from "@/helpers/auth/signIn"

const defaultFirebaseUser = {
   "uid": "@@@",
   "email": "@@@",
   "emailVerified": true,
   "displayName": "No user",
   "isAnonymous": false,
   "photoURL": "default-avatar.jpg",
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
      signIn(username, password)
      await new Promise((resolve) => setTimeout(resolve, 1000));
      set({ authloading: false })
   },
   register: async (username, password) => {
      set({ authloading: true })
      signUp(username, password)
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
      const user = await loginWithGoogle()
      set({ authloading: true })
      get().setUser(user)
      set({ authloading: false })
      return user
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
