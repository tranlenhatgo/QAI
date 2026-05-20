import { auth } from '@/helpers/auth/firebase'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'

export default async function signUp(email, password, displayName) {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  if (displayName) {
    await updateProfile(credential.user, { displayName })
  }
  return credential
}
