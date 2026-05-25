const COACH_URL = process.env.STUDY_COACH_API_URL || 'http://localhost:8000'

export default async function handler (req, res) {
	if (req.method !== 'POST') return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 })
	if (!req.body.topics) return res.status(400).json({ message: 'Topics are required', statusCode: 400 })

	try {
		const headers = { 'Content-Type': 'application/json' }
		if (process.env.COACH_API_KEY) {
			headers['X-API-Key'] = process.env.COACH_API_KEY
		}

		const response = await fetch(`${COACH_URL}/generate/from-topics`, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				topics: req.body.topics,
				count: 1, // 1 question per topic (matches old Cohere behavior of 3 topics × 1)
			}),
		})

		if (!response.ok) {
			const errorData = await response.json()
			return res.status(response.status).json({
				message: errorData.detail || 'Failed to generate questions',
				statusCode: response.status,
			})
		}

		const data = await response.json()

		// Transform to the format expected by getQuestions.js consumer
		const questions = data.questions.map(q => ({
			question: q.question,
			topic: req.body.topics[0] || 'general',
			answers: q.answers,
			correctAnswer: q.correctAnswer,
			userAnswer: undefined,
			ia: true,
		}))

		return res.status(200).json(questions)
	} catch (error) {
		console.error('Error generating questions:', error.message)
		return res.status(500).json({ message: 'Internal Server Error', statusCode: 500 })
	}
}
