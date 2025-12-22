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
			
			{/* Two-column responsive layout */}
			<div className="container mx-auto px-4 py-6">
				<div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
					{/* Main area - Question creator */}
					<div className="order-2 xl:order-1">
						<CreateQuestions />
					</div>
					
					{/* Sidebar - Quiz details */}
					<div className="order-1 xl:order-2">
						<CreateInfo />
					</div>
				</div>
			</div>
			
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
