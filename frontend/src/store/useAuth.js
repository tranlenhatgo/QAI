import loginWithGoogle from "@/helpers/auth/loginWithGoogle"
import getQuizByUserId from "@/helpers/quiz/getQuizByUserId"
import signUp from "@/helpers/auth/signUp"
import signIn from "@/helpers/auth/signIn"
import { signOut } from 'firebase/auth'
import { auth } from '@/helpers/auth/firebase'

async function setAuthCookieFromUser(user) {
   if (!user) return
   const token = await user.getIdToken()
   await fetch('/api/auth/set-token', {
      method: 'POST',
      headers: {
         'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
   })
}

export const useAuthStore = (set, get) => ({
   user: null,
   quizzes: [],
   history: [],
   hostId: null,
   authReady: false,
   authloading: false,
   dest: null,
   setDest: (dest) => {
      set({ dest })
   },
   setUser: (user) => {
      set({ user })
   },
   setAuthReady: (authReady) => {
      set({ authReady })
   },
   login: async (email, password) => {
      set({ authloading: true })
      try {
         const credential = await signIn(email, password)
         set({ user: credential.user })
         await setAuthCookieFromUser(credential.user)
         return credential.user
      } finally {
         set({ authloading: false })
      }
   },
   register: async (email, password, displayName) => {
      set({ authloading: true })
      try {
         const credential = await signUp(email, password, displayName)
         set({ user: credential.user })
         await setAuthCookieFromUser(credential.user)
         return credential.user
      } finally {
         set({ authloading: false })
      }
   },
   logout: async () => {
      set({ authloading: true });
      try {
         await signOut(auth)
         await fetch('/api/auth/clear-token', { method: 'POST' })
         set({ user: null })
      } finally {
         set({ authloading: false })
      }
   },
   isAuthenticated: () => {
      return !!get().user;
   },
   loginWithGoogle: async () => {
      set({ authloading: true })
      try {
         const user = await loginWithGoogle()
         get().setUser(user)
         return user
      } finally {
         set({ authloading: false })
      }
   },
   getQuizByUserId: async () => {
      const userId = get().user?.uid
      if (!userId) {
         set({ quizzes: [], history: [] })
         return
      }
      const data = await getQuizByUserId(userId)
      const { quizzes, history } = data
      set({ quizzes })
      set({ history })
   },
})
