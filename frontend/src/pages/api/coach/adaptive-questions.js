import withAuth from '@/lib/withAuth'
import { resolveBestCoachTierForRequest } from '@/lib/coachSubscription'

const COACH_URL = process.env.STUDY_COACH_API_URL || 'http://localhost:8000'
const ADAPTIVE_TIER_LIMITS = {
	lite: { batchSize: 5, contextLimit: 5 },
	full: { batchSize: 10, contextLimit: 20 },
}

async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 })
	}

	const category = String(req.body?.category || '').trim()
	if (!category) {
		return res.status(400).json({ message: 'category is required', statusCode: 400 })
	}

	try {
		const tier = await resolveBestCoachTierForRequest(req)
		const limits = ADAPTIVE_TIER_LIMITS[tier] || ADAPTIVE_TIER_LIMITS.lite
		const headers = { 'Content-Type': 'application/json' }
		const apiKey = process.env.COACH_API_KEY || process.env.STUDY_COACH_API_KEY
		if (apiKey) headers['X-API-Key'] = apiKey
		const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
			? AbortSignal.timeout(600000)
			: undefined

		const upstreamResponse = await fetch(`${COACH_URL.replace(/\/+$/, '')}/generate/adaptive-questions`, {
			method: 'POST',
			headers,
			...(signal ? { signal } : {}),
			body: JSON.stringify({
				category,
				count: limits.batchSize,
				history: Array.isArray(req.body?.history) ? req.body.history.slice(-limits.contextLimit) : [],
				wrong_questions: Array.isArray(req.body?.wrong_questions) ? req.body.wrong_questions.slice(-limits.contextLimit) : [],
				recent_questions: Array.isArray(req.body?.recent_questions) ? req.body.recent_questions.slice(-limits.contextLimit) : [],
				tier,
			}),
		})
		const data = await upstreamResponse.json().catch(() => ({}))

		if (!upstreamResponse.ok) {
			return res.status(upstreamResponse.status).json({
				message: data.detail || data.message || 'Failed to generate adaptive questions',
				statusCode: upstreamResponse.status,
			})
		}

		return res.status(200).json({
			questions: Array.isArray(data.questions) ? data.questions : [],
			tier,
			count: limits.batchSize,
			contextLimit: limits.contextLimit,
		})
	} catch (error) {
		console.error('[coach/adaptive-questions] Failed to proxy request', error.message)
		return res.status(500).json({ message: 'Internal Server Error', statusCode: 500 })
	}
}

export default withAuth(handler)
