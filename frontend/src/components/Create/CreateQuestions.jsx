import { useState, useCallback } from 'react';
import { FiPlus, FiFile, FiZap, FiTrash2, FiShuffle, FiChevronDown, FiChevronUp, FiCheck, FiAlertCircle } from 'react-icons/fi';
import Image from 'next/image';
import { useBoundStore } from '@/store/useBoundStore';
import fileToGenerate from '@/helpers/quiz/fileToGenerate';

/* ── Expandable question card (Coach-style) ──────────────────── */
function QuestionCard({ question, index, onRemove, onSelectAnswer, onScrambleAnswers }) {
	const [expanded, setExpanded] = useState(index === 0);

	return (
		<li className="rounded-md border-2 border-blue-100 bg-white shadow-[0_4px_0_#dbeafe] transition-all">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
			>
				<span className="text-sm font-semibold text-slate-900 leading-snug">{question.question || '(no question text)'}</span>
				<span className="flex flex-shrink-0 items-center gap-2">
					<span className="rounded-md bg-blue-600 px-2 py-1 text-xs font-bold text-white shadow-[0_2px_0_#1d4ed8]">{index + 1}</span>
					<span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-gray-200">
						{expanded ? <FiChevronUp className="text-sm" /> : <FiChevronDown className="text-sm" />}
					</span>
				</span>
			</button>
			{expanded && (
				<div className="border-t-2 border-blue-50 px-4 py-3">
					<ul className="grid gap-2 sm:grid-cols-2">
						{question.answers.map((answer, j) => (
							<li key={`${answer}-${j}`}>
								<button
									type="button"
									onClick={(e) => onSelectAnswer(index, j, e)}
									className={`w-full rounded-md border-2 px-3 py-2.5 text-left text-sm font-medium transition-all ${
										answer === question.correctAnswer && answer.trim() !== ''
											? 'border-emerald-300 bg-emerald-50 text-emerald-800 shadow-[0_2px_0_#a7f3d0]'
											: 'border-gray-200 bg-gray-50 text-slate-700 hover:border-blue-200 hover:bg-blue-50'
									}`}
								>
									<span className="flex items-center gap-2">
										<span className={`inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-xs font-bold ${
											answer === question.correctAnswer && answer.trim() !== ''
												? 'bg-emerald-500 text-white'
												: 'bg-gray-200 text-slate-600'
										}`}>
											{['A', 'B', 'C', 'D'][j]}
										</span>
										{answer || '---'}
									</span>
								</button>
							</li>
						))}
					</ul>
					<div className="mt-3 flex items-center justify-between">
						<button
							type="button"
							onClick={() => onScrambleAnswers(index)}
							className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-gray-50"
						>
							<FiShuffle className="text-xs" />
							<span>Scramble answers</span>
						</button>
						<button
							type="button"
							onClick={() => onRemove(index)}
							className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100"
						>
							<FiTrash2 className="text-xs" />
							<span>Remove</span>
						</button>
					</div>
				</div>
			)}
		</li>
	);
}

/* ── Main component ──────────────────────────────────────────── */
const QuizQuestionCreator = () => {
	const [currentQuestion, setCurrentQuestion] = useState({ question: '', answers: ['', '', '', ''], correctAnswer: '', category: '' });
	const [fileSelected, setFileSelected] = useState(false);
	const [validationError, setValidationError] = useState('');

	const {
		addCreatedQuestion,
		createdQuestions,
		removeCreatedQuestion,
		quizId,
		generateQuestion,
		setCreateQuestions,
	} = useBoundStore(state => state);

	/* ── Validation ─────────────────────────────────────────── */
	const clearError = useCallback(() => setValidationError(''), []);

	const addQuestion = () => {
		clearError();
		if (!currentQuestion.question.trim()) {
			setValidationError('Please enter a question.');
			return;
		}
		if (!currentQuestion.correctAnswer) {
			setValidationError('Please select the correct answer.');
			return;
		}
		addCreatedQuestion(currentQuestion);
		setCurrentQuestion({ question: '', answers: ['', '', '', ''], correctAnswer: '' });
	};

	/* ── Field helpers ──────────────────────────────────────── */
	const updateQuestion = (value) => {
		setCurrentQuestion({ ...currentQuestion, question: value });
		if (validationError) clearError();
	};

	const updateOption = (index, value) => {
		const updatedAnswers = [...currentQuestion.answers];
		updatedAnswers[index] = value;
		setCurrentQuestion({ ...currentQuestion, answers: updatedAnswers });
		if (validationError) clearError();
	};

	const selectCorrectAnswer = (aIndex) => {
		clearError();
		const selectedAnswer = currentQuestion.answers[aIndex];
		if (!selectedAnswer.trim()) {
			setValidationError('Please provide an answer before selecting it as correct.');
			return;
		}
		setCurrentQuestion({ ...currentQuestion, correctAnswer: selectedAnswer });
	};

	/* ── Question-list answer selection ──────────────────────── */
	const selectListAnswer = (qIndex, aIndex, event) => {
		const updatedQuestions = createdQuestions.map((q, i) =>
			i === qIndex ? { ...q, correctAnswer: q.answers[aIndex] } : q
		);
		if (typeof setCreateQuestions === 'function') {
			setCreateQuestions(updatedQuestions);
		}
		const buttons = event.target.closest('ul')?.querySelectorAll('button');
		buttons?.forEach((btn) => btn.classList.remove('correctAnswer'));
		event.target.parentNode?.classList.add('shake-left-right');
		setTimeout(() => {
			event.target.parentNode?.classList.remove('shake-left-right');
		}, 600);
	};

	/* ── Scramble helpers ───────────────────────────────────── */
	const shuffleArray = (arr) => {
		const shuffled = [...arr];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		return shuffled;
	};

	const scrambleAnswers = (qIndex) => {
		const updatedQuestions = createdQuestions.map((q, i) =>
			i === qIndex ? { ...q, answers: shuffleArray(q.answers) } : q
		);
		setCreateQuestions(updatedQuestions);
	};

	const scrambleAllQuestions = () => {
		setCreateQuestions(shuffleArray(createdQuestions));
	};

	const scrambleAllAnswers = () => {
		const updated = createdQuestions.map(q => ({
			...q,
			answers: shuffleArray(q.answers),
		}));
		setCreateQuestions(updated);
	};

	const scrambleEverything = () => {
		const shuffledQuestions = shuffleArray(createdQuestions).map(q => ({
			...q,
			answers: shuffleArray(q.answers),
		}));
		setCreateQuestions(shuffledQuestions);
	};

	return (
		<div className="coach-workspace mx-auto max-w-5xl px-4 py-5 md:px-8 md:py-6">
			{/* ── Section header (Coach style) ──────────────────── */}
			<div className="mb-5 flex flex-col gap-3 rounded-md border-2 border-blue-100 bg-white px-4 py-4 shadow-[0_4px_0_#dbeafe] md:flex-row md:items-center md:justify-between md:px-5">
				<div className="flex min-w-0 items-center gap-3">
					<div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-blue-600 text-2xl text-white shadow-[0_4px_0_#1d4ed8]">
						<FiPlus />
					</div>
					<div className="min-w-0">
						<p className="text-xs font-bold uppercase tracking-widest text-blue-700">Quiz Creator Workspace</p>
						<h2 className="truncate text-2xl font-bold text-slate-900">Build questions</h2>
						<p className="mt-1 max-w-2xl text-sm text-slate-600">Add questions manually or generate them from a file.</p>
					</div>
				</div>
				<span className="w-fit rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-blue-700">
					{createdQuestions.length} {createdQuestions.length === 1 ? 'question' : 'questions'}
				</span>
			</div>

			{/* ── Question editor card ────────────────────────────── */}
			<section className="mb-5 rounded-md border-2 border-blue-100 bg-white p-4 shadow-[0_4px_0_#dbeafe] md:p-5">
				<div className="mb-4">
					<p className="text-xs font-semibold uppercase tracking-widest text-slate-500">New Question</p>
					<h3 className="text-lg font-semibold text-slate-900">Question editor</h3>
				</div>

				{/* Validation error */}
				{validationError && (
					<div className="mb-4 flex items-center gap-2 rounded-md border-2 border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700">
						<FiAlertCircle className="flex-shrink-0 text-base" />
						<span>{validationError}</span>
					</div>
				)}

				<div className="space-y-3">
					<label className="grid gap-1.5">
						<span className="text-sm font-semibold text-slate-700">Question text</span>
						<input
							type="text"
							placeholder="Enter your question"
							value={currentQuestion.question}
							onChange={(e) => updateQuestion(e.target.value)}
							className="rounded-md border-2 border-gray-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
						/>
					</label>

					<div className="grid gap-1.5">
						<span className="text-sm font-semibold text-slate-700">Answer options <span className="font-normal text-slate-400">(click ✓ to mark correct)</span></span>
						<div className="grid gap-2 sm:grid-cols-2">
							{currentQuestion.answers.map((opt, oIndex) => (
								<div key={oIndex} className="flex items-center gap-2">
									<span className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-sm font-bold ${
										currentQuestion.correctAnswer === opt && opt.trim() !== ''
											? 'bg-emerald-500 text-white shadow-[0_2px_0_#059669]'
											: 'bg-gray-100 text-slate-500'
									}`}>
										{['A', 'B', 'C', 'D'][oIndex]}
									</span>
									<input
										type="text"
										placeholder={`Answer ${['A', 'B', 'C', 'D'][oIndex]}`}
										value={opt}
										onChange={(e) => updateOption(oIndex, e.target.value)}
										className="w-full rounded-md border-2 border-gray-200 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
									/>
									<button
										type="button"
										className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border-2 text-sm transition-all ${
											currentQuestion.correctAnswer === opt && opt.trim() !== ''
												? 'border-emerald-300 bg-emerald-500 text-white shadow-[0_2px_0_#059669]'
												: 'border-gray-200 bg-white text-gray-400 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600'
										}`}
										onClick={() => selectCorrectAnswer(oIndex)}
										title="Mark as correct"
									>
										<FiCheck />
									</button>
								</div>
							))}
						</div>
					</div>
				</div>

				{/* ── Action button bar ──────────────────────────── */}
				<div className="mt-5 flex flex-wrap gap-2">
					<button
						type="button"
						onClick={addQuestion}
						className="inline-flex items-center gap-2 rounded-md border-2 border-blue-200 bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_3px_0_#1d4ed8] transition-all hover:-translate-y-0.5 hover:bg-blue-500 active:translate-y-0 active:shadow-none"
					>
						<FiPlus />
						<span>Add question</span>
					</button>

					<input
						type="file"
						id="fileInput"
						className="hidden"
						accept="application/pdf, .txt, .docx, .doc, .pptx, .ppt"
						onChange={async (e) => {
							const file = e.target.files[0];
							if (file) {
								setFileSelected(true);
								try {
									await fileToGenerate(file, quizId);
								} catch (error) {
									console.error('Error sending file:', error);
								}
							} else {
								setFileSelected(false);
							}
						}}
					/>

					<button
						type="button"
						className="inline-flex items-center gap-2 rounded-md border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-gray-50"
						onClick={() => document.getElementById('fileInput').click()}
					>
						<FiFile />
						<span>Select file</span>
					</button>

					{fileSelected && (
						<button
							type="button"
							className="inline-flex items-center gap-2 rounded-md border-2 border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100"
							onClick={() => generateQuestion('13r0hXk2bPMLUUqESQgKodet7byvXbSJ1')}
						>
							<FiZap />
							<span>Generate from file</span>
						</button>
					)}
				</div>
			</section>

			{/* ── Questions list section ──────────────────────────── */}
			<section className="rounded-md border-2 border-blue-100 bg-white p-4 shadow-[0_4px_0_#dbeafe] md:p-5">
				<div className="mb-4 flex items-center justify-between gap-3">
					<div>
						<p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Quiz Preview</p>
						<h3 className="text-lg font-semibold text-slate-900">Your questions</h3>
					</div>
					<span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{createdQuestions.length} total</span>
				</div>

				{/* ── Scramble buttons ───────────────────────────────── */}
				{createdQuestions.length > 1 && (
					<div className="mb-4 flex flex-wrap gap-2 rounded-md border-2 border-gray-100 bg-gray-50/50 p-3">
						<span className="mr-1 flex items-center text-xs font-bold uppercase tracking-wider text-slate-500">
							<FiShuffle className="mr-1.5" /> Scramble
						</span>
						<button
							type="button"
							onClick={scrambleAllQuestions}
							className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-gray-50"
						>
							Questions order
						</button>
						<button
							type="button"
							onClick={scrambleAllAnswers}
							className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-gray-50"
						>
							All answers
						</button>
						<button
							type="button"
							onClick={scrambleEverything}
							className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
						>
							Everything
						</button>
					</div>
				)}

				{/* ── Question cards ─────────────────────────────────── */}
				<ul className="max-h-[40rem] space-y-3 overflow-y-auto pr-1">
					{createdQuestions.length > 0 ? createdQuestions.map((question, index) => (
						<QuestionCard
							key={`${question.question}-${index}`}
							question={question}
							index={index}
							onRemove={removeCreatedQuestion}
							onSelectAnswer={selectListAnswer}
							onScrambleAnswers={scrambleAnswers}
						/>
					)) : (
						<li className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-blue-200 bg-blue-50/30 px-4 text-center">
							<FiPlus className="text-3xl text-blue-300" />
							<span className="text-sm font-medium text-slate-500">No questions yet. Use the editor above to add your first question.</span>
						</li>
					)}
				</ul>
			</section>
		</div>
	);
};

export default QuizQuestionCreator;