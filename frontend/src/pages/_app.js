import '@/styles/globals.css'
import { Rubik } from 'next/font/google'
import Head from 'next/head'
import Script from 'next/script'
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
			try {
				const user = JSON.parse(sessionStorage.getItem('user'));
				setUser(user);
			} catch {}
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
			<Script id="study-coach-config" strategy="afterInteractive">
				{`window.STUDY_COACH_CONFIG = {
					userId: "${user?.uid || 'anonymous'}",
					serverUrl: "ws://localhost:8000/ws/chat"
				};`}
			</Script>
			<Script src="http://localhost:8000/static/widget.js" strategy="afterInteractive" />
			<style jsx global>{`
        html {
          font-family: ${rubik.style.fontFamily};
        }
      `}</style>
		</>
	)
}
