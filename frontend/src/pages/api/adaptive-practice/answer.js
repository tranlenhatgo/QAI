import withAuth from '@/lib/withAuth'

const ALLOWED_SOURCES = new Set(['static_json', 'adaptive_ai', 'repeat'])

function validateBody(body) {
	if (!String(body?.category || '').trim()) return 'category is required'
	if (!String(body?.question || '').trim()) return 'question is required'
	if (!Array.isArray(body?.answers) || body.answers.length !== 4) return 'answers must contain exactly 4 options'
	if (!String(body?.correctAnswer || '').trim()) return 'correctAnswer is required'
	if (typeof body?.correct !== 'boolean') return 'correct is required'
	if (!ALLOWED_SOURCES.has(String(body?.source || '').trim())) return 'source must be static_json, adaptive_ai, or repeat'
	return null
}

async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 })
	}

	const validationError = validateBody(req.body)
	if (validationError) {
		return res.status(400).json({ message: validationError, statusCode: 400 })
	}

	const apiRoot = process.env.REST_API_URL?.replace(/\/+$/, '')
	if (!apiRoot) {
		return res.status(500).json({ message: 'REST_API_URL is not configured', statusCode: 500 })
	}

	try {
		const response = await fetch(`${apiRoot}/adaptive-practice/answer`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${req.idToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(req.body),
		})
		const data = await response.json().catch(() => ({}))

		if (!response.ok) {
			return res.status(response.status).json({
				message: data.message || 'Failed to save adaptive practice answer',
				statusCode: response.status,
			})
		}

		return res.status(200).json(data)
	} catch (error) {
		console.error('[adaptive-practice/answer] Failed to proxy request', error.message)
		return res.status(500).json({ message: 'Internal Server Error', statusCode: 500 })
	}
}

export default withAuth(handler)
