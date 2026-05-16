import { serialize } from "cookie";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 })
  }

  const { token } = req.body;

  if (!token) return res.status(400).json({ error: "Token required" });

  const firebaseWebApiKey = process.env.FIREBASE_WEB_API_KEY
  if (!firebaseWebApiKey) {
    return res.status(500).json({ message: 'Missing FIREBASE_WEB_API_KEY', statusCode: 500 })
  }

  const verifyResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseWebApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token }),
  })

  if (!verifyResponse.ok) {
    return res.status(401).json({ message: 'Invalid token', statusCode: 401 })
  }

  res.setHeader("Set-Cookie", serialize("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24,
    path: "/",
    sameSite: "lax",
  }));

  res.status(200).json({ success: true });
}