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
		requestCoachTier,
	} = useBoundStore(state => state)
	const selectedFeature = COACH_FEATURES.find(feature => feature.id === activeCoachFeature) || COACH_FEATURES[0]
	const SelectedIcon = selectedFeature.icon
	const userLabel = user ? user.email || user.displayName || 'Signed in' : 'Preview'

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
		<div className="coach-page-canvas min-h-screen text-slate-900">
			<nav className="coach-shell sticky top-0 z-40 overflow-hidden border-b border-blue-300/20 text-white shadow-xl">
				<div className="mx-auto max-w-7xl px-4 py-3 md:px-8">
					<div className="flex items-center justify-between gap-4">
						<div className="flex min-w-0 items-center gap-3">
							<button
								type="button"
								onClick={() => router.push('/')}
								className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-white/25 bg-white text-slate-900 shadow-[0_3px_0_rgba(37,99,235,0.45)] transition-all hover:-translate-y-0.5 hover:bg-blue-50 active:translate-y-0 active:shadow-none"
								aria-label="Go home"
							>
								<FiHome />
							</button>
							<div className="min-w-0">
								<h1 className="truncate text-xl font-bold tracking-wide text-white">AI Coach Dashboard</h1>
								<p className="truncate text-xs font-medium text-blue-100">{userLabel}</p>
							</div>
						</div>

						<div className="flex flex-shrink-0 items-center gap-2">
							<button
								type="button"
								onClick={loadCoachProgress}
								disabled={isLoadingProfile}
								className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white transition-all hover:-translate-y-0.5 hover:bg-white/20 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
								aria-label="Refresh progress"
							>
								<FiRefreshCw className={isLoadingProfile ? 'animate-spin' : ''} />
							</button>
							{user ? (
								<button
									type="button"
									onClick={() => router.push('/profile')}
									className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-[0_3px_0_rgba(37,99,235,0.45)] transition-all hover:-translate-y-0.5 hover:bg-blue-50 active:translate-y-0 active:shadow-none"
								>
									<FiUser />
									<span className="hidden sm:inline">Profile</span>
								</button>
							) : (
								<button
									type="button"
									onClick={handleSignIn}
									className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-white px-3 py-2 text-sm font-bold text-blue-700 shadow-[0_3px_0_rgba(37,99,235,0.45)] transition-all hover:-translate-y-0.5 hover:bg-blue-50 active:translate-y-0 active:shadow-none"
								>
									<FiLogIn />
									<span>Sign in</span>
								</button>
							)}
						</div>
					</div>

					<div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						<div className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1" aria-label="Coach features">
							{COACH_FEATURES.map(feature => {
								const Icon = feature.icon
								const isActive = selectedFeature.id === feature.id
								return (
									<button
										key={feature.id}
										type="button"
										onClick={() => setActiveCoachFeature(feature.id)}
										aria-pressed={isActive}
										className={`inline-flex h-10 flex-shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-bold transition-all active:translate-y-0 ${
											isActive
												? 'border-blue-200 bg-blue-500 text-white shadow-[0_4px_0_#1d4ed8]'
												: 'border-white/15 bg-white/10 text-blue-50 hover:-translate-y-0.5 hover:bg-white/20'
										}`}
									>
										<Icon className="text-base" />
										<span>{feature.label}</span>
									</button>
								)
							})}
						</div>

						<div className="flex w-fit flex-shrink-0 items-center gap-2 rounded-md border border-white/20 bg-white/10 p-1">
							<span className="px-2 text-xs font-bold uppercase tracking-wider text-blue-100">Tier</span>
							{['lite', 'full'].map(tier => {
								const isActive = coachTier === tier
								const activeTierClassName = tier === 'full'
									? 'border border-violet-300/70 bg-gradient-to-r from-slate-900 via-indigo-900 to-violet-800 text-violet-50 shadow-[0_3px_0_#4c1d95] ring-1 ring-violet-200/40'
									: 'bg-emerald-500 text-white shadow-[0_3px_0_#047857]'
								const inactiveTierClassName = tier === 'full'
									? 'border border-violet-300/45 bg-violet-300/10 text-violet-100 hover:bg-violet-300/20 hover:text-white'
									: 'text-blue-100 hover:bg-white/15 hover:text-white'
								return (
									<button
										key={tier}
										type="button"
										onClick={() => requestCoachTier(tier)}
										aria-pressed={isActive}
										className={`h-8 rounded-md px-3 text-sm font-bold capitalize transition-all ${
											isActive
												? activeTierClassName
												: inactiveTierClassName
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

			<main id="coach-workspace" className="coach-workspace mx-auto max-w-7xl px-4 py-5 md:px-8 md:py-6">
				<div className="mb-5 flex flex-col gap-3 rounded-md border-2 border-blue-100 bg-white px-4 py-4 shadow-[0_4px_0_#dbeafe] md:flex-row md:items-center md:justify-between md:px-5">
					<div className="flex min-w-0 items-center gap-3">
						<div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-blue-600 text-2xl text-white shadow-[0_4px_0_#1d4ed8]">
							<SelectedIcon />
						</div>
						<div className="min-w-0">
							<p className="text-xs font-bold uppercase tracking-widest text-blue-700">AI Coach Workspace</p>
							<h2 className="truncate text-2xl font-bold text-slate-900">{selectedFeature.title}</h2>
							<p className="mt-1 max-w-2xl text-sm text-slate-600">{selectedFeature.description}</p>
						</div>
					</div>
					<span className={`w-fit rounded-md border px-3 py-2 text-xs font-bold uppercase tracking-wider ${
						coachTier === 'full'
							? 'border-violet-300 bg-gradient-to-r from-slate-900 via-indigo-900 to-violet-800 text-violet-50 shadow-[0_3px_0_#4c1d95] ring-1 ring-violet-200/40'
							: 'border-emerald-200 bg-emerald-50 text-emerald-700'
					}`}>
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
