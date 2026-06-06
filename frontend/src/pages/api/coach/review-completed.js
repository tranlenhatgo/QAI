export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 })
  }

  const { user_id: userId, category, score } = req.body || {}
  if (!userId || !category || !score) {
    return res.status(400).json({ message: 'user_id, category, and score are required', statusCode: 400 })
  }

  const coachUrl = process.env.STUDY_COACH_API_URL || process.env.COACH_API_URL || 'http://localhost:8000'
  const apiKey = process.env.STUDY_COACH_API_KEY || process.env.COACH_API_KEY || ''

  try {
    const response = await fetch(`${coachUrl}/webhook/quiz-completed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      },
      body: JSON.stringify({
        user_id: userId,
        quiz_id: 'review-' + Date.now(),
        score,
        category,
        completed_at: new Date().toISOString(),
      }),
    })
    const data = await response.json()
    res.status(response.status).json(data)
  } catch (error) {
    console.error('Review completion notification failed:', error.message)
    res.status(502).json({ message: 'AI Coach unavailable', statusCode: 502 })
  }
}
