import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { FiHome, FiLogIn, FiRefreshCw, FiUser } from 'react-icons/fi'
import EmbeddedChat from './EmbeddedChat'
import GenerateQuestions from './GenerateQuestions'
import MyWeaknesses from './MyWeaknesses'
import ProgressOverview from './ProgressOverview'
import StepSolver from './StepSolver'
import StudyMaterials from './StudyMaterials'
import { useBoundStore } from '@/store/useBoundStore'

export default function CoachDashboard() {
	const router = useRouter()
	const {
		user,
		setDest,
		loadCoachProgress,
		isLoadingProfile,
		coachProgressError,
	} = useBoundStore(state => state)

	useEffect(() => {
		window.onbeforeunload = () => null
	}, [])

	useEffect(() => {
		loadCoachProgress()
	}, [user?.uid, loadCoachProgress])

	function handleSignIn() {
		setDest('coach')
		document.getElementById('authDialog')?.showModal()
	}

	return (
		<div className="min-h-screen bg-gray-100 text-slate-900">
			<nav className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
				<div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={() => router.push('/')}
							className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 text-slate-700 transition-colors hover:bg-gray-50"
							aria-label="Go home"
						>
							<FiHome />
						</button>
						<div>
							<h1 className="text-lg font-semibold text-slate-900">AI Coach Dashboard</h1>
							<p className="text-xs text-slate-500">{user ? user.email || user.displayName || 'Signed in' : 'Preview'}</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={loadCoachProgress}
							disabled={isLoadingProfile}
							className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 text-slate-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
							aria-label="Refresh progress"
						>
							<FiRefreshCw className={isLoadingProfile ? 'animate-spin' : ''} />
						</button>
						{user ? (
							<button
								type="button"
								onClick={() => router.push('/profile')}
								className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-gray-50"
							>
								<FiUser />
								<span className="hidden sm:inline">Profile</span>
							</button>
						) : (
							<button
								type="button"
								onClick={handleSignIn}
								className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
							>
								<FiLogIn />
								<span>Sign in</span>
							</button>
						)}
					</div>
				</div>
			</nav>

			<main className="mx-auto max-w-7xl px-4 py-5 md:px-8 md:py-6">
				{coachProgressError ? (
					<p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{coachProgressError}</p>
				) : null}

				<div className="grid gap-5">
					<ProgressOverview />

					<div className="grid gap-5 lg:grid-cols-2">
						<div id="coach-generate">
							<GenerateQuestions />
						</div>
						<StepSolver />
					</div>

					<div className="grid gap-5 lg:grid-cols-2">
						<StudyMaterials />
						<MyWeaknesses />
					</div>

					<EmbeddedChat />
				</div>
			</main>
		</div>
	)
}
