import { useEffect, useState } from 'react'
import { FiActivity, FiAward, FiTarget } from 'react-icons/fi'
import categoriesJSON from '@/assets/categories.json'
import { useBoundStore } from '@/store/useBoundStore'
import MasteryBreakdown from './MasteryBreakdown'

function getCategory(categoryName) {
	return categoriesJSON.find(category => category.name === categoryName) || categoriesJSON[categoriesJSON.length - 1]
}

function formatDate(dateStr) {
	if (!dateStr) return ''
	const parts = dateStr.split('-')
	return parts.length >= 3 ? `${parts[2]}/${parts[1]}` : ''
}

function TrendChart({ items }) {
	const [hovered, setHovered] = useState(null)
	const chartItems = items.slice(-8)
	const padX = 10
	const padTop = 18
	const padBottom = 45
	const vW = 500
	const vH = 210
	const chartW = vW - padX * 2
	const chartH = vH - padTop - padBottom

	const points = chartItems.map((item, index) => {
		const x = padX + (chartItems.length === 1 ? chartW / 2 : (index / (chartItems.length - 1)) * chartW)
		const y = padTop + (1 - item.percent / 100) * chartH
		return `${x},${y}`
	}).join(' ')

	if (chartItems.length === 0) {
		return (
			<div className="flex h-64 items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-sm text-slate-500">
				No score history
			</div>
		)
	}

	return (
		<div className="relative h-64 overflow-visible rounded-md border border-gray-200 bg-white">
			{/* Y-axis labels as HTML (no SVG distortion) */}
			<span className="absolute left-1 text-xs text-slate-400" style={{ top: '10%' }}>100</span>
			<span className="absolute left-1 text-xs text-slate-400" style={{ top: '45%' }}>50</span>
			<span className="absolute left-1 text-xs text-slate-400" style={{ top: '78%' }}>0</span>
			{/* Hover tooltip */}
			{hovered && (
				<div
					className="pointer-events-none absolute z-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg"
					style={{ left: `${hovered.px}%`, top: `${Math.min(hovered.py + 5, 70)}%`, transform: 'translate(-50%, 0)' }}
				>
					<p className="font-semibold text-slate-800">{hovered.title}</p>
					<p className="text-slate-500">Score: <span className="font-medium text-slate-700">{hovered.score}</span> ({hovered.percent}%)</p>
					<p className="text-slate-500">Category: <span className="font-medium text-slate-700">{hovered.category}</span></p>
					<p className="text-slate-400">{hovered.date}</p>
				</div>
			)}
			{/* Chart SVG */}
			<svg viewBox={`0 0 ${vW} ${vH}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full pl-6">
				{/* Grid lines */}
				<line x1={padX} y1={padTop} x2={vW - padX} y2={padTop} stroke="#e5e7eb" strokeWidth="0.5" />
				<line x1={padX} y1={padTop + chartH / 2} x2={vW - padX} y2={padTop + chartH / 2} stroke="#f1f5f9" strokeWidth="0.5" />
				<line x1={padX} y1={padTop + chartH} x2={vW - padX} y2={padTop + chartH} stroke="#e5e7eb" strokeWidth="0.5" />
				{/* Line */}
				<polyline points={points} fill="none" stroke="#2563eb" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
				{/* Nodes, dates at top, quiz names at bottom */}
				{chartItems.map((item, index) => {
					const x = padX + (chartItems.length === 1 ? chartW / 2 : (index / (chartItems.length - 1)) * chartW)
					const y = padTop + (1 - item.percent / 100) * chartH
					const dateLabel = formatDate(item.date)
					const px = (x / vW) * 100
					const py = (y / vH) * 100
					return (
						<g key={item.id}>
							{/* Invisible larger hit area for hover */}
							<circle
								cx={x} cy={y} r="14" fill="transparent" stroke="none"
								style={{ cursor: 'pointer' }}
								onMouseEnter={() => setHovered({ ...item, px, py, date: dateLabel })}
								onMouseLeave={() => setHovered(null)}
							/>
							<circle
								cx={x} cy={y} r="4" fill={hovered?.id === item.id ? '#2563eb' : '#fff'} stroke="#2563eb" strokeWidth="1.8"
								style={{ cursor: 'pointer', pointerEvents: 'none' }}
							/>
							<text x={x} y="7" fontSize="7" fill="#94a3b8" textAnchor="middle">{dateLabel}</text>
							<text x={x} y={padTop + chartH + 14} fontSize="8" fontWeight="600" fill="#334155" textAnchor="middle" transform={`rotate(-25, ${x}, ${padTop + chartH + 14})`}>{item.title}</text>
						</g>
					)
				})}
			</svg>
		</div>
	)
}

export default function ProgressOverview() {
	const { user, scoreHistory, weaknesses, streak, isLoadingProfile, setActiveCoachFeature, progressData, fetchProgress } = useBoundStore(state => state)
	const latestScore = scoreHistory[scoreHistory.length - 1]
	const topWeaknesses = weaknesses.filter(w => w.avgScore < 80).slice(0, 3)

	useEffect(() => {
		if (user?.uid) fetchProgress(user.uid)
	}, [user?.uid, fetchProgress])

	function openWeaknesses() {
		setActiveCoachFeature('weaknesses')
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

			<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
				<TrendChart items={scoreHistory} />

				<div className="rounded-md border border-gray-200 bg-gray-50 p-3">
					<div className="mb-3 flex items-center justify-between gap-3">
						<p className="text-sm font-semibold text-slate-800">Weak Topics</p>
						<button
							type="button"
							onClick={openWeaknesses}
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

			{progressData?.categories?.length > 0 && (
				<div className="mt-4">
					<p className="mb-2 text-sm font-semibold text-slate-800">Mastery by Category</p>
					<MasteryBreakdown categories={progressData.categories} />
				</div>
			)}
		</section>
	)
}
