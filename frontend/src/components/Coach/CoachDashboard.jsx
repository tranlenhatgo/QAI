import { useEffect } from 'react'
import { useRouter } from 'next/router'
import {
	FiActivity,
	FiHome,
	FiLogIn,
	FiMessageSquare,
	FiPlusCircle,
	FiRefreshCw,
	FiTarget,
	FiUploadCloud,
	FiUser,
	FiZap,
} from 'react-icons/fi'
import DueReviews from './DueReviews'
import EmbeddedChat from './EmbeddedChat'
import GenerateQuestions from './GenerateQuestions'
import MyWeaknesses from './MyWeaknesses'
import NotificationBell from './NotificationBell'
import ProgressOverview from './ProgressOverview'
import StepSolver from './StepSolver'
import StudyMaterials from './StudyMaterials'
import { useBoundStore } from '@/store/useBoundStore'

const COACH_FEATURES = [
	{
		id: 'overview',
		label: 'Overview',
		title: 'Progress overview',
		description: 'Review scores, weak topics, and study momentum.',
		icon: FiActivity,
	},
	{
		id: 'generate',
		label: 'Generate',
		title: 'Question generator',
		description: 'Create practice questions from a topic or selected category.',
		icon: FiPlusCircle,
	},
	{
		id: 'solver',
		label: 'Solver',
		title: 'Step solver',
		description: 'Break a problem into structured solution steps.',
		icon: FiZap,
	},
	{
		id: 'materials',
		label: 'Materials',
		title: 'Study materials',
		description: 'Upload notes and turn them into practice content.',
		icon: FiUploadCloud,
	},
	{
		id: 'weaknesses',
		label: 'Weaknesses',
		title: 'Weak topic focus',
		description: 'Find low-scoring topics and start focused practice.',
		icon: FiTarget,
	},
	{
		id: 'chat',
		label: 'Chat',
		title: 'Coach chat',
		description: 'Ask the AI coach for guidance without leaving the dashboard.',
		icon: FiMessageSquare,
	},
]

export default function CoachDashboard() {
	const router = useRouter()
	const {
		user,
		setDest,
		loadCoachProgress,
		isLoadingProfile,
		coachProgressError,
		activeCoachFeature,
		setActiveCoachFeature,
		coachTier,
		setCoachTier,
	} = useBoundStore(state => state)
	const selectedFeature = COACH_FEATURES.find(feature => feature.id === activeCoachFeature) || COACH_FEATURES[0]

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

	function renderFeature() {
		switch (selectedFeature.id) {
			case 'generate':
				return (
					<div id="coach-generate">
						<GenerateQuestions />
					</div>
				)
			case 'solver':
				return <StepSolver />
			case 'materials':
				return <StudyMaterials />
			case 'weaknesses':
				return <MyWeaknesses />
			case 'chat':
				return <EmbeddedChat />
			case 'overview':
			default:
				return (
					<>
						<NotificationBell />
						<ProgressOverview />
						<DueReviews />
					</>
				)
		}
	}

	return (
		<div className="min-h-screen bg-gray-100 text-slate-900">
			<nav className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
				<div className="mx-auto max-w-7xl px-4 py-3 md:px-8">
					<div className="flex items-center justify-between gap-4">
						<div className="flex min-w-0 items-center gap-3">
							<button
								type="button"
								onClick={() => router.push('/')}
								className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-gray-200 text-slate-700 transition-colors hover:bg-gray-50"
								aria-label="Go home"
							>
								<FiHome />
							</button>
							<div className="min-w-0">
								<h1 className="truncate text-lg font-semibold text-slate-900">AI Coach Dashboard</h1>
								<p className="truncate text-xs text-slate-500">{user ? user.email || user.displayName || 'Signed in' : 'Preview'}</p>
							</div>
						</div>

						<div className="flex flex-shrink-0 items-center gap-2">
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

					<div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						<div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Coach features">
							{COACH_FEATURES.map(feature => {
								const Icon = feature.icon
								const isActive = selectedFeature.id === feature.id
								return (
									<button
										key={feature.id}
										type="button"
										onClick={() => setActiveCoachFeature(feature.id)}
										aria-pressed={isActive}
										className={`inline-flex h-10 flex-shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors ${
											isActive
												? 'border-blue-600 bg-blue-600 text-white shadow-sm'
												: 'border-gray-200 bg-white text-slate-700 hover:bg-gray-50'
										}`}
									>
										<Icon className="text-base" />
										<span>{feature.label}</span>
									</button>
								)
							})}
						</div>

						<div className="flex flex-shrink-0 items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-1">
							<span className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Tier</span>
							{['lite', 'full'].map(tier => {
								const isActive = coachTier === tier
								return (
									<button
										key={tier}
										type="button"
										onClick={() => setCoachTier(tier)}
										aria-pressed={isActive}
										className={`h-8 rounded-md px-3 text-sm font-semibold capitalize transition-colors ${
											isActive
												? 'bg-slate-900 text-white shadow-sm'
												: 'text-slate-600 hover:bg-white'
										}`}
									>
										{tier}
									</button>
								)
							})}
						</div>
					</div>
				</div>
			</nav>

			<main id="coach-workspace" className="mx-auto max-w-7xl px-4 py-5 md:px-8 md:py-6">
				<div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-xs font-semibold uppercase tracking-widest text-slate-500">AI Coach Workspace</p>
						<h2 className="text-2xl font-semibold text-slate-950">{selectedFeature.title}</h2>
						<p className="mt-1 max-w-2xl text-sm text-slate-600">{selectedFeature.description}</p>
					</div>
					<span className="w-fit rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
						{coachTier === 'lite' ? 'Lite tier' : 'Full tier'}
					</span>
				</div>

				{coachProgressError ? (
					<p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{coachProgressError}</p>
				) : null}

				<div className="grid gap-5">{renderFeature()}</div>
			</main>
		</div>
	)
}
