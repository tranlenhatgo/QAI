import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyASy5ZI1DE7vmETU9Q340IGF6CsPVY89Zo",
  authDomain: "quizzai-bc49d.firebaseapp.com",
  projectId: "quizzai-bc49d",
  storageBucket: "quizzai-bc49d.firebasestorage.app",
  messagingSenderId: "923035798499",
  appId: "1:923035798499:web:3c525b16984f2fb26f2ed6",
  measurementId: "G-CTB07BHLL6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider };
