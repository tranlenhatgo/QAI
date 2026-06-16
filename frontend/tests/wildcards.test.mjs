import test from 'node:test'
import assert from 'node:assert/strict'
import { useWildcardsStore } from '../src/store/useWildcards.js'

test('useWildcardsStore initializes correctly', () => {
	let state = {
		wildCards: { skip: 1, half: 1, lives: 1 },
		skippingActiveQuestion: false,
		win: undefined,
		currentQuestion: 1,
		questionProgress: 1,
		queries: { infinitymode: false },
		questions: [{ question: 'Q1', answers: ['A', 'B'], correctAnswer: 'A' }],
	}

	const set = (updater) => {
		const next = typeof updater === 'function' ? updater(state) : updater
		state = { ...state, ...next }
	}
	const get = () => state

	const store = useWildcardsStore(set, get)

	assert.equal(state.wildCards.skip, 1)
	assert.equal(state.skippingActiveQuestion, false)
})

test('useWildcardsStore guards skip card when count is zero', () => {
	let state = {
		wildCards: { skip: 0, half: 1, lives: 1 },
		win: undefined,
		currentQuestion: 1,
		questionProgress: 1,
		queries: { infinitymode: false },
		questions: [{ question: 'Q1', answers: ['A', 'B'], correctAnswer: 'A' }],
	}

	const set = (updater) => {
		const next = typeof updater === 'function' ? updater(state) : updater
		state = { ...state, ...next }
	}
	const get = () => state

	const store = useWildcardsStore(set, get)
	store.useSkipCard()

	// Should not decrement or change skipping state
	assert.equal(state.wildCards.skip, 0)
	assert.equal(state.skippingActiveQuestion, undefined)
})

test('useWildcardsStore guards skip card when not on current active question', () => {
	let state = {
		wildCards: { skip: 1, half: 1, lives: 1 },
		win: undefined,
		currentQuestion: 1,
		questionProgress: 2,
		queries: { infinitymode: false },
		questions: [
			{ question: 'Q1', answers: ['A', 'B'], correctAnswer: 'A' },
			{ question: 'Q2', answers: ['C', 'D'], correctAnswer: 'C' },
		],
	}

	const set = (updater) => {
		const next = typeof updater === 'function' ? updater(state) : updater
		state = { ...state, ...next }
	}
	const get = () => state

	const store = useWildcardsStore(set, get)
	store.useSkipCard()

	// Should not decrement or change skipping state since currentQuestion !== questionProgress
	assert.equal(state.wildCards.skip, 1)
	assert.equal(state.skippingActiveQuestion, undefined)
})

test('useWildcardsStore guards half card when count is zero or on past question', () => {
	let state = {
		wildCards: { skip: 1, half: 0, lives: 1 },
		win: undefined,
		currentQuestion: 1,
		questionProgress: 1,
		queries: { infinitymode: false },
		questions: [{ question: 'Q1', answers: ['A', 'B'], correctAnswer: 'A' }],
	}

	const set = (updater) => {
		const next = typeof updater === 'function' ? updater(state) : updater
		state = { ...state, ...next }
	}
	const get = () => state

	const store = useWildcardsStore(set, get)
	store.useHalfCard()

	assert.equal(state.wildCards.half, 0)

	// Test on past question with count = 1
	state.wildCards.half = 1
	state.currentQuestion = 1
	state.questionProgress = 2
	store.useHalfCard()
	assert.equal(state.wildCards.half, 1)
})
