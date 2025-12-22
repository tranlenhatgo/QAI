import { auth } from '@/helpers/auth/firebase'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { createUserWallet } from '@/helpers/wallet/walletinit'

export default async function signUp(email, password) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const wallet = await createUserWallet(userCredential.user);
  return { userCredential, wallet };
}
