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
      // Forward the content-type (includes multipart boundary)
      'content-type': req.headers['content-type'],
    }
    if (process.env.STUDY_COACH_API_KEY || process.env.COACH_API_KEY) {
      headers['X-API-Key'] = process.env.STUDY_COACH_API_KEY || process.env.COACH_API_KEY
    }

    // Forward multipart stream to AI Study Coach
    const backendResponse = await fetch(`${COACH_URL}/generate/from-file`, {
      method: 'POST',
      headers,
      body: req,
      duplex: 'half',
    })

    const data = await backendResponse.json()

    if (!backendResponse.ok) {
      return res.status(backendResponse.status).json({
        message: data.detail || data.message || 'Failed to generate questions from file',
        statusCode: backendResponse.status,
      })
    }

    return res.status(200).json(data)
  } catch (error) {
    console.error('Error in upload/generate:', error.message)
    return res.status(500).json({
      message: 'Internal Server Error',
      statusCode: 500,
    })
  }
}

export default withAuth(handler)
