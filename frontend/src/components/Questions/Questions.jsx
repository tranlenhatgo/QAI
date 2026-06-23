import { useEffect, useState } from 'react'
import Wildcards from './Wildcards'
import GameOver from '../Play/GameOver'
import QuestionsNavbar from './QuestionsNavbar'
import QuestionSlider from './QuestionSlider'

import categories from '@/assets/categories.json'
import playSound from '@/helpers/playSound'
import { useBoundStore } from '@/store/useBoundStore'

export default function Questions() {
	const { questions, loading, loadingInfinity, currentQuestion, setCurrentQuestion, setUserAnswer, win, questionProgress, setWin, setQuestionProgress, wildCards, useLivesCard, queries, getQuestions, answerAdaptiveInfinity, adaptiveHistory } = useBoundStore(state => state)
	const [time, setTime] = useState(Number(queries.time))

	useEffect(() => {
		var color = null
		if (!queries.quizmode) {
			// In infinity mode, use adaptiveHistory for past questions, questions[0] for active
			const topicSource = queries.infinitymode
				? (adaptiveHistory[currentQuestion - 1] || questions[0])
				: questions[currentQuestion - 1]
			color = categories.find(cat => cat.name.toLowerCase() === topicSource?.topic?.toLowerCase())?.color
		} else {
			color = "#307de7"
		}
		color && (document.body.style.backgroundColor = color)

		function shortcuts(e) {
			if (queries.infinitymode) {
				const activePos = adaptiveHistory.length + 1 // 1-based position of current unanswered question

				if (e.key === 'ArrowLeft' && currentQuestion > 1) {
					// Navigate left, skipping wrong-answer questions
					for (let target = currentQuestion - 1; target >= 1; target--) {
						const histItem = adaptiveHistory[target - 1]
						if (!histItem || histItem.userAnswer !== -1) {
							changueCurrent(target)
							return
						}
					}
					// All left are wrong — stay put
				}
				if (e.key === 'ArrowRight' && currentQuestion < activePos) {
					// Navigate right, skipping wrong-answer questions, max is activePos
					for (let target = currentQuestion + 1; target <= activePos; target++) {
						if (target === activePos) {
							changueCurrent(target)
							return
						}
						const histItem = adaptiveHistory[target - 1]
						if (!histItem || histItem.userAnswer !== -1) {
							changueCurrent(target)
							return
						}
					}
				}
			} else {
				if (e.key === 'ArrowLeft' && currentQuestion > 1) changueCurrent(currentQuestion - 1)
				if (e.key === 'ArrowRight' && currentQuestion < questionProgress) changueCurrent(currentQuestion + 1)
			}

			if (e.key === 'a' || e.key === 'b' || e.key === 'c' || e.key === 'd') {
				const answer = ['a', 'b', 'c', 'd'].indexOf(e.key)
				if (answer !== -1) {
					if (queries.infinitymode) {
						// Only allow answering the active (current unanswered) question
						const activePos = adaptiveHistory.length + 1
						if (currentQuestion === activePos) {
							document.querySelector(`.answers-inf-active .answer-${answer + 1}`)?.click()
						}
						// If viewing a past question, do nothing — can't answer it
					} else {
						document.querySelector(`.answers-${questionProgress} .answer-${answer + 1}`)?.click()
					}
				}
			}
		}

		document.addEventListener('keydown', shortcuts)
		return () => {
			document.removeEventListener('keydown', shortcuts)
			document.body.style.backgroundColor = ''
		}
	}, [currentQuestion, questionProgress, adaptiveHistory])

	useEffect(() => {
		if (win !== undefined || !queries.timemode || loading || loadingInfinity) return
		const timeInterval = setInterval(() => setTime(time => time > 0 ? time - 1 : time), 1000)
		return () => clearInterval(timeInterval)
	}, [queries.timemode, win, loading, loadingInfinity])

	useEffect(() => {
		if (queries.quizmode || !queries.timemode || win !== undefined || time > 0) return

		if (queries.infinitymode) {
			const activeQuestion = questions[0]
			clickCorrectAnswer()
			playSound('wrong_answer', 0.3)
			if (activeQuestion) {
				setTimeout(() => {
					answerAdaptiveInfinity(activeQuestion, null, false)
					setTime(Number(queries.time))
				}, 1000)
			}
			return
		}

		if (wildCards.lives < 1) {
			clickCorrectAnswer()
			setUserAnswer(questionProgress - 1, -1)
			playSound('wrong_answer', 0.3)
			setWin(false)
		} else {
			if (questionProgress === queries.questions) {
				setWin(true)
				clickCorrectAnswer()
			} else clickCorrectAnswer(true)

			setUserAnswer(questionProgress - 1, 2)
			useLivesCard()
			playSound('correct_answer', 0.3)
		}
	}, [time])

	function getAnotherQuestions() {
		setTimeout(() => {
			setTime(Number(queries.time))
			changueCurrent(1)
			setQuestionProgress(questionProgress + 1)
			const topics = categories.filter(category => queries.categories.find(cat => cat === category.id)).map(cat => cat.name)
			getQuestions(topics, 5, true)
		}, 1000)
	}

	function clickCorrectAnswer(addProgress = false) {
		if (addProgress) {
			setTimeout(() => {
				setQuestionProgress(questionProgress + 1)
				setTime(Number(queries.time))
				setUserAnswer(questionProgress - 1, 1)
				changueCurrent(questionProgress + 1)
			}, 1000)
		}

		const activeIndex = queries.infinitymode ? 0 : questionProgress - 1
		const answerSelector = queries.infinitymode ? 'answers-inf-active' : `answers-${questionProgress}`
		document.querySelectorAll(`.${answerSelector} button`).forEach(answer => {
			answer.disabled = true
			if (answer.textContent === questions[activeIndex]?.correctAnswer) {
				answer.classList.add('correctAnswer')
				answer.parentNode.classList.add('shake-left-right')
			}
		})
	}

	function changueCurrent(number) {
		if (number < 1) return
		if (queries.infinitymode) {
			// In infinity mode, max navigable position is the current active question
			const maxPos = adaptiveHistory.length + (questions.length > 0 ? 1 : 0)
			if (number > maxPos) return
			// Block navigation to wrong-answer past questions (final safeguard)
			const histItem = adaptiveHistory[number - 1]
			if (histItem && histItem.userAnswer === -1) return
		} else {
			if (number > questions.length) return
		}
		setCurrentQuestion(number)
	}

	return (
		<>
			<div className='fixed max-w-xl md:max-w-2xl w-[85%] mx-auto top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'>
				<QuestionsNavbar changueCurrent={changueCurrent} />
				<QuestionSlider changueCurrent={changueCurrent} setTime={setTime} getAnotherQuestions={getAnotherQuestions} />
			</div>

			{win !== undefined && <GameOver />}
			{/* {!queries.quizmod && <Wildcards />} */}
			<Wildcards />

			{
				queries.timemode && <div className={`bg-white flex items-center justify-center w-14 aspect-square absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full text-2xl text-slate-900 font-medium ${time < 6 && win === undefined ? 'pulse_animation' : ''}`}>
					{time}
					<svg className='countdown absolute top-0 left-0 w-full rotate-180 overflow-visible h-full'>
						<circle className={`stroke-blue-500 transition-all duration-1000 ease-linear ${time < 6 && win === undefined ? ' stroke-red-500' : ''}`} r="28" cx="27" cy="27" style={{ strokeDashoffset: 174 / queries.time * time }}></circle>
					</svg>
				</div>
			}
		</>
	)
}
