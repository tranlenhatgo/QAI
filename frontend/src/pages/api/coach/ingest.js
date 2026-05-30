import withAuth from '@/lib/withAuth'

const COACH_URL = process.env.STUDY_COACH_API_URL || 'http://localhost:8000'

// Disable Next.js body parser so we can forward the raw multipart stream
export const config = {
	api: {
		bodyParser: false,
	},
}

async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 })
	}

	try {
		const headers = {
			'content-type': req.headers['content-type'],
		}
		const apiKey = process.env.STUDY_COACH_API_KEY || process.env.COACH_API_KEY
		if (apiKey) {
			headers['X-API-Key'] = apiKey
		}

		const backendResponse = await fetch(`${COACH_URL}/ingest`, {
			method: 'POST',
			headers,
			body: req,
			duplex: 'half',
		})

		const data = await backendResponse.json()

		if (!backendResponse.ok) {
			return res.status(backendResponse.status).json({
				message: data.detail || data.message || 'Failed to ingest document',
				statusCode: backendResponse.status,
			})
		}

		return res.status(200).json(data)
	} catch (error) {
		console.error('Error in ingest:', error.message)
		return res.status(500).json({
			message: 'Internal Server Error',
			statusCode: 500,
		})
	}
}

export default withAuth(handler)
