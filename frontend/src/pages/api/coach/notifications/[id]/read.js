/**
 * BFF proxy: PATCH /api/coach/notifications/:notificationId/read
 * Marks a notification as read via Spring Boot
 */
export default async function handler(req, res) {
	if (req.method !== 'PATCH') {
		return res.status(405).json({ message: 'Method not allowed' })
	}

	const { id: notificationId } = req.query
	if (!notificationId) {
		return res.status(400).json({ message: 'notificationId is required' })
	}

	const backendUrl = process.env.REST_API_URL || 'http://localhost:8080'

	try {
		const response = await fetch(`${backendUrl}/notification/${notificationId}/read`, {
			method: 'PATCH',
		})
		if (!response.ok) {
			return res.status(response.status).json({ message: 'Failed to mark notification' })
		}
		return res.status(204).end()
	} catch (error) {
		console.error('Notification mark-read error:', error)
		return res.status(502).json({ message: 'Backend unavailable' })
	}
}
