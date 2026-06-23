const defaultWildCards = { skip: 1, half: 1, lives: 1 }
const noWildCards = { skip: 0, half: 0, lives: 0 }
const infiniteLifes = { skip: 0, half: 0, lives: 200 }

export const useWildcardsStore = (set, get) => ({
	wildCards: defaultWildCards,
	skippingActiveQuestion: false,
	setSkippingActiveQuestion: (skipping) => set({ skippingActiveQuestion: skipping }),
	useSkipCard: () => {
		const state = get()
		const isInfinity = state.queries.infinitymode
		const finalQuestion = state.questionProgress
		const isDisabled = state.wildCards.skip < 1 || state.win !== undefined || state.currentQuestion !== finalQuestion

		if (isDisabled) return

		set({ skippingActiveQuestion: true })

		if (isInfinity) {
			const activeQuestion = state.questions[0]
			if (!activeQuestion) return
			const correct = activeQuestion.correctAnswer

			document.querySelectorAll('.answers-inf-active button').forEach(answer => {
				if (answer.textContent === correct) {
					answer.click()
				}
			})
			set(state => ({ wildCards: { ...state.wildCards, skip: state.wildCards.skip - 1 } }))
		} else {
			document.querySelectorAll(`.answers-${state.currentQuestion} button`).forEach(answer => {
				if (answer.textContent === state.questions[state.currentQuestion - 1].correctAnswer) {
					answer.click()
				}
			})
			set(state => ({ wildCards: { ...state.wildCards, skip: state.wildCards.skip - 1 } }))
		}
	},
	useHalfCard: () => {
		const state = get()
		const isInfinity = state.queries.infinitymode
		const finalQuestion = state.questionProgress
		const isDisabled = state.wildCards.half < 1 || state.win !== undefined || state.currentQuestion !== finalQuestion

		if (isDisabled) return

		set(state => ({ wildCards: { ...state.wildCards, half: state.wildCards.half - 1 } }))

		const selector = isInfinity ? '.answers-inf-active button' : `.answers-${state.currentQuestion} button`
		const answers = document.querySelectorAll(selector)
		const correct = isInfinity ? state.questions[0].correctAnswer : state.questions[state.currentQuestion - 1].correctAnswer
		const wrongs = [...answers].filter(answer => answer.textContent !== correct)

		wrongs.sort(() => Math.random() - 0.5).slice(0, 2).forEach(wrong => {
			wrong.classList.add('wrongAnswer')
			wrong.parentNode.classList.add('vibrate')
			wrong.disabled = true
		})
	},
	useLivesCard: () => set(state => ({ wildCards: { ...state.wildCards, lives: state.wildCards.lives - 1 } })),
	cleanWildCards: () => set({ wildCards: defaultWildCards, skippingActiveQuestion: false }),
	noWildCards: () => set({ wildCards: noWildCards, skippingActiveQuestion: false }),
	infiniteLifes: () => set({ wildCards: infiniteLifes, skippingActiveQuestion: false }),
})
