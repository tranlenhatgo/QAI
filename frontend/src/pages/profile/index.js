import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useBoundStore } from '@/store/useBoundStore'
import ProfileHeader from '@/components/Profile/ProfileHeader'
import PageLoading from '@/components/PageLoading'
import ProfileInfo from '@/components/Profile/ProfileInfo'
import QuizHistory from '@/components/Profile/QuizHistory'
import PageFooter from '@/components/PageFooter'
import playSound from '@/helpers/playSound'
import { useRouter } from 'next/router'

export default function Profile() {
	const { user, logout, authloading, getQuizByUserId } = useBoundStore(state => state)
	const [quizzesLoading, setQuizzesLoading] = useState(true)
	const router = useRouter()

	useEffect(() => { window.onbeforeunload = () => null }, [])
	useEffect(() => {
		let active = true
		async function loadData() {
			setQuizzesLoading(true)
			try {
				await getQuizByUserId()
			} catch (error) {
				console.error("Failed to load quizzes:", error)
			} finally {
				if (active) setQuizzesLoading(false)
			}
		}
		loadData()
		return () => { active = false }
	}, [getQuizByUserId])

	function handleLogout() {
		playSound('pop-down');
		logout().then(() => {
			router.push('/');
		});
	}

	const isLoading = authloading || quizzesLoading

	return (
		<>
			<Head>
				<title>QAI | Profile</title>
			</Head>
			<PageLoading visible={isLoading} />
			{!isLoading && <>
				<ProfileHeader />
				<main className='pt-6 pb-12'>
					<div className='max-w-7xl mx-auto px-4 md:px-8'>
						{/* 2-Column Layout: Profile Card (Left) + Quiz History (Right) */}
						<div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
							{/* Profile Info Card - Sticky on Desktop */}
							<div className='lg:col-span-1 h-fit lg:sticky lg:top-24'>
								<ProfileInfo user={user} logout={handleLogout} />
							</div>

							{/* Quiz History - Main Content */}
							<div className='lg:col-span-2'>
								<QuizHistory />
							</div>
						</div>
					</div>
				</main>
				<PageFooter />
			</>
			}
		</>
	)
}

Profile.requireAuth = true
