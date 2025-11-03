import { create } from 'zustand'
import { useWildcardsStore } from './useWildcards'
import { useQueriesStore } from './useQueries'
import { useQuestionsStore } from './useQuestions'
import { useAuthStore } from './useAuth'
import { useCreateQuestionsStore } from './useCreate'

export const useBoundStore = create((...a) => ({
	...useWildcardsStore(...a),
	...useQueriesStore(...a),
	...useQuestionsStore(...a),
	...useAuthStore(...a),
	...useCreateQuestionsStore(...a),
}))
