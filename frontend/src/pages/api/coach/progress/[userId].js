export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Only GET requests allowed', statusCode: 405 })
  }

  const { userId } = req.query
  if (!userId) {
    return res.status(400).json({ message: 'userId is required', statusCode: 400 })
  }

  const coachUrl = process.env.STUDY_COACH_API_URL || process.env.COACH_API_URL || 'http://localhost:8000'

  try {
    const response = await fetch(`${coachUrl}/progress/${userId}`)
    const data = await response.json()
    res.status(response.status).json(data)
  } catch (error) {
    console.error('Progress fetch failed:', error.message)
    res.status(502).json({ message: 'AI Coach unavailable', statusCode: 502 })
  }
}
