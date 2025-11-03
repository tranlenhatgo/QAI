import { auth } from '@/helpers/auth/firebase'
import { signInWithEmailAndPassword } from 'firebase/auth'

async function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

// export default async function login(username, password) {
//     try {
//         const response = await fetch('/api/auth/login', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//             },
//             body: JSON.stringify({ username, password }), // Send username and password
//         });

//         if (!response.ok) {
//             const errorData = await response.json();
//             console.error('Error from /api/auth/login:', errorData.message);
//             throw new Error(errorData.message || 'Failed to log in');
//         }

//         const { token, user } = await response.json(); // Extract token and user info
//         return { token, user }; // Return the token and user data
//     } catch (error) {
//         console.error('Error in login helper:', error);
//         throw error;
//     }
// }