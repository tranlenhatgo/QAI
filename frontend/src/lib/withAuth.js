/**
 * Authentication middleware for Next.js API routes.
 *
 * Verifies the Firebase ID token from the `token` cookie or the
 * `Authorization: Bearer <token>` header.  On success the verified
 * Firebase UID is attached to `req.userId` so downstream handlers can
 * use it for authorisation checks.
 *
 * Usage:
 *   import withAuth from '@/lib/withAuth'
 *   export default withAuth(async function handler(req, res) { ... })
 */

async function verifyFirebaseIdToken(idToken) {
  const firebaseWebApiKey = process.env.FIREBASE_WEB_API_KEY
  if (!firebaseWebApiKey) {
    throw new Error('Missing FIREBASE_WEB_API_KEY')
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseWebApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  )

  if (!response.ok) return null

  const data = await response.json().catch(() => null)
  const localId = data?.users?.[0]?.localId
  return typeof localId === 'string' && localId.length > 0 ? localId : null
}

function readAuthToken(req) {
  const cookieToken = req.cookies?.token
  if (cookieToken) return cookieToken

  const authHeader = req.headers?.authorization || req.headers?.Authorization
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim()
  }

  return null
}

export default function withAuth(handler) {
  return async function authMiddleware(req, res) {
    const token = readAuthToken(req)
    if (!token) {
      return res.status(401).json({ message: 'Not authenticated', statusCode: 401 })
    }

    try {
      const userId = await verifyFirebaseIdToken(token)
      if (!userId) {
        return res.status(401).json({ message: 'Invalid auth token', statusCode: 401 })
      }
      req.userId = userId
    } catch (error) {
      console.error('[auth] Firebase token verification failed', error)
      return res.status(500).json({ message: 'Auth verification failed. Check FIREBASE_WEB_API_KEY and server network access to Firebase.', statusCode: 500 })
    }

    return handler(req, res)
  }
}
