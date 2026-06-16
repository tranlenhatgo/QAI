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
import SubscriptionRequiredModal from '@/components/SubscriptionRequiredModal';
import { shallow } from 'zustand/shallow';
const rubik = Rubik({ subsets: ['latin'] })

function isFirstFirebaseSignIn(firebaseUser) {
	const createdAt = new Date(firebaseUser?.metadata?.creationTime).getTime()
	const lastSignInAt = new Date(firebaseUser?.metadata?.lastSignInTime).getTime()
	return Number.isFinite(createdAt) && Number.isFinite(lastSignInAt) && Math.abs(lastSignInAt - createdAt) < 5000
}

export default function App({ Component, pageProps }) {
	const { user, setUser, setAuthReady, setChatConfig, hydrateChat, loadUserDocuments, loadSubscriptionForUser, createLiteSubscriptionForNewUser, resetSubscription } = useBoundStore(state => ({
		user: state.user,
		setUser: state.setUser,
		setAuthReady: state.setAuthReady,
		setChatConfig: state.setChatConfig,
		hydrateChat: state.hydrateChat,
		loadUserDocuments: state.loadUserDocuments,
		loadSubscriptionForUser: state.loadSubscriptionForUser,
		createLiteSubscriptionForNewUser: state.createLiteSubscriptionForNewUser,
		resetSubscription: state.resetSubscription,
	}), shallow);
	const studyCoachHiddenPaths = ['/', '/chat', '/play', '/coach', '/payment'];
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
					if (isFirstFirebaseSignIn(firebaseUser)) {
						await createLiteSubscriptionForNewUser(firebaseUser.uid)
					} else {
						await loadSubscriptionForUser(firebaseUser.uid)
					}
					loadUserDocuments()
				} else {
					await fetch('/api/auth/clear-token', { method: 'POST' })
					resetSubscription()
				}
			} catch (error) {
				console.error('Failed to sync auth token cookie', error)
			} finally {
				setAuthReady(true);
			}
		});

		return () => unsubscribe();
	}, [setUser, setAuthReady, loadUserDocuments, loadSubscriptionForUser, createLiteSubscriptionForNewUser, resetSubscription]);

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
			<SubscriptionRequiredModal />
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
