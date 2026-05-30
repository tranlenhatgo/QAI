import withAuth from '@/lib/withAuth'

const COACH_URL = process.env.STUDY_COACH_API_URL || 'http://localhost:8000'
const TIMEOUT_MS = Number(process.env.STUDY_COACH_TIMEOUT_MS || 60000)

async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 })
	}

	const { question, answers, correctAnswer, tier } = req.body || {}
	if (!question) {
		return res.status(400).json({ message: 'question is required', statusCode: 400 })
	}

	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

	try {
		const headers = { 'Content-Type': 'application/json' }
		const apiKey = process.env.COACH_API_KEY || process.env.STUDY_COACH_API_KEY
		if (apiKey) headers['X-API-Key'] = apiKey

		const upstreamResponse = await fetch(`${COACH_URL.replace(/\/+$/, '')}/explain-answer`, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				question,
				answers: answers || [],
				correct_answer: correctAnswer || null,
				user_id: req.userId,
				tier: tier || null,
			}),
			signal: controller.signal,
		})

		clearTimeout(timeout)

		if (!upstreamResponse.ok) {
			const text = await upstreamResponse.text().catch(() => '')
			return res.status(upstreamResponse.status).json({
				message: text || 'Upstream error',
				statusCode: upstreamResponse.status,
			})
		}

		const data = await upstreamResponse.json()
		return res.status(200).json(data)
	} catch (err) {
		clearTimeout(timeout)
		if (err.name === 'AbortError') {
			return res.status(504).json({ message: 'Coach explanation timeout', statusCode: 504 })
		}
		return res.status(500).json({ message: err.message || 'Internal error', statusCode: 500 })
	}
}

export default withAuth(handler)
