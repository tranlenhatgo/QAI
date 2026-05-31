import withAuth from '@/lib/withAuth'

async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 })
	}

	const apiRoot = process.env.REST_API_URL?.replace(/\/+$/, '')
	if (!apiRoot) {
		return res.status(500).json({ message: 'REST_API_URL is not configured', statusCode: 500 })
	}

	try {
		const response = await fetch(`${apiRoot}/subscription/signup`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${req.idToken}`,
			},
		})
		const data = await response.json().catch(() => ({}))

		if (!response.ok) {
			return res.status(response.status).json({
				message: data.message || 'Failed to create subscription',
				statusCode: response.status,
			})
		}

		return res.status(200).json(data)
	} catch (error) {
		console.error('[subscription/signup] Failed to proxy request', error.message)
		return res.status(500).json({ message: 'Internal Server Error', statusCode: 500 })
	}
}

export default withAuth(handler)
