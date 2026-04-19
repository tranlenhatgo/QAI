import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useBoundStore } from '@/store/useBoundStore'
import PageLoading from '@/components/PageLoading'

export default function RequireAuth({ children }) {
   const router = useRouter()
   const { user, authReady } = useBoundStore(state => state)

   useEffect(() => {
      if (authReady && !user) {
         router.replace('/')
      }
   }, [authReady, user, router])

   if (!authReady || !user) {
      return <PageLoading />
   }

   return children
}
