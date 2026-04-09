import Image from 'next/image'
import Link from 'next/link'

import { AiFillCloseCircle, AiFillCheckCircle } from 'react-icons/ai'
import { FaRegLightbulb } from 'react-icons/fa'
import { useCallback, useEffect, useRef } from 'react'
import { IoCloseSharp } from 'react-icons/io5'
import { BiArrowBack } from 'react-icons/bi'
import trophyIcon from '@/assets/trophy.svg'
import { useState } from 'react';

import playSound from '@/helpers/playSound'
import ReactCanvasConfetti from 'react-canvas-confetti'
import { useBoundStore } from '@/store/useBoundStore'
import saveAttempt from '@/helpers/take/saveAttempt'
import getCorrectAnswer from '@/helpers/question/getCorrectAnswer'

const canvasStyles = {
	position: 'fixed',
	pointerEvents: 'none',
	width: '100%',
	height: '100%',
	top: 0,
	left: 0,
	zIndex: 100
}

export default function GameOver() {
	const { queries, score, win, questions, setDecryptedAnswer, takeId, sendAsk } = useBoundStore(state => state)
	const [expandedQuestionIndex, setExpandedQuestionIndex] = useState(null);
	const { showAsk } = useState(false);
	const refAnimationInstance = useRef(null)

	const showCorrectAnswer = async (questionIndex) => {
		const question = questions[questionIndex]; // Get the specific question
		if (queries.quizmode) {
			const correctAnswer = await getCorrectAnswer(question.correctAnswer);

			if (correctAnswer) {
				setDecryptedAnswer(questionIndex, correctAnswer);

				// alert(`Correct Answer: ${correctAnswer}`);
			} else {
				// alert('Error fetching the correct answer');
			}
		}
	};

	function handleAskAI(questionText) {
		if (window.$chatwoot) {
			window.$chatwoot.toggle('open'); // Open the widget
			window.$chatwoot.sendMessage(questionText); // Send the question as a message
		} else {
			alert('Chatwoot is not loaded yet.');
		}
	}

	const getInstance = useCallback((instance) => {
		refAnimationInstance.current = instance
	}, [])

	const makeShot = useCallback((particleRatio, opts) => {
		refAnimationInstance.current &&
			refAnimationInstance.current({
				...opts,
				origin: { y: 0.7 },
				particleCount: Math.floor(200 * particleRatio)
			})
	}, [])

	const fire = useCallback(() => {
		makeShot(0.25, {
			spread: 26,
			startVelocity: 55
		})

		makeShot(0.2, {
			spread: 60
		})

		makeShot(0.35, {
			spread: 100,
			decay: 0.91,
			scalar: 0.8
		})

		makeShot(0.1, {
			spread: 120,
			startVelocity: 25,
			decay: 0.92,
			scalar: 1.2
		})

		makeShot(0.1, {
			spread: 120,
			startVelocity: 45
		})
	}, [makeShot])

	useEffect(() => {
		if (queries.quizmode) saveAttempt(takeId, questions)
		if (win === true) {
			fire()
			playSound('win', 0.2)
		}
	}, [win])

	function closeDialog() {
		playSound('pop', 0.2)
		document.getElementById('gameoverdialog').close()
		document.getElementById('gameoverbg').style.display = 'none'
	}

	function finalImage() {
		if (queries.infinitymode) return <Image src={trophyIcon} width={100} height={200} alt='Trophy' />
		if (win === true) return <AiFillCheckCircle className='text-8xl text-green-500' />
		return <AiFillCloseCircle className='text-8xl text-red-500' />
	}

	function finalTitle() {
		if (queries.infinitymode) return 'Congratulations!'
		if (win === true) return 'You Win!'
		return 'You Lose!'
	}

	function finalText() {
		if (queries.infinitymode) return `You answered well ${score} questions!`
		if (win === true) return 'Congratulations! \nQuiz completed successfully.'
		return 'Better luck next time! \nYou can try again.'
	}

	return (
		<>
			<div onClick={closeDialog} id="gameoverbg" className="transition-all fixed z-30 w-screen h-screen backdrop-blur-sm top-0 left-0"></div>

			<ReactCanvasConfetti refConfetti={getInstance} style={canvasStyles} />

			<dialog
				id="gameoverdialog"
				open={true}
				className="fixed m-0 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-7xl px-2 md:px-6 py-6 md:py-12 rounded-md bg-white text-slate-900 z-40
				max-h-screen overflow-y-auto"
			>
				<button className="absolute top-2 right-2 text-3xl hover:scale-105" onClick={closeDialog}>
					<IoCloseSharp />
				</button>

				<div className="flex flex-col md:flex-row gap-4 md:gap-6 items-stretch min-h-[60vh]">
					{/* Main GameOver Panel */}
					<div className="flex flex-col items-center justify-center gap-4 flex-shrink-0 w-full md:w-1/3 mb-6 md:mb-0">
						{finalImage()}
						<h2 className="text-2xl font-bold">{finalTitle()}</h2>
						<p className="text-center mb-3 whitespace-pre-line">{finalText()}</p>
						<div className="flex gap-4 flex-wrap items-center justify-center">
							<Link href="/" className="px-5 md:px-8 hover:opacity-75 bg-slate-200 py-3 rounded-md transition-colors">
								<BiArrowBack color="#0f172a" className="text-xl mr-1 inline-block" title="" />
								Go back
							</Link>
							<button
								onClick={() => document.getElementById('newGameDialog').showModal()}
								className="btn-primary px-5 md:px-8 py-3 uppercase tracking-widest rounded-md bg-blue-500 text-white"
							>
								{queries.infinitymode || win !== false ? 'Play Again' : 'Try Again'}
							</button>
						</div>
					</div>

					{/* List of Questions */}
					<div className="flex-1 flex flex-col w-full md:w-1/3 max-h-[60vh]">
						<ul className="flex-1 w-full overflow-y-auto bg-gray-100 p-4 rounded-md">
							{questions.map((question, index) => (
								<li
									key={question.id || index}
									className="flex flex-col gap-4 p-4 mb-4 rounded-md shadow-md bg-white"
								>
									<p className='rounded-md h-16 md:h-[3.5rem] flex justify-center items-center bg-blue-500 px-5 py-0 text-white text-sm font-semibold'>
										{question.question}
									</p>
									<hr className="border-gray-200" />
									<ul className="flex flex-col gap-2">
										{question.answers.map((answer, j) => (
											<li key={j} className="relative">
												<button
													className={`w-full mb-1 btn-primary text-left px-4 py-2 rounded-md flex justify-between items-center 
														${answer === question.answer
															? question.userAnswer > 0
																? 'correctAnswer'
																: 'wrongAnswer'
															: answer === question.correctAnswer
																? 'correctAnswer'
																: ''
														}`}
													disabled
												>
													<span>{answer || '---'}</span>
													{answer === question.answer && (
														<span className="ml-2">
															{question.userAnswer > 0 ? '✔' : '✘'}
														</span>
													)}
												</button>
											</li>
										))}
									</ul>
									{queries.quizmode && <>
										<div
											className="flex justify-center items-center cursor-pointer mt-2"
											onClick={() =>
												setExpandedQuestionIndex(
													expandedQuestionIndex === index ? null : index
												)
											}
										>
											<FaRegLightbulb className="text-gray-400 text-2xl hover:text-yellow-500 transition-colors" />
										</div>
										<div
											className={`expandable ${expandedQuestionIndex === index ? 'expanded py-2' : ''}`}
										>
											<div className="flex flex-col gap-2">

												<button
													className="px-4 py-2 mb-1 text-sm rounded-md btn-primary correctAnswer"
													onClick={() => showCorrectAnswer(index)}
												>
													Show Correct Answer
												</button>

												{/* <button
													className="px-4 text-sm btn-primary"
													name="askAIButton"
													onClick={() => handleAskAI(question.question)}
												>
													Ask AI
												</button> */}
											</div>
										</div>
									</>
									}
								</li>
							))}
						</ul>
					</div>

					{/* Chatwoot Chat Panel
					<div className="flex-1 flex flex-col w-full md:w-1/3 max-h-[80vh] min-h-[320px]">
						<iframe
							src="https://app.chatwoot.com/widget?website_token=GLCbXECkHvwiQQnNbEsxnCA6"
							className="flex-1 w-full h-[60vh] md:h-full rounded-md border min-h-[320px]"
							title="Chatwoot"
						/>
					</div> */}
				</div>
			</dialog>
		</>
	)
}
