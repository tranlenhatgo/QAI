import { useBoundStore } from '@/store/useBoundStore'
import playSound from '@/helpers/playSound'
import starIcon from '@/assets/star.svg'
import Image from 'next/image'
import checkAnswer from '@/helpers/question/checkAnswer'
import { useState, useMemo } from 'react'

export default function QuestionSlider({ changueCurrent, setTime }) {
	const { questions, queries, loadingInfinity, adaptiveLoading, adaptiveAiLoading, adaptiveEndReason, answerAdaptiveInfinity, setUserAnswer, setAnswer, error, useLivesCard, setWin, wildCards, currentQuestion, setQuestionProgress, win, questionProgress, adaptiveHistory } = useBoundStore(state => state)
	const [flashType, setFlashType] = useState(null)

	// Must be before any early returns to comply with React hooks rules
	const infinitySlides = useMemo(() => {
		if (!queries.infinitymode) return null
		const slides = []
		for (let i = 0; i < adaptiveHistory.length; i++) {
			slides.push({
				question: adaptiveHistory[i],
				position: i + 1,
				isPast: true,
				isActive: false,
			})
		}
		if (questions.length > 0) {
			slides.push({
				question: questions[0],
				position: adaptiveHistory.length + 1,
				isPast: false,
				isActive: true,
			})
		}
		return slides
	}, [queries.infinitymode, adaptiveHistory, questions])

	function showFlash(isCorrect) {
		setFlashType(isCorrect ? 'correct' : 'wrong')
		setTimeout(() => setFlashType(null), 500)
	}

	function addRipple(buttonEl, isCorrect) {
		const ripple = document.createElement('div')
		ripple.className = `answer-ripple ${isCorrect ? 'answer-ripple--correct' : 'answer-ripple--wrong'}`
		buttonEl.style.position = 'relative'
		buttonEl.appendChild(ripple)
		setTimeout(() => ripple.remove(), 700)
	}

	async function validateAnswer(e) {
		const questionIndex = queries.infinitymode ? 0 : currentQuestion - 1
		const activeQuestion = queries.infinitymode ? questions[0] : questions[questionIndex]
		if (!activeQuestion) return

		var correct = null;
		if (!queries.quizmode) {
			correct = e.target.textContent === activeQuestion.correctAnswer
		} else {
			correct = await checkAnswer(e.target.textContent, activeQuestion.correctAnswer)
		}

		e.target.parentNode.classList.add(correct ? 'shake-left-right' : 'vibrate')
		e.target.classList.add(correct ? 'correctAnswer' : 'wrongAnswer')

		// Add visual feedback effects
		showFlash(correct)
		addRipple(e.target, correct)

		const answerSelector = queries.infinitymode ? `answers-inf-active` : `answers-${currentQuestion}`
		document.querySelectorAll(`.${answerSelector} button`).forEach(answer => {
			answer.disabled = true
			if (!correct && answer.textContent === activeQuestion.correctAnswer) {
				answer.parentNode.classList.add('shake-left-right')
				answer.classList.add('correctAnswer')
			}
		})

		playSound(correct ? 'correct_answer' : 'wrong_answer', 0.3)

		if (queries.infinitymode) {
			setTimeout(() => {
				setTime(Number(queries.time))
				answerAdaptiveInfinity(activeQuestion, e.target.textContent, correct)
			}, 1000)
			return
		}

		setUserAnswer(currentQuestion - 1, correct ? 1 : -1)
		setAnswer(currentQuestion - 1, e.target.textContent)

		if (!correct) {
			if (wildCards.lives > 0) {
				useLivesCard()
				if (questionProgress === Number(queries.questions)) return setWin(true)
			} else return setWin(false)
		} else if (questionProgress === Number(queries.questions)) return setWin(true)

		setTimeout(() => {
			setQuestionProgress(questionProgress + 1)
			setTime(Number(queries.time))
			changueCurrent(currentQuestion + 1)
		}, 1000)
	}

	if (error[0]) {
		return <div className='flex h-32 md:h-[6.5rem] items-center justify-center rounded-md bg-red-500 px-5 md:px-10 py-6 text-white text-xl font-semibold'>
			An error occurred while loading the next questions...
		</div>
	}

	if (loadingInfinity || adaptiveLoading || (queries.infinitymode && adaptiveAiLoading && questions.length === 0) || !questions) {
		return <div className='flex h-32 md:h-[6.5rem] items-center justify-center rounded-md bg-blue-500 px-5 md:px-10 py-6 text-white text-xl font-semibold'>
			{queries.infinitymode ? 'Preparing Infinity Quiz questions...' : 'Loading next questions...'}
		</div>
	}

	if (queries.infinitymode && adaptiveEndReason && questions.length === 0) {
		return <div className='flex h-32 md:h-[6.5rem] items-center justify-center rounded-md bg-red-500 px-5 md:px-10 py-6 text-center text-white text-xl font-semibold'>
			{adaptiveEndReason}
		</div>
	}

	const visibleQuestions = queries.infinitymode ? null : questions

	return (
		<>
			{flashType && <div className={`answer-flash answer-flash--${flashType}`} />}

			<main className='relative max-w-2xl min-h-[28rem] md:min-h-[16rem] mx-auto h-1/2'>
				{queries.infinitymode ? (
					infinitySlides && infinitySlides.map((slide) => {
						const { question, position, isPast, isActive } = slide
						const slideClass = position === currentQuestion
							? ''
							: position < currentQuestion
								? 'slide-left'
								: 'slide-right'
						return (
							<div key={`inf-${question.sourceQuestionId || question.question}-${position}`} className={`transition-all duration-500 ${slideClass} absolute text-center w-full`} id={'question-' + position}>
								{
									question.ia && <div className='absolute -top-6 -right-6 p-2'>
										<Image src={starIcon} width={50} height={50} alt='Question generated by AI' title='Question generated by AI' />
									</div>
								}
								<p className='rounded-md h-32 md:h-[6.5rem] flex justify-center items-center bg-blue-500 px-5 md:px-10 py-6 text-white text-xl font-semibold mb-3'>
									{question.question}
								</p>

								<ul className={`md:columns-2 mt-4 ${isActive ? 'answers-inf-active' : `answers-inf-past-${position}`}`}>
									{question.answers.map((answer, j) => {
										let pastAnswerClass = ''
										if (isPast) {
											if (answer === question.correctAnswer) pastAnswerClass = ' correctAnswer'
											else if (answer === question.selectedAnswer && question.userAnswer === -1) pastAnswerClass = ' wrongAnswer'
										}
										return (
											<li key={j + answer} className="relative">
												<button
													className={`${'answer-' + (j + 1)} peer btn-primary w-full shadow-sm pl-12 py-3 px-5 rounded mb-6 ${answer.length > 24 ? 'text-sm' : ''}${pastAnswerClass}`}
													disabled={isPast || win !== undefined || !isActive}
													onClick={isActive ? validateAnswer : undefined}>{answer || '---'}</button>

												<Image className='absolute pointer-events-none left-2 top-1 peer-disabled:translate-y-0 peer-hover:translate-y-[0.25em] peer-active:translate-y-[0.75em] transition-transform z-20 invert' src={`/letters/letter-${['a', 'b', 'c', 'd'][j]}.svg`} width={40} height={40} alt={`Question ${j + 1}]}`} />
											</li>
										)
									})}
								</ul>
							</div>
						)
					})
				) : (
					visibleQuestions.map((question, i) => {
						return (
							<div key={`${question.sourceQuestionId || question.correctAnswer}-${i}`} className={`transition-all duration-500 ${i + 1 === currentQuestion ? '' : i + 1 < currentQuestion ? 'slide-left' : 'slide-right'} absolute text-center w-full`} id={'question-' + (i + 1)}>
								{
									question.ia && <div className='absolute -top-6 -right-6 p-2'>
										<Image src={starIcon} width={50} height={50} alt='Question generated by AI' title='Question generated by AI' />
									</div>
								}
								<p className='rounded-md h-32 md:h-[6.5rem] flex justify-center items-center bg-blue-500 px-5 md:px-10 py-6 text-white text-xl font-semibold mb-3'>
									{question.question}
								</p>

								<ul className={`md:columns-2 mt-4 ${'answers-' + (i + 1)}`}>
									{question.answers.map((answer, j) => (
										<li key={j + answer} className="relative">
											<button
												className={`${'answer-' + (j + 1)} peer btn-primary w-full shadow-sm pl-12 py-3 px-5 rounded mb-6 ${answer.length > 24 ? 'text-sm' : ''}`}
												disabled={win !== undefined || (questionProgress !== i + 1 || currentQuestion !== i + 1)} onClick={validateAnswer}>{answer || '---'}</button >

											<Image className='absolute pointer-events-none left-2 top-1 peer-disabled:translate-y-0 peer-hover:translate-y-[0.25em] peer-active:translate-y-[0.75em] transition-transform z-20 invert' src={`/letters/letter-${['a', 'b', 'c', 'd'][j]}.svg`} width={40} height={40} alt={`Question ${j + 1}]}`} />
										</li>
									))}
								</ul>
							</div>
						)
					})
				)}
			</main>
		</>
	)
}
