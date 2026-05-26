/**
 * BFF proxy: GET /api/coach/notifications/:userId
 * Fetches unread notifications from Spring Boot /notification/user/:userId/unread
 */
export default async function handler(req, res) {
	if (req.method !== 'GET') {
		return res.status(405).json({ message: 'Method not allowed' })
	}

	const { id: userId } = req.query
	if (!userId) {
		return res.status(400).json({ message: 'userId is required' })
	}

	const backendUrl = process.env.REST_API_URL || 'http://localhost:8080'

	try {
		const response = await fetch(`${backendUrl}/notification/user/${userId}/unread`)
		if (!response.ok) {
			return res.status(response.status).json({ message: 'Failed to fetch notifications' })
		}
		const data = await response.json()
		return res.status(200).json(data)
	} catch (error) {
		console.error('Notification fetch error:', error)
		return res.status(502).json({ message: 'Backend unavailable' })
	}
}
