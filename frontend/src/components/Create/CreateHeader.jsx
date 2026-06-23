import { FiHome, FiRefreshCw, FiSave } from 'react-icons/fi'
import { useRouter } from 'next/router'
import { useBoundStore } from '@/store/useBoundStore'

export default function CreateHeader() {
	const router = useRouter()
	const {
		cleanQuestions,
		cleanWildCards,
		createdQuestions,
		saveQuestions,
		update,
		updateQuizQuestions,
	} = useBoundStore(state => state)

	return (
		<nav className="coach-shell sticky top-0 z-40 overflow-hidden border-b border-blue-300/20 text-white shadow-xl">
			<div className="mx-auto max-w-5xl px-4 py-3 md:px-8">
				<div className="flex items-center justify-between gap-4">
					<div className="flex min-w-0 items-center gap-3">
						<button
							type="button"
							onClick={() => {
								cleanQuestions()
								cleanWildCards()
								router.push('/')
							}}
							className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-white/25 bg-white text-slate-900 shadow-[0_3px_0_rgba(37,99,235,0.45)] transition-all hover:-translate-y-0.5 hover:bg-blue-50 active:translate-y-0 active:shadow-none"
							aria-label="Go home"
						>
							<FiHome />
						</button>
						<div className="min-w-0">
							<h1 className="truncate text-xl font-bold tracking-wide text-white">Quiz Creator</h1>
							<p className="truncate text-xs font-medium text-blue-100">Build your own quiz from scratch</p>
						</div>
					</div>

					<div className="flex flex-shrink-0 items-center gap-2">
						<span className="hidden rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-blue-100 sm:inline-flex items-center gap-1.5">
							<span className="inline-flex h-5 w-5 items-center justify-center rounded bg-blue-500 text-[10px] font-bold text-white">{createdQuestions.length}</span>
							Questions
						</span>

						<button
							type="button"
							onClick={() => document.getElementById('newGameDialog')?.showModal()}
							className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white transition-all hover:-translate-y-0.5 hover:bg-white/20 active:translate-y-0"
							aria-label="Reset quiz"
							title="Reset"
						>
							<FiRefreshCw />
						</button>

						<button
							type="button"
							onClick={() => {
								if (update) {
									updateQuizQuestions()
								} else {
									saveQuestions()
								}
							}}
							className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-[0_3px_0_rgba(37,99,235,0.45)] transition-all hover:-translate-y-0.5 hover:bg-blue-50 active:translate-y-0 active:shadow-none"
						>
							<FiSave />
							<span className="hidden sm:inline">{update ? 'Update' : 'Save'}</span>
						</button>
					</div>
				</div>
			</div>
		</nav>
	)
}
