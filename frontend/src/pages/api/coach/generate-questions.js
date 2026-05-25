import withAuth from '@/lib/withAuth'

const COACH_URL = process.env.STUDY_COACH_API_URL || 'http://localhost:8000'
const MAX_COUNT = 20

function normalizeTopics(value) {
	if (Array.isArray(value)) {
		return value.map(topic => String(topic || '').trim()).filter(Boolean)
	}
	const topic = String(value || '').trim()
	return topic ? [topic] : []
}

function normalizeCount(value) {
	const count = Number(value)
	if (!Number.isFinite(count)) return 5
	if (count < 1) return 1
	if (count > MAX_COUNT) return MAX_COUNT
	return Math.round(count)
}

async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 })
	}

	const topics = normalizeTopics(req.body?.topics || req.body?.topic)
	const count = normalizeCount(req.body?.count)

	if (topics.length === 0) {
		return res.status(400).json({ message: 'topics are required', statusCode: 400 })
	}

	try {
		const headers = { 'Content-Type': 'application/json' }
		const apiKey = process.env.COACH_API_KEY || process.env.STUDY_COACH_API_KEY
		if (apiKey) headers['X-API-Key'] = apiKey

		const upstreamResponse = await fetch(`${COACH_URL.replace(/\/+$/, '')}/generate/from-topics`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ topics, count }),
		})

		const data = await upstreamResponse.json().catch(() => ({}))

		if (!upstreamResponse.ok) {
			return res.status(upstreamResponse.status).json({
				message: data.detail || data.message || 'Failed to generate questions',
				statusCode: upstreamResponse.status,
			})
		}

		return res.status(200).json({
			questions: Array.isArray(data.questions) ? data.questions : [],
		})
	} catch (error) {
		console.error('[coach/generate-questions] Failed to proxy request', error.message)
		return res.status(500).json({
			message: 'Internal Server Error',
			statusCode: 500,
		})
	}
}

export default withAuth(handler)
