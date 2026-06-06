import withAuth from '@/lib/withAuth'

const COACH_URL = process.env.STUDY_COACH_API_URL || 'http://localhost:8000'

async function handler(req, res) {
	const { userId, documentId } = req.query

	if (!userId || !documentId) {
		return res.status(400).json({ message: 'userId and documentId are required', statusCode: 400 })
	}

	if (req.method !== 'DELETE') {
		return res.status(405).json({ message: 'Only DELETE requests allowed', statusCode: 405 })
	}

	const headers = {}
	const apiKey = process.env.STUDY_COACH_API_KEY || process.env.COACH_API_KEY
	if (apiKey) {
		headers['X-API-Key'] = apiKey
	}

	try {
		const backendResponse = await fetch(`${COACH_URL}/ingest/${userId}/${documentId}`, {
			method: 'DELETE',
			headers,
		})
		const data = await backendResponse.json()
		return res.status(backendResponse.status).json(data)
	} catch (error) {
		console.error('Error deleting document:', error.message)
		return res.status(500).json({ message: 'Internal Server Error', statusCode: 500 })
	}
}

export default withAuth(handler)
