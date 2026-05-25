import { useState } from 'react'
import { useRouter } from 'next/router'
import { FiCopy, FiEdit3, FiRefreshCw, FiSend } from 'react-icons/fi'
import categoriesJSON from '@/assets/categories.json'
import { useBoundStore } from '@/store/useBoundStore'

function QuestionCard({ question, index }) {
	const [expanded, setExpanded] = useState(index === 0)

	return (
		<li className="rounded-md border border-gray-200 bg-white">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
			>
				<span className="text-sm font-semibold text-slate-900">{question.question}</span>
				<span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-slate-500">{expanded ? 'Hide' : 'View'}</span>
			</button>
			{expanded ? (
				<div className="border-t border-gray-100 px-4 py-3">
					<ul className="grid gap-2 sm:grid-cols-2">
						{question.answers.map(answer => (
							<li
								key={answer}
								className={`rounded-md border px-3 py-2 text-sm ${answer === question.correctAnswer
									? 'border-emerald-200 bg-emerald-50 text-emerald-800'
									: 'border-gray-200 bg-gray-50 text-slate-700'
								}`}
							>
								{answer}
							</li>
						))}
					</ul>
				</div>
			) : null}
		</li>
	)
}

export default function GenerateQuestions() {
	const router = useRouter()
	const {
		user,
		setDest,
		generatedQuestions,
		isGenerating,
		generateTopic,
		generateCount,
		generateError,
		setGenerateTopic,
		setGenerateCount,
		generateQuestions,
		setCreateQuestions,
	} = useBoundStore(state => state)

	async function handleSubmit(event) {
		event.preventDefault()
		if (!user) {
			setDest('coach')
			document.getElementById('authDialog')?.showModal()
			return
		}
		await generateQuestions(generateTopic, generateCount)
	}

	function openInCreate() {
		if (!user) {
			setDest('create')
			document.getElementById('authDialog')?.showModal()
			return
		}
		setCreateQuestions(generatedQuestions)
		router.push('/create')
	}

	return (
		<section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:p-5">
			<div className="mb-4 flex items-center justify-between gap-3">
				<div>
					<p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Generate Questions</p>
					<h2 className="text-xl font-semibold text-slate-900">Topic generator</h2>
				</div>
				<span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{generatedQuestions.length} ready</span>
			</div>

			<form onSubmit={handleSubmit} className="grid gap-3">
				<label className="grid gap-2">
					<span className="text-sm font-semibold text-slate-700">Topic</span>
					<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
						<input
							type="text"
							value={generateTopic}
							onChange={event => setGenerateTopic(event.target.value)}
							className="rounded-md border border-gray-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
							placeholder="Science, algebra, world history"
						/>
						<select
							value={categoriesJSON.some(category => category.name === generateTopic) ? generateTopic : ''}
							onChange={event => event.target.value && setGenerateTopic(event.target.value)}
							className="rounded-md border border-gray-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
						>
							<option value="">Categories</option>
							{categoriesJSON.map(category => (
								<option key={category.id} value={category.name}>{category.name}</option>
							))}
						</select>
					</div>
				</label>

				<label className="grid gap-2">
					<span className="flex items-center justify-between text-sm font-semibold text-slate-700">
						Question count
						<span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-slate-600">{generateCount}</span>
					</span>
					<input
						type="range"
						min="1"
						max="20"
						value={generateCount}
						onChange={event => setGenerateCount(event.target.value)}
					/>
				</label>

				<div className="flex flex-wrap gap-2">
					<button
						type="submit"
						disabled={isGenerating}
						className="btn-primary inline-flex items-center gap-2 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-70"
					>
						{isGenerating ? <FiRefreshCw className="animate-spin" /> : <FiSend />}
						<span>{isGenerating ? 'Generating' : 'Generate'}</span>
					</button>
					<button
						type="button"
						disabled={isGenerating || generatedQuestions.length === 0}
						onClick={() => generateQuestions(generateTopic, generateCount)}
						className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<FiRefreshCw />
						<span>Regenerate</span>
					</button>
					<button
						type="button"
						disabled={generatedQuestions.length === 0}
						onClick={openInCreate}
						className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<FiEdit3 />
						<span>Open in Create</span>
					</button>
				</div>
			</form>

			{generateError ? (
				<p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{generateError}</p>
			) : null}

			<ul className="mt-4 max-h-[30rem] space-y-3 overflow-y-auto pr-1">
				{generatedQuestions.length > 0 ? generatedQuestions.map((question, index) => (
					<QuestionCard key={`${question.question}-${index}`} question={question} index={index} />
				)) : (
					<li className="flex min-h-36 items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 text-center text-sm text-slate-500">
						Questions generated here can be moved into the create editor.
					</li>
				)}
			</ul>

			{generatedQuestions.length > 0 ? (
				<button
					type="button"
					onClick={() => navigator.clipboard?.writeText(JSON.stringify(generatedQuestions, null, 2))}
					className="mt-3 inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-gray-100"
				>
					<FiCopy />
					<span>Copy JSON</span>
				</button>
			) : null}
		</section>
	)
}
