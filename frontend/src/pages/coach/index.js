import Head from 'next/head'
import CoachDashboard from '@/components/Coach/CoachDashboard'

export default function CoachPage() {
	return (
		<>
			<Head>
				<title>QAI | AI Coach</title>
			</Head>
			<CoachDashboard />
		</>
	)
}
