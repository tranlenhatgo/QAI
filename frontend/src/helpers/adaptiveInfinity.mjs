export const ADAPTIVE_AI_CONTEXT_LIMIT = 20
export const ADAPTIVE_LITE_CONTEXT_LIMIT = 5
export const ADAPTIVE_FULL_CONTEXT_LIMIT = 20
export const ADAPTIVE_LITE_BATCH_SIZE = 5
export const ADAPTIVE_FULL_BATCH_SIZE = 10
export const ADAPTIVE_LITE_CATEGORY_LIMIT = 2
export const ADAPTIVE_FULL_CATEGORY_LIMIT = 3

const ADAPTIVE_METADATA_FIELDS = [
	'templateId',
	'subskill',
	'difficulty',
	'explanation',
	'adaptationReason',
	'planningIntent',
	'validationStatus',
	'masteryBefore',
	'masteryAfter',
	'attemptIndex',
]

export function adaptiveCategoryLimitForTier(tier) {
	return tier === 'full' ? ADAPTIVE_FULL_CATEGORY_LIMIT : ADAPTIVE_LITE_CATEGORY_LIMIT
}

export function adaptiveBatchSizeForTier(tier) {
	return tier === 'full' ? ADAPTIVE_FULL_BATCH_SIZE : ADAPTIVE_LITE_BATCH_SIZE
}

export function adaptiveContextLimitForTier(tier) {
	return tier === 'full' ? ADAPTIVE_FULL_CONTEXT_LIMIT : ADAPTIVE_LITE_CONTEXT_LIMIT
}

export function normalizeAdaptiveCategoryIds(categories, {
	infinitymode = false,
	tier = 'lite',
	validCategoryIds = [],
	fallbackCategoryId,
} = {}) {
	const valid = new Set(validCategoryIds)
	const fallback = fallbackCategoryId || validCategoryIds[0]
	const rawCategories = Array.isArray(categories)
		? categories
		: typeof categories === 'string'
			? categories.split(',')
			: []
	const selected = []

	for (const category of rawCategories) {
		if (!valid.has(category) || selected.includes(category)) continue
		selected.push(category)
	}

	if (selected.length === 0 && fallback) selected.push(fallback)

	const limit = infinitymode ? adaptiveCategoryLimitForTier(tier) : 1
	return selected.slice(0, limit)
}

export function buildMultiCategoryStaticQueue(categoryStates = []) {
	const queues = categoryStates.map(state => ({
		categoryName: state.categoryName,
		staticQuestions: Array.isArray(state.staticQuestions) ? state.staticQuestions : [],
	}))
	const queue = []
	let index = 0
	let added = true

	while (added) {
		added = false
		for (const state of queues) {
			const question = state.staticQuestions[index]
			if (!question) continue
			queue.push({
				...question,
				topic: question.topic || state.categoryName,
			})
			added = true
		}
		index += 1
	}

	return queue
}

function evenAllocation(categories, totalCount) {
	const allocation = {}
	const base = Math.floor(totalCount / categories.length)
	let remainder = totalCount % categories.length
	for (const category of categories) {
		allocation[category] = base + (remainder > 0 ? 1 : 0)
		remainder -= 1
	}
	return allocation
}

export function allocateAdaptiveCategoryCounts(categories, wrongScores = {}, { tier = 'lite', count } = {}) {
	const selected = [...new Set((categories || []).filter(Boolean))]
	const limit = adaptiveCategoryLimitForTier(tier)
	const totalCount = count || adaptiveBatchSizeForTier(tier)

	if (selected.length === 0) return {}
	if (selected.length > limit) {
		throw new Error(`${tier === 'full' ? 'full' : 'lite'} supports at most ${limit} categories`)
	}
	if (selected.length > totalCount) {
		throw new Error('selected categories cannot exceed generated question count')
	}

	const normalizedScores = Object.fromEntries(
		selected.map(category => [category, Math.max(Number(wrongScores[category] || 0), 0)])
	)
	const scoreTotal = Object.values(normalizedScores).reduce((sum, score) => sum + score, 0)
	if (scoreTotal <= 0) return evenAllocation(selected, totalCount)

	const sortedByScore = [...selected].sort((a, b) => normalizedScores[b] - normalizedScores[a])
	if (
		selected.length === 2 &&
		normalizedScores[sortedByScore[0]] >= normalizedScores[sortedByScore[1]] * 2
	) {
		return {
			[sortedByScore[0]]: totalCount - 1,
			[sortedByScore[1]]: 1,
		}
	}

	const allocation = Object.fromEntries(selected.map(category => [category, 1]))
	let remaining = totalCount - selected.length
	const remainders = []

	for (const category of selected) {
		const exact = (normalizedScores[category] / scoreTotal) * remaining
		const whole = Math.floor(exact)
		allocation[category] += whole
		remainders.push({ category, remainder: exact - whole, score: normalizedScores[category] })
	}

	remaining = totalCount - Object.values(allocation).reduce((sum, value) => sum + value, 0)
	remainders
		.sort((a, b) => b.remainder - a.remainder || b.score - a.score || selected.indexOf(a.category) - selected.indexOf(b.category))
		.slice(0, remaining)
		.forEach(item => {
			allocation[item.category] += 1
		})

	return allocation
}

function normalizeCategoryName(value) {
	return String(value || '').trim().toLowerCase()
}

function trimContext(context, limit) {
	return {
		category: normalizeCategoryName(context.category),
		history: Array.isArray(context.history) ? context.history.slice(-limit) : [],
		wrong_questions: Array.isArray(context.wrong_questions) ? context.wrong_questions.slice(-limit) : [],
		recent_questions: Array.isArray(context.recent_questions) ? context.recent_questions.slice(-limit) : [],
	}
}

export function calculateAdaptiveWrongScores(categoryContexts = []) {
	return categoryContexts.reduce((scores, context) => {
		const category = normalizeCategoryName(context.category)
		if (!category) return scores
		const recentWrongAnswerCount = (Array.isArray(context.history) ? context.history : [])
			.filter(item => item?.wasCorrect === false)
			.length
		const activeWrongRepeatCount = Array.isArray(context.wrong_questions) ? context.wrong_questions.length : 0
		scores[category] = (scores[category] || 0) + (activeWrongRepeatCount * 2) + recentWrongAnswerCount
		return scores
	}, {})
}

export function buildAdaptiveCoachRequestPayload(body = {}, { tier = 'lite' } = {}) {
	const resolvedTier = tier === 'full' ? 'full' : 'lite'
	const count = adaptiveBatchSizeForTier(resolvedTier)
	const contextLimit = adaptiveContextLimitForTier(resolvedTier)
	const categoryContexts = Array.isArray(body.category_contexts) ? body.category_contexts : []
	const explicitCategories = Array.isArray(body.categories) ? body.categories : []
	const normalizedCategories = [...new Set([
		...explicitCategories.map(normalizeCategoryName),
		...categoryContexts.map(context => normalizeCategoryName(context.category)),
	].filter(Boolean))]

	if (normalizedCategories.length <= 1 && body.category) {
		return {
			category: normalizeCategoryName(body.category),
			count,
			history: Array.isArray(body.history) ? body.history.slice(-contextLimit) : [],
			wrong_questions: Array.isArray(body.wrong_questions) ? body.wrong_questions.slice(-contextLimit) : [],
			recent_questions: Array.isArray(body.recent_questions) ? body.recent_questions.slice(-contextLimit) : [],
			tier: resolvedTier,
		}
	}

	const allocation = allocateAdaptiveCategoryCounts(
		normalizedCategories,
		calculateAdaptiveWrongScores(categoryContexts),
		{ tier: resolvedTier, count },
	)
	const contextsByCategory = new Map(categoryContexts.map(context => [normalizeCategoryName(context.category), context]))

	return {
		categories: normalizedCategories,
		count,
		category_contexts: normalizedCategories.map(category => ({
			...trimContext(contextsByCategory.get(category) || { category }, contextLimit),
			requestedCount: allocation[category],
		})),
		tier: resolvedTier,
	}
}

export function pickAdaptiveMetadata(question) {
	return ADAPTIVE_METADATA_FIELDS.reduce((metadata, field) => {
		const value = question?.[field]
		if (value !== undefined && value !== null && value !== '') {
			metadata[field] = value
		}
		return metadata
	}, {})
}

export function historyItemFromQuestion(question, selectedAnswer, correct) {
	return {
		question: question.question,
		answers: question.answers,
		correctAnswer: question.correctAnswer,
		selectedAnswer,
		wasCorrect: correct,
		category: question.topic || question.category || null,
		source: question.source || (question.ia ? 'adaptive_ai' : 'static_json'),
		...pickAdaptiveMetadata(question),
	}
}

function categoryMatches(value, category) {
	return normalizeCategoryName(value) === normalizeCategoryName(category)
}

function questionCategory(question) {
	return question?.topic || question?.category || null
}

export function buildAdaptiveAiRequestBody(state) {
	const categoryNames = Array.isArray(state.adaptiveCategoryNames) && state.adaptiveCategoryNames.length > 0
		? state.adaptiveCategoryNames
		: state.adaptiveCategoryName
			? [state.adaptiveCategoryName]
			: []
	const recentTexts = [
		...(state.adaptiveRecentQuestions || []),
		...(state.adaptiveHistory || []).map(item => item.question),
		...(state.adaptiveQueue || []).map(item => item.question),
		...(state.questions || []).map(item => item.question),
	].filter(Boolean)

	if (categoryNames.length > 1) {
		const queueAndVisibleQuestions = [
			...(state.adaptiveRecentQuestions || []).map(item => typeof item === 'string' ? { question: item } : item),
			...(state.adaptiveHistory || []),
			...(state.adaptiveQueue || []),
			...(state.questions || []),
		]
		return {
			categories: categoryNames,
			category_contexts: categoryNames.map(category => ({
				category,
				history: (state.adaptiveRecentAnswers || [])
					.filter(item => categoryMatches(item.category || item.topic, category))
					.slice(-ADAPTIVE_AI_CONTEXT_LIMIT),
				wrong_questions: (state.adaptiveWrongQueue || [])
					.filter(item => categoryMatches(questionCategory(item.question), category))
					.slice(-ADAPTIVE_AI_CONTEXT_LIMIT)
					.map(item => ({
						...historyItemFromQuestion(item.question, item.question.selectedAnswer || null, false),
						wrongCount: item.wrongCount,
					})),
				recent_questions: [...new Set(queueAndVisibleQuestions
					.filter(item => categoryMatches(questionCategory(item), category))
					.map(item => item.question)
					.filter(Boolean))]
					.slice(-ADAPTIVE_AI_CONTEXT_LIMIT),
			})),
		}
	}

	return {
		category: state.adaptiveCategoryName,
		history: (state.adaptiveRecentAnswers || []).slice(-ADAPTIVE_AI_CONTEXT_LIMIT),
		wrong_questions: (state.adaptiveWrongQueue || []).slice(-ADAPTIVE_AI_CONTEXT_LIMIT).map(item => ({
			...historyItemFromQuestion(item.question, item.question.selectedAnswer || null, false),
			wrongCount: item.wrongCount,
		})),
		recent_questions: [...new Set(recentTexts)].slice(-ADAPTIVE_AI_CONTEXT_LIMIT),
	}
}

export function buildAdaptiveAnswerPayload(question, selectedAnswer, correct, state = {}) {
	return {
		category: normalizeCategoryName(question.topic || question.category || state.adaptiveCategoryName),
		sourceQuestionId: question.sourceQuestionId,
		question: question.question,
		answers: question.answers,
		correctAnswer: question.correctAnswer,
		selectedAnswer,
		correct,
		source: question.repeated ? 'repeat' : (question.source || 'static_json'),
		repeated: !!question.repeated,
		generatedFromQuestion: question.generatedFromQuestion || null,
		...pickAdaptiveMetadata(question),
	}
}

export function shouldPrefetchAdaptiveAi(state) {
	if (!state.queries?.infinitymode || state.adaptiveAiLoading) return false
	if (state.adaptiveSessionState && !state.adaptiveSessionState.hasStaticHistoryInCategory) {
		const answeredStaticCount = (state.adaptiveRecentAnswers || [])
			.filter(answer => answer.source === 'static_json')
			.length
		if (answeredStaticCount < 5) return false
	}
	return (state.adaptiveQueue || []).length <= 5
}

export function shouldShowClassicControls(queries) {
	return !(queries?.infinitymode === true || queries?.infinitymode === 'true')
}
