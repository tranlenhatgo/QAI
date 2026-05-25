import { FiActivity, FiAward, FiTarget } from 'react-icons/fi'
import categoriesJSON from '@/assets/categories.json'
import { useBoundStore } from '@/store/useBoundStore'

function getCategory(categoryName) {
	return categoriesJSON.find(category => category.name === categoryName) || categoriesJSON[categoriesJSON.length - 1]
}

function TrendChart({ items }) {
	const chartItems = items.slice(-8)
	const points = chartItems.map((item, index) => {
		const x = chartItems.length === 1 ? 50 : (index / (chartItems.length - 1)) * 100
		const y = 100 - item.percent
		return `${x},${y}`
	}).join(' ')

	if (chartItems.length === 0) {
		return (
			<div className="flex h-40 items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-sm text-slate-500">
				No score history
			</div>
		)
	}

	return (
		<div className="h-40 rounded-md border border-gray-200 bg-white p-3">
			<svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
				<polyline points="0,100 100,100" fill="none" stroke="#e5e7eb" strokeWidth="1" />
				<polyline points="0,75 100,75" fill="none" stroke="#f1f5f9" strokeWidth="1" />
				<polyline points="0,50 100,50" fill="none" stroke="#f1f5f9" strokeWidth="1" />
				<polyline points="0,25 100,25" fill="none" stroke="#f1f5f9" strokeWidth="1" />
				<polyline points={points} fill="none" stroke="#2563eb" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
				{chartItems.map((item, index) => {
					const x = chartItems.length === 1 ? 50 : (index / (chartItems.length - 1)) * 100
					const y = 100 - item.percent
					return (
						<circle key={item.id} cx={x} cy={y} r="2.5" fill="#0f172a">
							<title>{`${item.title}: ${item.score}`}</title>
						</circle>
					)
				})}
			</svg>
		</div>
	)
}

export default function ProgressOverview() {
	const { user, scoreHistory, weaknesses, streak, isLoadingProfile } = useBoundStore(state => state)
	const latestScore = scoreHistory[scoreHistory.length - 1]
	const topWeaknesses = weaknesses.slice(0, 3)

	function scrollToWeaknesses() {
		document.getElementById('coach-weaknesses')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
	}

	return (
		<section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:p-5">
			<div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div>
					<p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Progress Overview</p>
					<h2 className="text-xl font-semibold text-slate-900">{user ? 'Study performance' : 'Preview mode'}</h2>
				</div>
				<div className="grid grid-cols-3 gap-2 text-center">
					<div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
						<FiActivity className="mx-auto text-blue-600" />
						<p className="mt-1 text-lg font-semibold text-slate-900">{latestScore ? `${latestScore.percent}%` : '-'}</p>
						<p className="text-[11px] uppercase tracking-wider text-slate-500">Latest</p>
					</div>
					<div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
						<FiTarget className="mx-auto text-rose-600" />
						<p className="mt-1 text-lg font-semibold text-slate-900">{weaknesses.length}</p>
						<p className="text-[11px] uppercase tracking-wider text-slate-500">Topics</p>
					</div>
					<div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
						<FiAward className="mx-auto text-emerald-600" />
						<p className="mt-1 text-lg font-semibold text-slate-900">{streak}</p>
						<p className="text-[11px] uppercase tracking-wider text-slate-500">Streak</p>
					</div>
				</div>
			</div>

			<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
				<TrendChart items={scoreHistory} />

				<div className="rounded-md border border-gray-200 bg-gray-50 p-3">
					<div className="mb-3 flex items-center justify-between gap-3">
						<p className="text-sm font-semibold text-slate-800">Weak Topics</p>
						<button
							type="button"
							onClick={scrollToWeaknesses}
							className="rounded-md px-2 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50"
						>
							View
						</button>
					</div>
					<div className="space-y-2">
						{isLoadingProfile ? (
							<p className="rounded-md border border-gray-200 bg-white px-3 py-4 text-sm text-slate-500">Loading profile...</p>
						) : topWeaknesses.length > 0 ? topWeaknesses.map(item => {
							const category = getCategory(item.category)
							return (
								<div key={item.category} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2">
									<div className="flex items-center gap-2">
										<span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
										<span className="text-sm font-medium text-slate-800">{item.category}</span>
									</div>
									<span className="text-sm font-semibold text-slate-900">{item.avgScore}%</span>
								</div>
							)
						}) : (
							<p className="rounded-md border border-gray-200 bg-white px-3 py-4 text-sm text-slate-500">
								{user ? 'No completed attempts yet.' : 'Sign in to load progress.'}
							</p>
						)}
					</div>
				</div>
			</div>
		</section>
	)
}
