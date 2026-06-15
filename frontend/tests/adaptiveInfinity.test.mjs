import test from 'node:test'
import assert from 'node:assert/strict'

import {
	adaptiveCategoryLimitForTier,
	allocateAdaptiveCategoryCounts,
	buildAdaptiveAnswerPayload,
	buildAdaptiveAiRequestBody,
	buildAdaptiveCoachRequestPayload,
	buildMultiCategoryStaticQueue,
	normalizeAdaptiveCategoryIds,
	shouldPrefetchAdaptiveAi,
	shouldShowClassicControls,
} from '../src/helpers/adaptiveInfinity.mjs'
import { resolveVisibleCoachTier } from '../src/helpers/coachTier.mjs'

test('cold-start AI request includes completed static warmup answer history', () => {
	const state = {
		adaptiveCategoryName: 'Literature',
		adaptiveRecentAnswers: [
			{
				question: 'Who wrote Romeo and Juliet?',
				answers: ['William Shakespeare', 'Charles Dickens', 'Jane Austen', 'Mark Twain'],
				correctAnswer: 'William Shakespeare',
				selectedAnswer: 'William Shakespeare',
				wasCorrect: true,
				source: 'static_json',
			},
			{
				question: 'What is the first book of the Harry Potter series?',
				answers: ['The Philosopher Stone', 'The Chamber of Secrets', 'The Prisoner of Azkaban', 'The Goblet of Fire'],
				correctAnswer: 'The Philosopher Stone',
				selectedAnswer: 'The Philosopher Stone',
				wasCorrect: true,
				source: 'static_json',
			},
			{
				question: 'Who wrote 1984?',
				answers: ['George Orwell', 'Aldous Huxley', 'Ray Bradbury', 'H.G. Wells'],
				correctAnswer: 'George Orwell',
				selectedAnswer: 'George Orwell',
				wasCorrect: true,
				source: 'static_json',
			},
			{
				question: 'What literary device gives human qualities to non-human things?',
				answers: ['Personification', 'Metaphor', 'Simile', 'Hyperbole'],
				correctAnswer: 'Personification',
				selectedAnswer: 'Personification',
				wasCorrect: true,
				source: 'static_json',
			},
			{
				question: 'Who is the author of The Great Gatsby?',
				answers: ['F. Scott Fitzgerald', 'Ernest Hemingway', 'John Steinbeck', 'William Faulkner'],
				correctAnswer: 'F. Scott Fitzgerald',
				selectedAnswer: 'F. Scott Fitzgerald',
				wasCorrect: true,
				source: 'static_json',
			},
		],
		adaptiveWrongQueue: [],
		adaptiveRecentQuestions: [],
		adaptiveHistory: [],
		adaptiveQueue: [],
		questions: [],
	}

	const body = buildAdaptiveAiRequestBody(state)

	assert.equal(body.category, 'Literature')
	assert.equal(body.history.length, 5)
	assert.deepEqual(body.history.map(item => item.source), [
		'static_json',
		'static_json',
		'static_json',
		'static_json',
		'static_json',
	])
	assert.deepEqual(body.history.map(item => item.wasCorrect), [true, true, true, true, true])
})

test('cold-start prefetch waits until static warmup answers are available', () => {
	const state = {
		queries: { infinitymode: true },
		adaptiveAiLoading: false,
		adaptiveSessionState: { hasStaticHistoryInCategory: false },
		adaptiveQueue: [{ question: 'Static 2' }, { question: 'Static 3' }],
		adaptiveRecentAnswers: [],
	}

	assert.equal(shouldPrefetchAdaptiveAi(state), false)
})

test('full subscription resolves to visible full tier', () => {
	const tier = resolveVisibleCoachTier({
		fullAccess: true,
		plan: 'monthly',
		subscriptionStatus: 'active',
	}, 'lite')

	assert.equal(tier, 'full')
})

test('Infinity Quiz hides Classic-only controls', () => {
	assert.equal(shouldShowClassicControls({ infinitymode: true }), false)
	assert.equal(shouldShowClassicControls({ infinitymode: 'true' }), false)
	assert.equal(shouldShowClassicControls({ infinitymode: false }), true)
})

test('Infinity mode preserves multiple selected categories within tier limit', () => {
	const categories = normalizeAdaptiveCategoryIds(['aa', 'ab', 'ac'], {
		infinitymode: true,
		tier: 'lite',
		validCategoryIds: ['aa', 'ab', 'ac'],
		fallbackCategoryId: 'aa',
	})

	assert.deepEqual(categories, ['aa', 'ab'])
})

test('Full Infinity mode allows three selected categories', () => {
	const categories = normalizeAdaptiveCategoryIds('aa,ab,ac,ad', {
		infinitymode: true,
		tier: 'full',
		validCategoryIds: ['aa', 'ab', 'ac', 'ad'],
		fallbackCategoryId: 'aa',
	})

	assert.deepEqual(categories, ['aa', 'ab', 'ac'])
})

test('Classic mode keeps one selected category', () => {
	const categories = normalizeAdaptiveCategoryIds(['aa', 'ab'], {
		infinitymode: false,
		tier: 'full',
		validCategoryIds: ['aa', 'ab'],
		fallbackCategoryId: 'aa',
	})

	assert.deepEqual(categories, ['aa'])
})

test('adaptive category limits are tier-specific', () => {
	assert.equal(adaptiveCategoryLimitForTier('lite'), 2)
	assert.equal(adaptiveCategoryLimitForTier('full'), 3)
	assert.equal(adaptiveCategoryLimitForTier('unknown'), 2)
})

test('multi-category static warmup interleaves selected categories', () => {
	const queue = buildMultiCategoryStaticQueue([
		{
			categoryName: 'Math',
			staticQuestions: [{ question: 'Math 1' }, { question: 'Math 2' }],
		},
		{
			categoryName: 'Science',
			staticQuestions: [{ question: 'Science 1' }],
		},
	])

	assert.deepEqual(queue.map(question => question.question), ['Math 1', 'Science 1', 'Math 2'])
	assert.deepEqual(queue.map(question => question.topic), ['Math', 'Science', 'Math'])
})

test('Lite allocation gives the largest share to the highest wrong-score category', () => {
	const allocation = allocateAdaptiveCategoryCounts(['Math', 'Science'], {
		Math: 6,
		Science: 2,
	}, { tier: 'lite' })

	assert.deepEqual(allocation, { Math: 4, Science: 1 })
})

test('Full allocation can spread questions across three categories', () => {
	const allocation = allocateAdaptiveCategoryCounts(['Math', 'Science', 'Literature'], {
		Math: 7,
		Science: 5,
		Literature: 1,
	}, { tier: 'full' })

	assert.deepEqual(allocation, { Math: 5, Science: 4, Literature: 1 })
})

test('allocation distributes evenly when there is no wrong signal', () => {
	const allocation = allocateAdaptiveCategoryCounts(['Math', 'Science', 'Literature'], {}, { tier: 'full' })

	assert.deepEqual(allocation, { Math: 4, Science: 3, Literature: 3 })
})

test('allocation rejects category counts above the tier limit', () => {
	assert.throws(() => allocateAdaptiveCategoryCounts(['Math', 'Science', 'Literature'], {}, { tier: 'lite' }), /lite supports at most 2 categories/)
	assert.throws(() => allocateAdaptiveCategoryCounts(['Math', 'Science', 'Literature', 'Sports'], {}, { tier: 'full' }), /full supports at most 3 categories/)
})

test('BFF adaptive request shaping allocates Lite category contexts by wrong signal', () => {
	const payload = buildAdaptiveCoachRequestPayload({
		categories: ['Math', 'Science'],
		category_contexts: [
			{
				category: 'Math',
				history: [
					{ question: 'M1', answers: ['1', '2', '3', '4'], correctAnswer: '1', selectedAnswer: '2', wasCorrect: false },
					{ question: 'M2', answers: ['1', '2', '3', '4'], correctAnswer: '1', selectedAnswer: '3', wasCorrect: false },
				],
				wrong_questions: [{ question: 'M1', answers: ['1', '2', '3', '4'], correctAnswer: '1' }],
				recent_questions: ['M1', 'M2'],
			},
			{
				category: 'Science',
				history: [{ question: 'S1', answers: ['A', 'B', 'C', 'D'], correctAnswer: 'A', selectedAnswer: 'A', wasCorrect: true }],
				wrong_questions: [],
				recent_questions: ['S1'],
			},
		],
	}, { tier: 'lite' })

	assert.equal(payload.tier, 'lite')
	assert.equal(payload.count, 5)
	assert.deepEqual(payload.categories, ['math', 'science'])
	assert.deepEqual(payload.category_contexts.map(context => [context.category, context.requestedCount]), [['math', 4], ['science', 1]])
})

test('BFF adaptive request shaping rejects over-limit categories by tier', () => {
	assert.throws(() => buildAdaptiveCoachRequestPayload({
		categories: ['Math', 'Science', 'Literature'],
		category_contexts: [],
	}, { tier: 'lite' }), /lite supports at most 2 categories/)

	assert.throws(() => buildAdaptiveCoachRequestPayload({
		categories: ['Math', 'Science', 'Literature', 'Sports'],
		category_contexts: [],
	}, { tier: 'full' }), /full supports at most 3 categories/)
})

test('BFF adaptive request shaping preserves Full tier total count', () => {
	const payload = buildAdaptiveCoachRequestPayload({
		categories: ['Math', 'Science', 'Literature'],
		category_contexts: [
			{ category: 'Math', history: [], wrong_questions: [], recent_questions: [] },
			{ category: 'Science', history: [], wrong_questions: [], recent_questions: [] },
			{ category: 'Literature', history: [], wrong_questions: [], recent_questions: [] },
		],
	}, { tier: 'full' })

	assert.equal(payload.count, 10)
	assert.equal(payload.category_contexts.reduce((sum, context) => sum + context.requestedCount, 0), 10)
	assert.deepEqual(payload.category_contexts.map(context => context.requestedCount), [4, 3, 3])
})

test('multi-category AI request groups history and wrong questions by category', () => {
	const body = buildAdaptiveAiRequestBody({
		adaptiveCategoryNames: ['Math', 'Science'],
		adaptiveRecentAnswers: [
			{ question: 'M1', answers: ['1', '2', '3', '4'], correctAnswer: '1', selectedAnswer: '2', wasCorrect: false, category: 'Math', source: 'static_json' },
			{ question: 'S1', answers: ['A', 'B', 'C', 'D'], correctAnswer: 'A', selectedAnswer: 'A', wasCorrect: true, category: 'Science', source: 'static_json' },
		],
		adaptiveWrongQueue: [
			{ question: { question: 'M1', answers: ['1', '2', '3', '4'], correctAnswer: '1', selectedAnswer: '2', topic: 'Math', source: 'static_json' }, wrongCount: 1 },
		],
		adaptiveRecentQuestions: [],
		adaptiveHistory: [],
		adaptiveQueue: [
			{ question: 'M2', topic: 'Math' },
			{ question: 'S2', topic: 'Science' },
		],
		questions: [],
	})

	assert.deepEqual(body.categories, ['Math', 'Science'])
	assert.equal(body.category_contexts.length, 2)
	assert.deepEqual(body.category_contexts.map(context => context.category), ['Math', 'Science'])
	assert.equal(body.category_contexts[0].history.length, 1)
	assert.equal(body.category_contexts[0].wrong_questions.length, 1)
	assert.equal(body.category_contexts[1].history.length, 1)
	assert.deepEqual(body.category_contexts[0].recent_questions, ['M2'])
	assert.deepEqual(body.category_contexts[1].recent_questions, ['S2'])
})

test('adaptive answer payload uses active question category', () => {
	const payload = buildAdaptiveAnswerPayload({
		question: 'Which science fact is true?',
		answers: ['A', 'B', 'C', 'D'],
		correctAnswer: 'A',
		topic: 'Science',
		sourceQuestionId: 'science:1',
		source: 'adaptive_ai',
	}, 'B', false, {
		adaptiveCategoryName: 'Math',
	})

	assert.equal(payload.category, 'science')
	assert.equal(payload.selectedAnswer, 'B')
	assert.equal(payload.correct, false)
})
