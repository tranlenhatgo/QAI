import withAuth from '@/lib/withAuth'

const COACH_URL = process.env.STUDY_COACH_API_URL || 'http://localhost:8000'
const TIMEOUT_MS = 60000

async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 })
	}

	const problem = typeof req.body?.problem === 'string' ? req.body.problem.trim() : ''
	if (!problem) {
		return res.status(400).json({ message: 'problem is required', statusCode: 400 })
	}

	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

	try {
		const headers = { 'Content-Type': 'application/json' }
		const apiKey = process.env.COACH_API_KEY || process.env.STUDY_COACH_API_KEY
		if (apiKey) headers['X-API-Key'] = apiKey

		const upstreamResponse = await fetch(`${COACH_URL.replace(/\/+$/, '')}/solve`, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				problem,
				user_id: req.userId,
			}),
			signal: controller.signal,
		})

		const data = await upstreamResponse.json().catch(() => ({}))

		if (!upstreamResponse.ok) {
			return res.status(upstreamResponse.status).json({
				message: data.detail || data.message || 'Problem solving failed',
				statusCode: upstreamResponse.status,
			})
		}

		return res.status(200).json(data)
	} catch (error) {
		const isTimeout = error?.name === 'AbortError'
		console.error('[coach/solve] Failed to proxy request', error.message)
		return res.status(isTimeout ? 504 : 500).json({
			message: isTimeout ? 'Coach solver timeout' : 'Internal Server Error',
			statusCode: isTimeout ? 504 : 500,
		})
	} finally {
		clearTimeout(timeout)
	}
}

export default withAuth(handler)
