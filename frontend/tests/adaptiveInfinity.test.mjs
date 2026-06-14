import test from 'node:test'
import assert from 'node:assert/strict'

import {
	buildAdaptiveAiRequestBody,
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
