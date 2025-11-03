import '@/styles/globals.css'
import { Rubik } from 'next/font/google'
import Head from 'next/head'
import AuthForm from './../components/Form/AuthForm';
import PlayForm from '@/components/Form/PlayForm';
import CreateQuizRoomForm from '@/components/Form/CreateQuizRoomForm';
import { useBoundStore } from '@/store/useBoundStore';
import { useEffect } from 'react';
const rubik = Rubik({ subsets: ['latin'] })

export default function App({ Component, pageProps }) {
	const { user, setUser } = useBoundStore(state => state);
	useEffect(() => {
		if (user && sessionStorage.getItem('user')) {
			const user = JSON.parse(sessionStorage.getItem('user'));
			setUser(user);
		}
	}, []);
	return (
		<>
			<Head>
				<meta name="viewport" content="width=device-width, initial-scale=1" />
			</Head>
			<Component {...pageProps} />
			<PlayForm />
			<AuthForm />
			<CreateQuizRoomForm />
			<style jsx global>{`
        html {
          font-family: ${rubik.style.fontFamily};
        }
      `}</style>
		</>
	)
}
