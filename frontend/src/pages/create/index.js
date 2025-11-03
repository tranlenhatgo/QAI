import { useEffect } from 'react'
import Head from 'next/head'
import Footer from '@/components/PageFooter'
import CreateQuestions from '@/components/Create/CreateQuestions'
import { useBoundStore } from '@/store/useBoundStore'
import CreateHeader from '@/components/Create/CreateHeader'
import CreateInfo from '@/components/Create/CreateInfo'
import { useRouter } from 'next/router'

export default function Create() {
	const { cleanCreateQuestions } = useBoundStore(state => state)
	const router = useRouter()

	useEffect(() => {
		if (typeof window !== 'undefined' && !sessionStorage.getItem('user')) {
			router.replace('/')
		}
	}, [])

	useEffect(() => {
		window.onbeforeunload = () => 'Are you sure you want to leave?'
		return () => cleanCreateQuestions
	}, [])

	useEffect(() => {
		document.body.classList.add('bg-vertical-scroll-animation');

		return () => {
			document.body.classList.remove('bg-vertical-scroll-animation');
		};
	}, []);

	return (
		<>
			<Head><title>Quizi | Create</title></Head>

			<CreateHeader />
			<CreateInfo />
			<CreateQuestions />
			<Footer alert={true} />
			<style jsx global>
				{`
					body {
						background: url(bg-profile3.svg) center;
						.background-horizontal-scroll-animation;
					}

					@media (max-width: 1030px) {
						body {
							background-size: auto 100%;
						}
					}
				`}
			</style>
		</>
	)
}
