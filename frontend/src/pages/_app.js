import '@/styles/globals.css'
import { Rubik } from 'next/font/google'
import Head from 'next/head'
import AuthForm from './../components/Form/AuthForm';
import PlayForm from '@/components/Form/PlayForm';
import CreateQuizRoomForm from '@/components/Form/CreateQuizRoomForm';
import { useBoundStore } from '@/store/useBoundStore';
import { useEffect } from 'react';
import { auth } from '@/helpers/auth/firebase';
import { onIdTokenChanged } from 'firebase/auth';
import RequireAuth from '@/components/Auth/RequireAuth';
import StudyCoachWidget from '@/components/Chat/StudyCoachWidget';
const rubik = Rubik({ subsets: ['latin'] })

export default function App({ Component, pageProps }) {
	const { user, setUser, setAuthReady, setChatConfig, hydrateChat, loadUserDocuments } = useBoundStore(state => state);
	const studyCoachHiddenPaths = ['/', '/chat', '/play', '/coach'];
	const studyCoachServerUrl = process.env.NEXT_PUBLIC_STUDY_COACH_API_URL || 'http://localhost:8000'
	
	useEffect(() => {
		const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
			setUser(firebaseUser ?? null);
			try {
				if (firebaseUser) {
					const token = await firebaseUser.getIdToken()
					await fetch('/api/auth/set-token', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ token }),
					})
					loadUserDocuments()
				} else {
					await fetch('/api/auth/clear-token', { method: 'POST' })
				}
			} catch (error) {
				console.error('Failed to sync auth token cookie', error)
			} finally {
				setAuthReady(true);
			}
		});

		return () => unsubscribe();
	}, [setUser, setAuthReady, loadUserDocuments]);

	useEffect(() => {
		setChatConfig({
			userId: user?.uid ?? 'anonymous',
			serverUrl: studyCoachServerUrl,
			transport: 'websocket',
			hiddenPaths: studyCoachHiddenPaths,
		})
		hydrateChat()
	}, [user?.uid, setChatConfig, hydrateChat, studyCoachServerUrl])

	const content = Component.requireAuth ? (
		<RequireAuth>
			<Component {...pageProps} />
		</RequireAuth>
	) : (
		<Component {...pageProps} />
	);

	return (
		<>
			<Head>
				<meta name="viewport" content="width=device-width, initial-scale=1" />
			</Head>
			{content}
			<StudyCoachWidget />
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
