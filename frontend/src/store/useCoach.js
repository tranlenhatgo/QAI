import categoriesJSON from '@/assets/categories.json'
import getQuizByUserId from '@/helpers/quiz/getQuizByUserId'
import { db } from '@/helpers/auth/firebase'
import { collection, doc, setDoc, deleteDoc, getDocs, query, orderBy } from 'firebase/firestore'

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

function loadDocuments() {
	// Initial load returns empty — real load happens via loadDocumentsFromFirestore
	return []
}

function saveDocuments() {
	// No-op: documents are now saved individually to Firestore
}

async function saveDocumentToFirestore(userId, document) {
	if (!userId || !document?.id) return
	try {
		const docRef = doc(db, 'users', userId, 'documents', document.id)
		await setDoc(docRef, {
			name: document.name || '',
			status: document.status || 'processing',
			ragStatus: document.ragStatus || null,
			ragError: document.ragError || null,
			ragDocumentId: document.ragDocumentId || null,
			uploadedAt: document.uploadedAt || new Date().toISOString(),
			questions: document.questions || [],
			ragChunks: document.ragChunks || 0,
		}, { merge: true })
	} catch (e) {
		console.error('[useCoach] Failed to save document to Firestore:', e)
	}
}

async function deleteDocumentFromFirestore(userId, documentId) {
	if (!userId || !documentId) return
	try {
		const docRef = doc(db, 'users', userId, 'documents', documentId)
		await deleteDoc(docRef)
	} catch (e) {
		console.error('[useCoach] Failed to delete document from Firestore:', e)
	}
}

async function loadDocumentsFromFirestore(userId) {
	if (!userId) return []
	try {
		const q = query(collection(db, 'users', userId, 'documents'), orderBy('uploadedAt', 'desc'))
		const snapshot = await getDocs(q)
		return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
	} catch (e) {
		console.error('[useCoach] Failed to load documents from Firestore:', e)
		return []
	}
}

export const useCoachStore = (set, get) => ({
	activeCoachFeature: 'overview',
	coachTier: process.env.NEXT_PUBLIC_STUDY_COACH_TIER === 'full' ? 'full' : 'lite',

	generatedQuestions: [],
	isGenerating: false,
	generateTopic: 'Science',
	generateTitle: '',
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

	documents: loadDocuments(),
	isUploading: false,
	uploadError: null,

	// Progress Tracking (from AI Coach)
	progressData: null,
	isLoadingProgress: false,
	progressError: null,

	// Spaced Repetition Reviews
	dueReviews: [],
	upcomingReviews: [],
	isLoadingReviews: false,
	reviewQuizActive: null,

	// Notifications (Firestore-backed)
	notifications: [],

	setActiveCoachFeature: (activeCoachFeature) => set({ activeCoachFeature }),
	setCoachTier: (coachTier) => {
		const tier = coachTier === 'lite' ? 'lite' : 'full'
		set({ coachTier: tier })
		get().setChatConfig({ tier })
	},
	setGenerateTopic: (generateTopic) => set({ generateTopic }),
	setGenerateTitle: (generateTitle) => set({ generateTitle }),
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

	generateQuestions: async (topic, count, documentName) => {
		const normalizedTopic = String(topic || get().generateTopic || '').trim()
		const normalizedCount = clampCount(count ?? get().generateCount)
		const title = (get().generateTitle || '').trim()
		if (!normalizedTopic && !documentName) {
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
				body: JSON.stringify({ topics: [normalizedTopic || 'General'], count: normalizedCount, tier: get().coachTier, title: title || documentName || undefined, documentName: documentName || undefined }),
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
				body: JSON.stringify({ problem: normalizedProblem, tier: get().coachTier }),
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
		const user = get().user

		const newDoc = { id: documentId, name: file.name, status: 'processing', uploadedAt, questions: [] }
		set(state => ({
			isUploading: true,
			uploadError: null,
			documents: [newDoc, ...state.documents],
		}))

		// Save initial doc to Firestore
		if (user?.uid) saveDocumentToFirestore(user.uid, newDoc)

		try {
			const formData = new FormData()
			formData.append('file', file, file.name)
			formData.append('count', String(DEFAULT_GENERATE_COUNT))
			formData.append('quiz_id', '')
			formData.append('tier', get().coachTier)

			const response = await fetch('/api/quiz/upload', {
				method: 'POST',
				body: formData,
			})
			const data = await readJsonResponse(response, 'Failed to upload study material')
			const questions = normalizeQuestions(data.questions, file.name)

			const updatedDoc = { ...newDoc, status: 'indexed', questions }
			set(state => ({
				generatedQuestions: questions,
				documents: state.documents.map(d => d.id === documentId ? updatedDoc : d),
			}))
			if (user?.uid) saveDocumentToFirestore(user.uid, updatedDoc)

			// RAG indexing (Full tier only, non-blocking)
			if (get().coachTier === 'full' && user?.uid) {
				const ingestForm = new FormData()
				ingestForm.append('file', file, file.name)
				ingestForm.append('user_id', user.uid)
				fetch('/api/coach/ingest', { method: 'POST', body: ingestForm })
					.then(async r => {
						if (!r.ok) {
							const errData = await r.json().catch(() => ({}))
							throw new Error(errData.detail || errData.message || 'RAG indexing failed')
						}
						return r.json()
					})
					.then(result => {
						const ragDoc = { ...updatedDoc, ragStatus: 'indexed', ragChunks: result.chunks_indexed, ragDocumentId: result.document_id }
						set(state => ({
							documents: state.documents.map(d => d.id === documentId ? ragDoc : d),
						}))
						saveDocumentToFirestore(user.uid, ragDoc)
					})
					.catch(err => {
						const failedDoc = { ...updatedDoc, ragStatus: 'failed', ragError: err.message }
						set(state => ({
							documents: state.documents.map(d => d.id === documentId ? failedDoc : d),
						}))
						saveDocumentToFirestore(user.uid, failedDoc)
					})
			}

			return data
		} catch (error) {
			const failedDoc = { ...newDoc, status: 'failed' }
			set(state => ({
				uploadError: error.message,
				documents: state.documents.map(d => d.id === documentId ? failedDoc : d),
			}))
			if (user?.uid) saveDocumentToFirestore(user.uid, failedDoc)
			return null
		} finally {
			set({ isUploading: false })
		}
	},

	removeDocument: async (documentId) => {
		const user = get().user
		const docToRemove = get().documents.find(d => d.id === documentId)
		set(state => ({
			documents: state.documents.filter(d => d.id !== documentId),
		}))

		// Delete from Firestore
		if (user?.uid) {
			deleteDocumentFromFirestore(user.uid, documentId)
			// Delete RAG chunks from Supabase (via AI coach) using the backend document_id
			const ragId = docToRemove?.ragDocumentId
			if (ragId) {
				fetch(`/api/coach/documents/${user.uid}/${ragId}`, { method: 'DELETE' }).catch(() => {})
			}
		}
	},

	loadUserDocuments: async () => {
		const user = get().user
		if (!user?.uid) return
		const documents = await loadDocumentsFromFirestore(user.uid)
		set({ documents })
	},

	// ─── Progress & Spaced Repetition Actions ────────────────────────────────

	fetchProgress: async (userId) => {
		const uid = userId || get().user?.uid
		if (!uid) return

		set({ isLoadingProgress: true, progressError: null })
		try {
			const response = await fetch(`/api/coach/progress/${uid}`)
			if (!response.ok) throw new Error(`Progress fetch failed: ${response.status}`)
			const data = await response.json()
			set({ progressData: data, isLoadingProgress: false })
		} catch (error) {
			set({ progressError: error.message, isLoadingProgress: false })
		}
	},

	fetchDueReviews: async (userId) => {
		const uid = userId || get().user?.uid
		if (!uid) return

		set({ isLoadingReviews: true })
		try {
			const response = await fetch(`/api/coach/progress/${uid}`)
			if (!response.ok) throw new Error(`Reviews fetch failed: ${response.status}`)
			const data = await response.json()

			const dueReviews = (data.due_reviews || []).map(item => ({
				category: item.category,
				daysOverdue: item.days_overdue || 0,
				priority: item.priority || 'normal',
				lastScore: item.last_score,
			}))

			const upcomingReviews = (data.upcoming_reviews || []).map(item => ({
				category: item.category,
				daysOverdue: 0,
				priority: 'normal',
				lastScore: item.last_score,
			}))

			set({ dueReviews, upcomingReviews, isLoadingReviews: false })
		} catch {
			set({ dueReviews: [], upcomingReviews: [], isLoadingReviews: false })
		}
	},

	startReview: (category) => {
		set({ reviewQuizActive: category, activeCoachFeature: 'generate', generateTopic: category, generateCount: 5 })
		get().generateQuestions(category, 5)
	},

	completeReview: async (category, score) => {
		const uid = get().user?.uid
		if (!uid) return

		try {
			await fetch('/api/coach/review-completed', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: uid, category, score }),
			})
		} catch {
			// Non-critical — schedule update is best-effort
		}

		set(state => ({
			reviewQuizActive: null,
			dueReviews: state.dueReviews.filter(r => r.category !== category),
		}))
	},

	// ─── Notifications (Firestore-backed via Spring Boot) ────────────────────

	fetchNotifications: async (userId) => {
		const uid = userId || get().user?.uid
		if (!uid) return

		try {
			const response = await fetch(`/api/coach/notifications/${uid}`)
			if (!response.ok) return
			const data = await response.json()
			set({ notifications: data })
		} catch {
			// Notifications are non-critical
		}
	},

	markNotificationRead: async (notificationId) => {
		try {
			await fetch(`/api/coach/notifications/${notificationId}/read`, { method: 'PATCH' })
			set(state => ({
				notifications: state.notifications.map(n =>
					n.id === notificationId ? { ...n, read: true } : n
				),
			}))
		} catch {
			// Best-effort
		}
	},
})
