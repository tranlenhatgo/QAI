import withAuth from '@/lib/withAuth'

const COACH_URL = process.env.STUDY_COACH_API_URL || 'http://localhost:8000'

async function handler(req, res) {
   if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 });
   }

   const { id } = req.body;

   if (!id) {
      return res.status(400).json({ message: 'ID is required', statusCode: 400 });
   }

   try {
      const headers = { 'Content-Type': 'application/json' }
      if (process.env.STUDY_COACH_API_KEY || process.env.COACH_API_KEY) {
         headers['X-API-Key'] = process.env.STUDY_COACH_API_KEY || process.env.COACH_API_KEY
      }

      const response = await fetch(`${COACH_URL}/generate/get-question?quiz_id=${encodeURIComponent(id)}`, {
         method: 'POST',
         headers,
         body: JSON.stringify({}),
      });

      if (!response.ok) {
         const errorData = await response.json();
         return res.status(response.status).json({
            message: errorData.detail || errorData.message || 'Failed to generate question',
            statusCode: response.status,
         });
      }

      const data = await response.json();
      return res.status(200).json(data);
   } catch (error) {
      console.error('Error generating question:', error.message);
      return res.status(500).json({
         message: 'Internal Server Error',
         statusCode: 500,
      });
   }
}

export default withAuth(handler)