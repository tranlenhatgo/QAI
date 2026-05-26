export default function MasteryBreakdown({ categories }) {
	if (!categories || categories.length === 0) {
		return (
			<div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-slate-500">
				No category data yet — take some quizzes to see mastery levels.
			</div>
		)
	}

	return (
		<div className="space-y-2">
			{categories
				.sort((a, b) => b.mastery_level - a.mastery_level)
				.map(cat => (
					<MasteryBar key={cat.category} category={cat} />
				))}
		</div>
	)
}

function MasteryBar({ category }) {
	const percent = Math.round(category.mastery_level * 100)
	const barColor = percent >= 90 ? 'bg-emerald-500' : percent >= 70 ? 'bg-blue-500' : percent >= 40 ? 'bg-amber-500' : 'bg-red-500'
	const trendIcon = category.trend === 'improving' ? '↗' : category.trend === 'declining' ? '↘' : '→'
	const trendColor = category.trend === 'improving' ? 'text-green-600' : category.trend === 'declining' ? 'text-red-600' : 'text-slate-400'

	return (
		<div className="flex items-center gap-3">
			<span className="w-24 truncate text-sm font-medium capitalize text-slate-700" title={category.category}>
				{category.category}
			</span>
			<div className="relative h-3 flex-1 overflow-hidden rounded-full bg-gray-200">
				<div
					className={`absolute inset-y-0 left-0 rounded-full ${barColor} transition-all duration-500`}
					style={{ width: `${percent}%` }}
				/>
			</div>
			<span className="w-10 text-right text-xs font-semibold text-slate-700">{percent}%</span>
			<span className={`text-sm ${trendColor}`} title={category.trend}>{trendIcon}</span>
		</div>
	)
}
