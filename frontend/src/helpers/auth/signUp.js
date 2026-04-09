import { auth } from '@/helpers/auth/firebase'
import { createUserWithEmailAndPassword } from 'firebase/auth'

export default async function signUp(email, password) {
  return createUserWithEmailAndPassword(auth, email, password)
}
