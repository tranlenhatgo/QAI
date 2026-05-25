import categoriesJSON from '@/assets/categories.json'
import getQuizByUserId from '@/helpers/quiz/getQuizByUserId'

const DEFAULT_GENERATE_COUNT = 5
const MAX_GENERATE_COUNT = 20
const DEFAULT_CATEGORY = 'General culture'

function createId(prefix) {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return `${prefix}-${crypto.randomUUID()}`
	}
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function clampCount(value) {
	const number = Number(value)
	if (!Number.isFinite(number)) return DEFAULT_GENERATE_COUNT
	if (number < 1) return 1
	if (number > MAX_GENERATE_COUNT) return MAX_GENERATE_COUNT
	return Math.round(number)
}

function parseScore(score) {
	if (typeof score !== 'string') return null
	const [correct, total] = score.split('/').map(part => Number(part))
	if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0) return null
	return {
		correct,
		total,
		percent: Math.round((correct / total) * 100),
		text: `${correct}/${total}`,
	}
}

function normalizeDate(value) {
	const date = new Date(value || Date.now())
	return Number.isNaN(date.getTime()) ? new Date() : date
}

function dateKey(date) {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

function inferCategory(attempt) {
	const source = [
		attempt?.category,
		Array.isArray(attempt?.categories) ? attempt.categories.join(' ') : '',
		attempt?.quizTitle,
		attempt?.title,
	].join(' ').toLowerCase()

	return categoriesJSON.find(category => {
		const name = category.name.toLowerCase()
		const snake = category.name.toUpperCase().replace(/\s+/g, '_').toLowerCase()
		return source.includes(name) || source.includes(snake)
	})?.name || DEFAULT_CATEGORY
}

function buildInsights(history = []) {
	const grouped = new Map()
	const scoreHistory = (Array.isArray(history) ? history : [])
		.map((attempt, index) => {
			const score = parseScore(attempt?.score)
			if (!score) return null

			const date = normalizeDate(attempt?.updatedAt)
			const category = inferCategory(attempt)
			const item = {
				id: `${attempt?.quizId || 'quiz'}-${index}`,
				quizId: attempt?.quizId,
				title: attempt?.quizTitle || 'Quiz attempt',
				category,
				date: dateKey(date),
				timestamp: date.getTime(),
				score: score.text,
				correct: score.correct,
				total: score.total,
				percent: score.percent,
			}

			const current = grouped.get(category) || { category, attempts: 0, scoreTotal: 0, scores: [] }
			current.attempts += 1
			current.scoreTotal += score.percent
			current.scores.push(score.text)
			grouped.set(category, current)

			return item
		})
		.filter(Boolean)
		.sort((a, b) => a.timestamp - b.timestamp)

	const weaknesses = Array.from(grouped.values())
		.map(item => ({
			category: item.category,
			attempts: item.attempts,
			avgScore: Math.round(item.scoreTotal / item.attempts),
			scores: item.scores,
		}))
		.sort((a, b) => a.avgScore - b.avgScore)

	const activeDays = Array.from(new Set(scoreHistory.map(item => item.date))).sort().reverse()
	let streak = 0
	if (activeDays.length > 0) {
		const cursor = new Date(`${activeDays[0]}T00:00:00`)
		for (const day of activeDays) {
			if (dateKey(cursor) !== day) break
			streak += 1
			cursor.setDate(cursor.getDate() - 1)
		}
	}

	return { scoreHistory, weaknesses, streak }
}

async function readJsonResponse(response, fallbackMessage) {
	const data = await response.json().catch(() => ({}))
	if (!response.ok) {
		const error = new Error(data?.message || data?.detail || fallbackMessage)
		error.statusCode = response.status
		throw error
	}
	return data
}

function normalizeQuestions(questions, topic) {
	return (Array.isArray(questions) ? questions : []).map(question => ({
		question: question.question,
		answers: Array.isArray(question.answers) ? question.answers : [],
		correctAnswer: question.correctAnswer,
		topic,
		userAnswer: undefined,
		answer: '',
		ia: true,
	}))
}

export const useCoachStore = (set, get) => ({
	generatedQuestions: [],
	isGenerating: false,
	generateTopic: 'Science',
	generateCount: DEFAULT_GENERATE_COUNT,
	generateError: null,

	solutionSteps: [],
	finalAnswer: null,
	confidence: null,
	analysis: null,
	currentProblem: '',
	isSolving: false,
	solveError: null,

	weaknesses: [],
	scoreHistory: [],
	streak: 0,
	isLoadingProfile: false,
	coachProgressError: null,

	documents: [],
	isUploading: false,
	uploadError: null,

	setGenerateTopic: (generateTopic) => set({ generateTopic }),
	setGenerateCount: (generateCount) => set({ generateCount: clampCount(generateCount) }),
	setCurrentProblem: (currentProblem) => set({ currentProblem }),
	clearGeneratedQuestions: () => set({ generatedQuestions: [], generateError: null }),
	clearSolution: () => set({
		solutionSteps: [],
		finalAnswer: null,
		confidence: null,
		analysis: null,
		currentProblem: '',
		solveError: null,
	}),

	loadCoachProgress: async () => {
		const userId = get().user?.uid
		if (!userId) {
			set({
				weaknesses: [],
				scoreHistory: [],
				streak: 0,
				coachProgressError: null,
				isLoadingProfile: false,
			})
			return
		}

		set({ isLoadingProfile: true, coachProgressError: null })
		try {
			const data = await getQuizByUserId(userId)
			const quizzes = Array.isArray(data?.quizzes) ? data.quizzes : []
			const history = Array.isArray(data?.history) ? data.history : []
			set({
				quizzes,
				history,
				...buildInsights(history),
			})
		} catch (error) {
			set({
				weaknesses: [],
				scoreHistory: [],
				streak: 0,
				coachProgressError: error.message,
			})
		} finally {
			set({ isLoadingProfile: false })
		}
	},

	generateQuestions: async (topic, count) => {
		const normalizedTopic = String(topic || get().generateTopic || '').trim()
		const normalizedCount = clampCount(count ?? get().generateCount)
		if (!normalizedTopic) {
			set({ generateError: 'Topic is required' })
			return []
		}

		set({
			isGenerating: true,
			generateError: null,
			generateTopic: normalizedTopic,
			generateCount: normalizedCount,
		})
		try {
			const response = await fetch('/api/coach/generate-questions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ topics: [normalizedTopic], count: normalizedCount }),
			})
			const data = await readJsonResponse(response, 'Failed to generate questions')
			const questions = normalizeQuestions(data.questions, normalizedTopic)
			set({ generatedQuestions: questions })
			return questions
		} catch (error) {
			set({ generateError: error.message })
			return []
		} finally {
			set({ isGenerating: false })
		}
	},

	practiceTopic: async (category) => {
		set({ generateTopic: category, generateCount: DEFAULT_GENERATE_COUNT })
		return get().generateQuestions(category, DEFAULT_GENERATE_COUNT)
	},

	solveProblem: async (problem) => {
		const normalizedProblem = String(problem || get().currentProblem || '').trim()
		if (!normalizedProblem) {
			set({ solveError: 'Problem is required' })
			return null
		}

		set({
			isSolving: true,
			solveError: null,
			currentProblem: normalizedProblem,
			solutionSteps: [],
			finalAnswer: null,
			confidence: null,
			analysis: null,
		})
		try {
			const response = await fetch('/api/coach/solve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ problem: normalizedProblem }),
			})
			const data = await readJsonResponse(response, 'Failed to solve problem')
			set({
				solutionSteps: Array.isArray(data.steps) ? data.steps : [],
				finalAnswer: data.final_answer || null,
				confidence: data.confidence || null,
				analysis: data.analysis || null,
			})
			return data
		} catch (error) {
			set({ solveError: error.message })
			return null
		} finally {
			set({ isSolving: false })
		}
	},

	uploadStudyMaterial: async (file) => {
		if (!file) return null
		const documentId = createId('document')
		const uploadedAt = new Date().toISOString()

		set(state => ({
			isUploading: true,
			uploadError: null,
			documents: [
				{ id: documentId, name: file.name, status: 'processing', uploadedAt, questions: [] },
				...state.documents,
			],
		}))

		try {
			const formData = new FormData()
			formData.append('file', file, file.name)
			formData.append('count', String(DEFAULT_GENERATE_COUNT))
			formData.append('quiz_id', '')

			const response = await fetch('/api/quiz/upload', {
				method: 'POST',
				body: formData,
			})
			const data = await readJsonResponse(response, 'Failed to upload study material')
			const questions = normalizeQuestions(data.questions, file.name)

			set(state => ({
				generatedQuestions: questions,
				documents: state.documents.map(document => document.id === documentId
					? { ...document, status: 'indexed', questions }
					: document),
			}))
			return data
		} catch (error) {
			set(state => ({
				uploadError: error.message,
				documents: state.documents.map(document => document.id === documentId
					? { ...document, status: 'failed' }
					: document),
			}))
			return null
		} finally {
			set({ isUploading: false })
		}
	},

	removeDocument: (documentId) => set(state => ({
		documents: state.documents.filter(document => document.id !== documentId),
	})),
})
