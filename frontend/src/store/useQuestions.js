import getQuestions from '@/helpers/getQuestions'
import getQuestionsByQuizId from '@/helpers/question/getQuestionsByQuizId'
import takeQuiz from '@/helpers/take/takeQuiz'

export const useQuestionsStore = (set, get) => ({
	questions: [],
	takeId: null,
	loading: false,
	loadingInfinity: false,
	error: [false, ''],
	currentQuestion: 1,
	score: 1,
	win: undefined,
	quizQuestions: [],
	getQuestions: (topics, number, infinity) => {
		infinity ? set({ loadingInfinity: true }) : set({ loading: true })
		getQuestions(topics, number)
			.then(data => set({ questions: data }))
			.catch(err => set({ error: [true, err] }))
			.finally(() => infinity ? set({ loadingInfinity: false }) : set({ loading: false }))
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
		await takeQuiz(id, name, uid)
			.then(data => {
				set({ questions: data.questions, takeId: data.takeId })
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
	cleanQuestions: () => set({ questions: [], score: 1, currentQuestion: 1, win: undefined }),
	setScore: (score) => set({ score }),
	setWin: (win) => set({ win })
})
