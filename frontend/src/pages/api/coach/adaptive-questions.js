import withAuth from '@/lib/withAuth'
import { resolveBestCoachTierForRequest } from '@/lib/coachSubscription'
import { buildAdaptiveCoachRequestPayload } from '@/helpers/adaptiveInfinity.mjs'

const COACH_URL = process.env.STUDY_COACH_API_URL || 'http://localhost:8000'

async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 })
	}

	const category = String(req.body?.category || '').trim()
	const categories = Array.isArray(req.body?.categories) ? req.body.categories.filter(Boolean) : []
	const categoryContexts = Array.isArray(req.body?.category_contexts) ? req.body.category_contexts : []
	if (!category && categories.length === 0 && categoryContexts.length === 0) {
		return res.status(400).json({ message: 'category is required', statusCode: 400 })
	}

	try {
		const tier = await resolveBestCoachTierForRequest(req)
		const upstreamBody = buildAdaptiveCoachRequestPayload(req.body, { tier })
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
			body: JSON.stringify(upstreamBody),
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
			count: upstreamBody.count,
			contextLimit: tier === 'full' ? 20 : 5,
		})
	} catch (error) {
		if (error.message?.includes('supports at most')) {
			return res.status(400).json({ message: error.message, statusCode: 400 })
		}
		console.error('[coach/adaptive-questions] Failed to proxy request', error.message)
		return res.status(500).json({ message: 'Internal Server Error', statusCode: 500 })
	}
}

export default withAuth(handler)
