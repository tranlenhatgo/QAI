import withAuth from '@/lib/withAuth'

const COACH_URL = process.env.STUDY_COACH_API_URL || 'http://localhost:8000'

async function handler(req, res) {
	const { userId } = req.query

	if (!userId) {
		return res.status(400).json({ message: 'userId is required', statusCode: 400 })
	}

	const headers = {}
	const apiKey = process.env.STUDY_COACH_API_KEY || process.env.COACH_API_KEY
	if (apiKey) {
		headers['X-API-Key'] = apiKey
	}

	if (req.method === 'GET') {
		try {
			const backendResponse = await fetch(`${COACH_URL}/ingest/${userId}`, { headers })
			const data = await backendResponse.json()
			return res.status(backendResponse.status).json(data)
		} catch (error) {
			console.error('Error fetching documents:', error.message)
			return res.status(500).json({ message: 'Internal Server Error', statusCode: 500 })
		}
	}

	return res.status(405).json({ message: 'Method not allowed', statusCode: 405 })
}

export default withAuth(handler)
