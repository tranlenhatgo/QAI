export const ADAPTIVE_AI_CONTEXT_LIMIT = 20

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
		source: question.source || (question.ia ? 'adaptive_ai' : 'static_json'),
		...pickAdaptiveMetadata(question),
	}
}

export function buildAdaptiveAiRequestBody(state) {
	const recentTexts = [
		...(state.adaptiveRecentQuestions || []),
		...(state.adaptiveHistory || []).map(item => item.question),
		...(state.adaptiveQueue || []).map(item => item.question),
		...(state.questions || []).map(item => item.question),
	].filter(Boolean)

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
