import { useBoundStore } from '@/store/useBoundStore'

export default function ReviewCard({ item }) {
	const { startReview } = useBoundStore(state => state)
	const isOverdue = item.daysOverdue > 0
	const borderColor = isOverdue ? 'border-red-300' : 'border-amber-300'
	const bgColor = isOverdue ? 'bg-red-50' : 'bg-amber-50'

	return (
		<div className={`flex min-w-[9rem] flex-shrink-0 flex-col rounded-md border ${borderColor} ${bgColor} p-3`}>
			<div className="flex items-center gap-1.5">
				<span className={`h-2 w-2 rounded-full ${isOverdue ? 'bg-red-500' : 'bg-amber-500'}`} />
				<span className="text-sm font-semibold capitalize text-slate-800">{item.category}</span>
			</div>

			<p className={`mt-1 text-xs ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
				{isOverdue ? `Overdue ${Math.round(item.daysOverdue)}d` : 'Due today'}
			</p>

			{item.lastScore != null && (
				<p className="mt-0.5 text-xs text-slate-500">
					Last: {Math.round(item.lastScore * 100)}%
				</p>
			)}

			<button
				type="button"
				onClick={() => startReview(item.category)}
				className="mt-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
			>
				Review
			</button>
		</div>
	)
}
