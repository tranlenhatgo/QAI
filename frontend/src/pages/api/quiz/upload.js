import withAuth from '@/lib/withAuth'

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

  const restApiUrl = process.env.REST_API_URL
  if (!restApiUrl) {
    return res.status(500).json({ message: 'REST_API_URL not configured', statusCode: 500 })
  }

  try {
    // Stream the raw request (including multipart headers) directly to the backend
    const backendResponse = await fetch(`${restApiUrl}/n8n/upload`, {
      method: 'POST',
      headers: {
        // Forward the content-type (includes multipart boundary)
        'content-type': req.headers['content-type'],
      },
      body: req,
      duplex: 'half',
    })

    const data = await backendResponse.json()

    if (!backendResponse.ok) {
      return res.status(backendResponse.status).json({
        message: data.message || 'Failed to upload file',
        statusCode: backendResponse.status,
      })
    }

    return res.status(200).json(data)
  } catch (error) {
    console.error('Error in upload proxy:', error.message)
    return res.status(500).json({
      message: 'Internal Server Error',
      statusCode: 500,
    })
  }
}

export default withAuth(handler)
