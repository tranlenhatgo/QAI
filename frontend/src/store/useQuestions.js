import getQuestions from '@/helpers/getQuestions'
import getQuestionsByQuizId from '@/helpers/question/getQuestionsByQuizId'
import takeQuiz from '@/helpers/take/takeQuiz'
import offlineQuestions from '@/assets/questions.json'
import categories from '@/assets/categories.json'
import {
	ADAPTIVE_AI_CONTEXT_LIMIT,
	buildAdaptiveAnswerPayload,
	buildAdaptiveAiRequestBody,
	buildMultiCategoryStaticQueue,
	historyItemFromQuestion,
	pickAdaptiveMetadata,
	shouldPrefetchAdaptiveAi,
} from '@/helpers/adaptiveInfinity.mjs'

function shuffleAnswers(questions) {
	return questions.map(q => ({
		...q,
		answers: [...q.answers].sort(() => Math.random() - 0.5),
	}))
}

function hashString(value) {
	let hash = 0
	for (let i = 0; i < value.length; i += 1) {
		hash = ((hash << 5) - hash) + value.charCodeAt(i)
		hash |= 0
	}
	return Math.abs(hash).toString(36)
}

function categoryById(categoryId) {
	return categories.find(category => category.id === categoryId) || categories[0]
}

function normalizeCategoryName(categoryId) {
	return categoryById(categoryId).name
}

function normalizeCategoryIds(categoryIds) {
	const values = Array.isArray(categoryIds) ? categoryIds : [categoryIds]
	const validIds = categories.map(category => category.id)
	const selected = values.filter((categoryId, index) => categoryId && validIds.includes(categoryId) && values.indexOf(categoryId) === index)
	return selected.length > 0 ? selected : [categories[0].id]
}

function sourceQuestionId(categoryId, question) {
	return `${categoryId}:${hashString(`${question.question}|${question.correctAnswer}`)}`
}

function staticQuestionsForCategory(categoryId, answeredIds = []) {
	const category = categoryById(categoryId)
	const answered = new Set(answeredIds)
	return (offlineQuestions[category.name] || [])
		.map(question => ({
			...question,
			topic: category.name,
			source: 'static_json',
			sourceQuestionId: sourceQuestionId(category.id, question),
			selectedAnswer: null,
			userAnswer: undefined,
			answer: undefined,
			repeated: false,
			ia: false,
		}))
		.filter(question => !answered.has(question.sourceQuestionId))
}

function normalizeWrongQuestion(question, categoryName, dueIn = 2) {
	return {
		question: {
			question: question.question,
			answers: Array.isArray(question.answers) ? question.answers : [],
			correctAnswer: question.correctAnswer,
			topic: categoryName,
			source: question.source || 'repeat',
			sourceQuestionId: question.sourceQuestionId || `wrong:${hashString(`${question.question}|${question.correctAnswer}`)}`,
			selectedAnswer: question.selectedAnswer || null,
			repeated: true,
			ia: question.source === 'adaptive_ai',
			...pickAdaptiveMetadata(question),
		},
		dueIn,
		wrongCount: Number(question.wrongCount || 1),
	}
}

function statsFromHistory(history) {
	return history.reduce((stats, item) => {
		stats.total += 1
		if (item.userAnswer > 0) stats.correct += 1
		else stats.wrong += 1
		if (item.source === 'adaptive_ai') stats.ai += 1
		if (item.source === 'static_json') stats.static += 1
		if (item.repeated) stats.repeated += 1
		return stats
	}, { total: 0, correct: 0, wrong: 0, ai: 0, static: 0, repeated: 0 })
}

async function readJsonResponse(response, fallbackMessage) {
	const data = await response.json().catch(() => ({}))
	if (!response.ok) {
		const error = new Error(data.message || fallbackMessage)
		error.statusCode = data.statusCode || response.status
		throw error
	}
	return data
}

export const useQuestionsStore = (set, get) => ({
	questions: [],
	takeId: null,
	loading: false,
	loadingInfinity: false,
	error: [false, ''],
	currentQuestion: 1,
	questionProgress: 1,
	win: undefined,
	quizQuestions: [],
	adaptiveQueue: [],
	adaptiveWrongQueue: [],
	adaptiveHistory: [],
	adaptiveRecentAnswers: [],
	adaptiveRecentQuestions: [],
	adaptiveLoading: false,
	adaptiveAiLoading: false,
	adaptiveEndReason: '',
	adaptiveSessionState: null,
	adaptiveCategoryId: null,
	adaptiveCategoryName: '',
	adaptiveCategoryIds: [],
	adaptiveCategoryNames: [],
	adaptiveCategoryStates: {},
	adaptiveAiError: '',
	adaptiveStats: { total: 0, correct: 0, wrong: 0, ai: 0, static: 0, repeated: 0 },
	getQuestions: (topics, number, infinity) => {
		infinity ? set({ loadingInfinity: true }) : set({ loading: true })
		getQuestions(topics, number)
			.then(data => set({ questions: shuffleAnswers(data) }))
			.catch(err => set({ error: [true, err] }))
			.finally(() => infinity ? set({ loadingInfinity: false }) : set({ loading: false }))
	},
	startAdaptiveInfinity: async (categoryIdOrIds) => {
		const user = get().user
		const categoryIds = normalizeCategoryIds(categoryIdOrIds)
		const categoryNames = categoryIds.map(normalizeCategoryName)
		const categoryId = categoryIds[0]
		const categoryName = categoryNames[0]
		set({
			questions: [],
			currentQuestion: 1,
			questionProgress: 1,
			win: undefined,
			adaptiveQueue: [],
			adaptiveWrongQueue: [],
			adaptiveHistory: [],
			adaptiveRecentAnswers: [],
			adaptiveRecentQuestions: [],
			adaptiveLoading: true,
			adaptiveAiLoading: false,
			adaptiveEndReason: '',
			adaptiveSessionState: null,
			adaptiveCategoryId: categoryId,
			adaptiveCategoryName: categoryName,
			adaptiveCategoryIds: categoryIds,
			adaptiveCategoryNames: categoryNames,
			adaptiveCategoryStates: {},
			adaptiveAiError: '',
			adaptiveStats: { total: 0, correct: 0, wrong: 0, ai: 0, static: 0, repeated: 0 },
		})

		if (!user?.uid) {
			set({ adaptiveLoading: false, adaptiveEndReason: 'Sign in to use Infinity Quiz.', win: false })
			return
		}

		try {
			const categoryStates = await Promise.all(categoryIds.map(async (selectedCategoryId, index) => {
				const selectedCategoryName = categoryNames[index]
				const response = await fetch(`/api/adaptive-practice/session-state?category=${encodeURIComponent(selectedCategoryName)}`)
				const sessionState = await readJsonResponse(response, 'Failed to load adaptive practice state')
				const answeredIds = Array.isArray(sessionState.answeredStaticQuestionIds) ? sessionState.answeredStaticQuestionIds : []
				const staticQuestions = staticQuestionsForCategory(selectedCategoryId, answeredIds)
				const recentAnswers = Array.isArray(sessionState.recentAnswers)
					? sessionState.recentAnswers.slice().reverse().map(answer => ({
						...historyItemFromQuestion(answer, answer.selectedAnswer, answer.correct),
						category: answer.category || selectedCategoryName,
					})).slice(-ADAPTIVE_AI_CONTEXT_LIMIT)
					: []
				const wrongQueue = Array.isArray(sessionState.wrongQuestions)
					? sessionState.wrongQuestions.map(question => normalizeWrongQuestion(question, selectedCategoryName, 2))
					: []
				return {
					categoryId: selectedCategoryId,
					categoryName: selectedCategoryName,
					sessionState,
					staticQuestions,
					recentAnswers,
					wrongQueue,
				}
			}))
			const staticQueue = buildMultiCategoryStaticQueue(categoryStates.map(state => ({
				categoryName: state.categoryName,
				staticQuestions: state.staticQuestions,
			})))
			const recentAnswers = categoryStates.flatMap(state => state.recentAnswers).slice(-ADAPTIVE_AI_CONTEXT_LIMIT)
			const wrongQueue = categoryStates.flatMap(state => state.wrongQueue)
			const sessionState = {
				answeredStaticQuestionIds: categoryStates.flatMap(state => state.sessionState.answeredStaticQuestionIds || []),
				hasStaticHistoryInCategory: categoryStates.every(state => state.sessionState.hasStaticHistoryInCategory),
				wrongQuestions: categoryStates.flatMap(state => state.sessionState.wrongQuestions || []),
				recentAnswers: categoryStates.flatMap(state => state.sessionState.recentAnswers || []),
			}

			set({
				adaptiveSessionState: sessionState,
				adaptiveCategoryStates: Object.fromEntries(categoryStates.map(state => [state.categoryName, state.sessionState])),
				adaptiveQueue: sessionState.hasStaticHistoryInCategory ? [] : staticQueue,
				adaptiveWrongQueue: wrongQueue,
				adaptiveRecentAnswers: recentAnswers,
				adaptiveLoading: false,
				adaptiveRecentQuestions: [],
			})

			if (sessionState.hasStaticHistoryInCategory || staticQueue.length === 0) {
				await get().fetchAdaptiveAiQuestions()
			}
			if (get().questions.length === 0) {
				await get().advanceAdaptiveInfinity()
			}
			get().maybePrefetchAdaptiveAi()
		} catch (error) {
			set({
				adaptiveLoading: false,
				adaptiveEndReason: error.message || 'Unable to start Infinity Quiz.',
				win: false,
			})
		}
	},
	fetchAdaptiveAiQuestions: async () => {
		if (get().adaptiveAiLoading) return []
		const categoryName = get().adaptiveCategoryName
		if (!categoryName) return []

		set({ adaptiveAiLoading: true, adaptiveAiError: '' })
		try {
			const state = get()
			const response = await fetch('/api/coach/adaptive-questions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildAdaptiveAiRequestBody(state)),
			})
			const data = await readJsonResponse(response, 'Failed to generate adaptive questions')
			const generated = (Array.isArray(data.questions) ? data.questions : []).map(question => ({
				question: question.question,
				answers: question.answers,
				correctAnswer: question.correctAnswer,
				topic: question.topic || question.category || categoryName,
				source: 'adaptive_ai',
				sourceQuestionId: `ai:${hashString(`${question.topic || question.category || categoryName}|${question.question}|${question.correctAnswer}`)}`,
				generatedFromQuestion: question.generatedFromQuestion || null,
				...pickAdaptiveMetadata(question),
				selectedAnswer: null,
				userAnswer: undefined,
				answer: undefined,
				repeated: false,
				ia: true,
			}))
			set(current => ({
				adaptiveQueue: [...current.adaptiveQueue, ...generated],
				adaptiveAiLoading: false,
				adaptiveRecentQuestions: [...new Set([...(current.adaptiveRecentQuestions || []), ...generated.map(question => question.question)])],
			}))
			if (get().queries.infinitymode && get().questions.length === 0 && get().win === undefined) {
				get().advanceAdaptiveInfinity()
			}
			return generated
		} catch (error) {
			set({ adaptiveAiLoading: false, adaptiveAiError: error.message || 'Adaptive AI is unavailable.' })
			return []
		}
	},
	maybePrefetchAdaptiveAi: () => {
		const state = get()
		if (shouldPrefetchAdaptiveAi(state)) {
			get().fetchAdaptiveAiQuestions()
		}
	},
	advanceAdaptiveInfinity: async () => {
		const state = get()
		if (!state.queries.infinitymode) return

		const dueIndex = state.adaptiveWrongQueue.findIndex(item => item.dueIn <= 0)
		if (dueIndex !== -1) {
			const dueItem = state.adaptiveWrongQueue[dueIndex]
			const nextWrongQueue = state.adaptiveWrongQueue.filter((_, index) => index !== dueIndex)
			const nextQuestion = {
				...dueItem.question,
				source: 'repeat',
				repeated: true,
				wrongCount: dueItem.wrongCount,
				answer: undefined,
				userAnswer: undefined,
			}
			set({
				adaptiveWrongQueue: nextWrongQueue,
				questions: shuffleAnswers([nextQuestion]),
				currentQuestion: state.adaptiveHistory.length + 1,
				questionProgress: state.adaptiveHistory.length + 1,
			})
			return
		}

		if (state.adaptiveQueue.length > 0) {
			const [nextQuestion, ...remaining] = state.adaptiveQueue
			set({
				adaptiveQueue: remaining,
				questions: shuffleAnswers([{ ...nextQuestion, answer: undefined, userAnswer: undefined }]),
				currentQuestion: state.adaptiveHistory.length + 1,
				questionProgress: state.adaptiveHistory.length + 1,
			})
			return
		}

		if (!state.adaptiveAiLoading) {
			await get().fetchAdaptiveAiQuestions()
			const refreshed = get()
			if (refreshed.adaptiveQueue.length > 0) {
				await get().advanceAdaptiveInfinity()
				return
			}
		}

		if (state.adaptiveAiLoading) {
			set({ questions: [] })
			return
		}

		set({
			questions: [],
			adaptiveEndReason: get().adaptiveAiError || 'No more Infinity Quiz questions are available.',
			win: false,
		})
	},
	answerAdaptiveInfinity: async (question, selectedAnswer, correct) => {
		const state = get()
		const answeredQuestion = {
			...question,
			answer: selectedAnswer,
			selectedAnswer,
			userAnswer: correct ? 1 : -1,
		}
		const history = [...state.adaptiveHistory, answeredQuestion]
		const recentAnswers = [...state.adaptiveRecentAnswers, historyItemFromQuestion(answeredQuestion, selectedAnswer, correct)].slice(-ADAPTIVE_AI_CONTEXT_LIMIT)
		let wrongQueue = state.adaptiveWrongQueue.map(item => ({ ...item, dueIn: item.dueIn - 1 }))

		if (!correct) {
			wrongQueue.push({
				question: {
					...answeredQuestion,
					source: answeredQuestion.source || (answeredQuestion.ia ? 'adaptive_ai' : 'static_json'),
					repeated: true,
				},
				dueIn: answeredQuestion.repeated ? 4 : 2,
				wrongCount: Number(answeredQuestion.wrongCount || 0) + 1,
			})
		} else if (answeredQuestion.repeated) {
			const key = answeredQuestion.sourceQuestionId || answeredQuestion.question
			wrongQueue = wrongQueue.filter(item => (item.question.sourceQuestionId || item.question.question) !== key)
		}

		set({
			adaptiveHistory: history,
			adaptiveRecentAnswers: recentAnswers,
			adaptiveWrongQueue: wrongQueue,
			adaptiveStats: statsFromHistory(history),
			questionProgress: history.length + 1,
		})

		fetch('/api/adaptive-practice/answer', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				...buildAdaptiveAnswerPayload(answeredQuestion, selectedAnswer, correct, state),
				attemptIndex: history.length,
			}),
		}).catch(error => console.warn('Could not save adaptive answer:', error))

		await get().advanceAdaptiveInfinity()
		get().maybePrefetchAdaptiveAi()
	},
	getQuestionsByQuizId: async (id) => {
		try {
			const data = await getQuestionsByQuizId(id)
			set({ quizQuestions: data })
		} catch (err) {
			set({ error: [true, err] })
		} finally {
			set({ loading: false })
		}
	},
	takeQuiz: async (id, name) => {
		const uid = get().user?.uid
		if (!uid) {
			console.warn('Guest taking quiz:', name, '- scores will not be saved')
		}
		await takeQuiz(id, name, uid)
			.then(data => {
				set({ questions: shuffleAnswers(data.questions), takeId: data.takeId })
				const { infiniteLifes } = get();
				infiniteLifes();
			})
			.catch(err => set({ error: [true, err] }))
			.finally(() => set({ loading: false }))
		return get().questions
	},
	setCurrentQuestion: (number) => set({ currentQuestion: number }),
	setUserAnswer: (question, answer) => {
		if (get().queries.infinitymode) return
		set(state => {
			const questions = [...state.questions]
			questions[question].userAnswer = answer
			return { questions }
		})
	},
	setDecryptedAnswer: (question, answer) => {
		if (get().queries.infinitymode) return
		set(state => {
			const questions = [...state.questions]
			questions[question].correctAnswer = answer
			return { questions }
		})
	},
	setAnswer: (question, answer) => {
		set(state => {
			const questions = [...state.questions]
			questions[question].answer = answer
			return { questions }
		})
	},
	cleanQuestions: () => set({
		questions: [],
		questionProgress: 1,
		currentQuestion: 1,
		win: undefined,
		adaptiveQueue: [],
		adaptiveWrongQueue: [],
		adaptiveHistory: [],
		adaptiveRecentAnswers: [],
		adaptiveRecentQuestions: [],
		adaptiveLoading: false,
		adaptiveAiLoading: false,
		adaptiveEndReason: '',
		adaptiveSessionState: null,
		adaptiveCategoryId: null,
		adaptiveCategoryName: '',
		adaptiveCategoryIds: [],
		adaptiveCategoryNames: [],
		adaptiveCategoryStates: {},
		adaptiveAiError: '',
		adaptiveStats: { total: 0, correct: 0, wrong: 0, ai: 0, static: 0, repeated: 0 },
	}),
	setQuestionProgress: (questionProgress) => set({ questionProgress }),
	setWin: (win) => set({ win })
})
