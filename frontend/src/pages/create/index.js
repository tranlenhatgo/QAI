import { useEffect } from 'react'
import Head from 'next/head'
import Footer from '@/components/PageFooter'
import CreateQuestions from '@/components/Create/CreateQuestions'
import { useBoundStore } from '@/store/useBoundStore'
import CreateHeader from '@/components/Create/CreateHeader'
import CreateInfo from '@/components/Create/CreateInfo'

export default function Create() {
	const { cleanCreateQuestions } = useBoundStore(state => state)

	useEffect(() => {
		window.onbeforeunload = () => 'Are you sure you want to leave?'
		return () => cleanCreateQuestions()
	}, [])

	return (
		<>
			<Head><title>QAI | Create Quiz</title></Head>

			<div className="coach-page-canvas min-h-screen text-slate-900">
				<CreateHeader />
				<CreateInfo />
				<CreateQuestions />
				<Footer alert={true} />
			</div>
		</>
	)
}

Create.requireAuth = true
