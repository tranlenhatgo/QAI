import withAuth from '@/lib/withAuth'

const DEFAULT_TIMEOUT_MS = 30000
const DEFAULT_ALLOWED_HISTORY_ROLES = new Set(['user', 'assistant'])

function normalizeHistory(history) {
  if (!Array.isArray(history)) return []

  return history
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      role: typeof item.role === 'string' ? item.role : '',
      content: typeof item.content === 'string' ? item.content : '',
    }))
    .filter(item => DEFAULT_ALLOWED_HISTORY_ROLES.has(item.role) && item.content.trim().length > 0)
    .slice(-20)
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 })
  }

  const studyCoachApiUrl = process.env.STUDY_COACH_API_URL
  const studyCoachApiKey = process.env.STUDY_COACH_API_KEY

  if (!studyCoachApiUrl || !studyCoachApiKey) {
    return res.status(500).json({ message: 'Study coach API is not configured', statusCode: 500 })
  }

  // req.userId is set by the withAuth middleware
  const userId = req.userId

  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''
  const chatMode = req.body?.chatMode === 'agentic' ? 'agentic' : 'simple'

  if (!message) {
    return res.status(400).json({ message: 'message is required', statusCode: 400 })
  }

  const history = normalizeHistory(req.body?.history)
  const endpoint = chatMode === 'agentic' ? '/chat/agentic' : '/chat'
  const targetUrl = `${String(studyCoachApiUrl).replace(/\/+$/, '')}${endpoint}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': studyCoachApiKey,
      },
      body: JSON.stringify({
        user_id: userId,
        message,
        history,
      }),
      signal: controller.signal,
    })

    const data = await upstreamResponse.json().catch(() => ({}))

    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json({
        message: data?.error || data?.message || 'Study coach request failed',
        statusCode: upstreamResponse.status,
      })
    }

    return res.status(200).json(data)
  } catch (error) {
    const isTimeout = error?.name === 'AbortError'
    return res.status(isTimeout ? 504 : 500).json({
      message: isTimeout ? 'Coach API timeout' : 'Internal Server Error',
      statusCode: isTimeout ? 504 : 500,
    })
  } finally {
    clearTimeout(timeout)
  }
}

export default withAuth(handler)
