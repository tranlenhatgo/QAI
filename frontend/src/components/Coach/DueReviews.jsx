import { useEffect, useState } from 'react'
import { FiBell, FiCheck, FiClock, FiInfo } from 'react-icons/fi'
import { useBoundStore } from '@/store/useBoundStore'
import ReviewCard from './ReviewCard'

export default function DueReviews() {
	const { user, dueReviews, upcomingReviews, isLoadingReviews, fetchDueReviews } = useBoundStore(state => state)
	const [showTooltip, setShowTooltip] = useState(false)

	useEffect(() => {
		if (user?.uid) {
			fetchDueReviews(user.uid)
		}
	}, [user?.uid, fetchDueReviews])

	if (isLoadingReviews) {
		return (
			<section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:p-5">
				<p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Due Reviews</p>
				<div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
					<div className="h-full animate-pulse rounded-full bg-blue-500" style={{ width: '60%' }} />
				</div>
			</section>
		)
	}

	if (!dueReviews.length && !upcomingReviews.length) {
		return null
	}

	return (
		<section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:p-5">
			<div className="mb-3 flex items-center gap-2">
				<FiBell className="text-amber-500" />
				<p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Due Reviews</p>
				{dueReviews.length > 0 && (
					<span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
						{dueReviews.length} due
					</span>
				)}
				<div className="relative ml-auto">
					<button
						type="button"
						className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-slate-400 transition-colors hover:border-blue-400 hover:text-blue-500"
						onMouseEnter={() => setShowTooltip(true)}
						onMouseLeave={() => setShowTooltip(false)}
						onClick={() => setShowTooltip(!showTooltip)}
						aria-label="How spaced repetition works"
					>
						<FiInfo size={12} />
					</button>
					{showTooltip && (
						<div className="absolute right-0 top-7 z-10 w-64 rounded-lg border border-gray-200 bg-white p-3 text-xs text-slate-600 shadow-lg">
							<p className="mb-1 font-semibold text-slate-800">How it works</p>
							<p>After each quiz, the system schedules your next review using the SM-2 algorithm. Topics you score well on are reviewed less often, while weak topics come back sooner — helping you remember more with less effort.</p>
						</div>
					)}
				</div>
			</div>

			{dueReviews.length > 0 ? (
				<div className="flex gap-3 overflow-x-auto pb-2">
					{dueReviews.map(item => (
						<ReviewCard key={item.category} item={item} />
					))}
				</div>
			) : (
				<div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3">
					<FiCheck className="text-green-600" />
					<span className="text-sm font-medium text-green-700">You&apos;re all caught up!</span>
				</div>
			)}

			{upcomingReviews.length > 0 && (
				<div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
					<FiClock className="text-slate-400" />
					<span>
						Next: <strong>{upcomingReviews[0].category}</strong> due soon
					</span>
				</div>
			)}
		</section>
	)
}
