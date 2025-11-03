import { serialize } from "cookie";

export default async function handler(req, res) {
  const { token } = req.body;

  if (!token) return res.status(400).json({ error: "Token required" });

  res.setHeader("Set-Cookie", serialize("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24,
    path: "/",
    sameSite: "lax",
  }));

  res.status(200).json({ success: true });
}