import saveQuestions from "@/helpers/quiz/saveQuestions";
import saveQuiz from "@/helpers/quiz/saveQuiz";
import categoriesJSON from '@/assets/categories.json';
import generateQuestion from "@/helpers/question/generateQuestion";
import { use } from "react";
import getQuestionsByQuizId from "@/helpers/question/getQuestionsByQuizId";
import updateQuestions from "@/helpers/quiz/updateQuizQuestions";

export const useCreateQuestionsStore = (set, get) => ({
	createdQuestions: [],
	createdCategories: [],
	hasFile: false,
	createdWildcards: { skip: 0, half: 0, lives: 0 },
	quizId: null,
	quizQuery: {
		uid: "",
		roomName: "",
		roomDesc: "",
		startTime: "",
		endTime: "",
		categories: categoriesJSON.map((cat) => cat.name),
	},
	update: false,

	// Clean-up methods
	cleanCreateQuestions: () => {
		set({ createdQuestions: [] });
		set({ quizId: null });
		set({ update: false });
		set({ createdWildcards: { skip: 0, half: 0, lives: 0 } });
		set({ createdCategories: [] });
	},
	cleanCreateWildcards: () => set({ createdWildcards: { skip: 0, half: 0, lives: 0 } }),
	cleanCreateCategories: () => set({ createdCategories: [] }),

	// Add/remove methods
	addCreatedQuestion: (question) =>
		set((state) => ({ createdQuestions: [...state.createdQuestions, question] })),
	removeCreatedQuestion: (index) =>
		set((state) => ({
			createdQuestions: state.createdQuestions.filter((_, i) => i !== index),
		})),
	generateQuestion: async (quizId) => {
		try {
			const question = await generateQuestion(quizId);
			set((state) => ({
				createdQuestions: [question, ...state.createdQuestions],
			}));
		} catch (error) {
			console.error("Error generating question:", error);
		}
	},

	addCreatedCategory: (category) =>
		set((state) => ({ createdCategories: [...state.createdCategories, category] })),
	removeCreatedCategory: (index) =>
		set((state) => ({
			createdCategories: state.createdCategories.filter((_, i) => i !== index),
		})),

	// Setter for quizQuery
	setQuizQuery: (key, value) =>
		set((state) => ({
			quizQuery: {
				...state.quizQuery,
				[key]: value,
			},
		})),

	// Save questions
	saveQuestions: async () => {
		const { createdQuestions, quizId } = get();
		if (!quizId) {
			console.error("Quiz ID is missing. Cannot save questions.");
			return;
		}

		try {
			const response = await saveQuestions(createdQuestions, quizId);
			console.log("Questions saved successfully:", response);
		} catch (error) {
			console.error("Error saving questions:", error);
		}
	},

	// Save quiz
	saveQuiz: async () => {
		const { quizQuery } = get();
		const { uid, roomName, roomDesc, startTime, endTime, categories } = quizQuery;

		saveQuiz(roomName, roomDesc, startTime, endTime, categories, uid)
			.then((response) => {
				set({ quizId: response.quizId });
				console.log("QuizId:", response.quizId);
				if (response.statusCode >= 400) {
					return set({ error: [true, response.message] });
				}
			})
			.catch((error) => {
				set({ error: [true, error.message] });
			});
	},

	setCreatedQuestions: async (id) => {
		try {
			const data = await getQuestionsByQuizId(id)
			set({ createdQuestions: data });
			set({ quizId: id });
		} catch (err) {
			set({ error: [true, err] })
		} finally {
			set({ loading: false })
		}
	},

	setCreateQuestions: (questions) => set({ createdQuestions: questions }),

	updateQuizQuestions: async () => {
		const { createdQuestions, quizId } = get();
		if (!quizId) {
			console.error("Quiz ID is missing. Cannot save questions.");
			return;
		}

		try {
			const response = await updateQuestions(createdQuestions, quizId);
			console.log("Questions saved successfully:", response);
		} catch (error) {
			console.error("Error saving questions:", error);
		}
	},

	setUpdate: (update) => set({ update }),
	setQuizId: (quizId) => set({ quizId }),
});
