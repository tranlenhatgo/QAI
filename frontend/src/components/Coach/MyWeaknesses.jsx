import Image from 'next/image'
import { FiTarget } from 'react-icons/fi'
import categoriesJSON from '@/assets/categories.json'
import { useBoundStore } from '@/store/useBoundStore'

function getCategory(categoryName) {
	return categoriesJSON.find(category => category.name === categoryName) || categoriesJSON[categoriesJSON.length - 1]
}

function scoreTone(score) {
	if (score < 50) return 'border-rose-200 bg-rose-50 text-rose-700'
	if (score < 75) return 'border-amber-200 bg-amber-50 text-amber-700'
	return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

export default function MyWeaknesses() {
	const {
		user,
		setDest,
		weaknesses,
		isLoadingProfile,
		practiceTopic,
		isGenerating,
	} = useBoundStore(state => state)

	async function handlePractice(category) {
		if (!user) {
			setDest('coach')
			document.getElementById('authDialog')?.showModal()
			return
		}
		await practiceTopic(category)
		document.getElementById('coach-generate')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
	}

	return (
		<section id="coach-weaknesses" className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:p-5">
			<div className="mb-4 flex items-center justify-between gap-3">
				<div>
					<p className="text-xs font-semibold uppercase tracking-widest text-slate-500">My Weaknesses</p>
					<h2 className="text-xl font-semibold text-slate-900">Topic focus</h2>
				</div>
				<FiTarget className="text-xl text-rose-600" />
			</div>

			{isLoadingProfile ? (
				<div className="grid gap-3 sm:grid-cols-2">
					{[0, 1, 2, 3].map(item => (
						<div key={item} className="h-32 animate-pulse rounded-md bg-gray-100" />
					))}
				</div>
			) : weaknesses.length > 0 ? (
				<ul className="grid gap-3 sm:grid-cols-2">
					{weaknesses.map(item => {
						const category = getCategory(item.category)
						return (
							<li key={item.category} className="rounded-md border border-gray-200 bg-gray-50 p-3">
								<div className="flex items-start justify-between gap-3">
									<div className="flex items-center gap-3">
										<div className="flex h-11 w-11 items-center justify-center rounded-md" style={{ backgroundColor: category.color }}>
											<Image src={`/categories-icons/${category.name.toLowerCase()}.svg`} alt={category.name} width={26} height={26} />
										</div>
										<div>
											<p className="font-semibold text-slate-900">{item.category}</p>
											<p className="text-xs text-slate-500">{item.attempts} attempts</p>
										</div>
									</div>
									<span className={`rounded-md border px-2 py-1 text-xs font-semibold ${scoreTone(item.avgScore)}`}>{item.avgScore}%</span>
								</div>

								<p className="mt-3 truncate text-xs text-slate-500" title={item.scores.join(', ')}>
									{item.scores.join(', ')}
								</p>

								<button
									type="button"
									onClick={() => handlePractice(item.category)}
									disabled={isGenerating}
									className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
								>
									<FiTarget />
									<span>Practice</span>
								</button>
							</li>
						)
					})}
				</ul>
			) : (
				<div className="flex min-h-48 items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 text-center text-sm text-slate-500">
					{user ? 'No weakness data yet.' : 'Sign in to view weakness data.'}
				</div>
			)}
		</section>
	)
}
