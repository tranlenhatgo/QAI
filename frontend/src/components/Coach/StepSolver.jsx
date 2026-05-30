import { useState } from 'react'
import { FiClipboard, FiRotateCcw, FiZap } from 'react-icons/fi'
import { useBoundStore } from '@/store/useBoundStore'

function StepCard({ step }) {
	const [expanded, setExpanded] = useState(false)

	return (
		<li className="rounded-md border border-gray-200 bg-white">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
			>
				<span className="text-sm font-semibold text-slate-900">Step {step.step_id}: {step.goal}</span>
				<span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-slate-500">{expanded ? 'Hide' : 'Reasoning'}</span>
			</button>
			<div className="border-t border-gray-100 px-4 py-3">
				{expanded ? (
					<p className="mb-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{step.reasoning}</p>
				) : null}
				<p className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{step.result}</p>
			</div>
		</li>
	)
}

function FinalAnswer({ answer, confidence, analysis }) {
	const confidenceClassName = {
		high: 'text-emerald-700 bg-emerald-50 border-emerald-200',
		medium: 'text-amber-700 bg-amber-50 border-amber-200',
		low: 'text-rose-700 bg-rose-50 border-rose-200',
	}[confidence] || 'text-slate-700 bg-gray-50 border-gray-200'

	return (
		<div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-4">
			{analysis ? <p className="mb-3 text-sm leading-6 text-slate-600">{analysis}</p> : null}
			<p className="text-base font-semibold text-slate-900">{answer}</p>
			<div className="mt-3 flex flex-wrap items-center gap-2">
				<span className={`rounded-md border px-2 py-1 text-xs font-semibold ${confidenceClassName}`}>
					Confidence: {confidence || 'unknown'}
				</span>
				<button
					type="button"
					onClick={() => navigator.clipboard?.writeText(answer || '')}
					className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-white"
				>
					<FiClipboard />
					<span>Copy</span>
				</button>
			</div>
		</div>
	)
}

export default function StepSolver() {
	const {
		user,
		setDest,
		currentProblem,
		setCurrentProblem,
		solveProblem,
		clearSolution,
		isSolving,
		solveError,
		solutionSteps,
		finalAnswer,
		confidence,
		analysis,
		coachTier,
	} = useBoundStore(state => state)

	async function handleSubmit(event) {
		event.preventDefault()
		if (!user) {
			setDest('coach')
			document.getElementById('authDialog')?.showModal()
			return
		}
		await solveProblem(currentProblem)
	}

	return (
		<section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:p-5">
			<div className="mb-4 flex items-center justify-between gap-3">
				<div>
					<p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Step Solver</p>
					<h2 className="text-xl font-semibold text-slate-900">Structured solution</h2>
				</div>
				<span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{solutionSteps.length} steps</span>
			</div>

			<p className={`mb-4 rounded-md border px-3 py-2 text-xs ${coachTier === 'full' ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
				<strong>{coachTier === 'full' ? 'Full mode' : 'Lite mode'}</strong> — {coachTier === 'full' ? 'Advanced multi-step reasoning for complex problems. Automatically retries with backup if needed.' : 'Basic problem solving using a lightweight local model. Best for simpler problems.'}
			</p>

			<form onSubmit={handleSubmit}>
				<textarea
					value={currentProblem}
					onChange={event => setCurrentProblem(event.target.value)}
					disabled={isSolving}
					className="min-h-36 w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm leading-6 text-slate-900 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50"
					placeholder="Solve x^2 + 5x + 6 = 0"
				/>
				<div className="mt-3 flex flex-wrap gap-2">
					<button
						type="submit"
						disabled={isSolving || !currentProblem.trim()}
						className="btn-primary inline-flex items-center gap-2 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-70"
					>
						<FiZap />
						<span>{isSolving ? 'Solving' : 'Solve'}</span>
					</button>
					<button
						type="button"
						onClick={clearSolution}
						disabled={isSolving || (!currentProblem && solutionSteps.length === 0)}
						className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<FiRotateCcw />
						<span>Clear</span>
					</button>
				</div>
			</form>

			{solveError ? (
				<p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{solveError}</p>
			) : null}

			{solutionSteps.length > 0 ? (
				<ol className="mt-4 max-h-[30rem] space-y-3 overflow-y-auto pr-1">
					{solutionSteps.map(step => <StepCard key={step.step_id} step={step} />)}
				</ol>
			) : (
				<div className="mt-4 flex min-h-36 items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 text-center text-sm text-slate-500">
					No solution generated.
				</div>
			)}

			{finalAnswer ? (
				<FinalAnswer answer={finalAnswer} confidence={confidence} analysis={analysis} />
			) : null}
		</section>
	)
}
