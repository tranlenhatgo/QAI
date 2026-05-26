import withAuth from '@/lib/withAuth'

async function handler(req, res) {
   if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Only GET requests allowed', statusCode: 405 });
   }

   if (!process.env.REST_API_URL) {
      return res.status(500).json({ message: 'REST_API_URL is not configured', statusCode: 500 });
   }

   try {
      const apiRoot = process.env.REST_API_URL.replace(/\/+$/, '');
      const response = await fetch(`${apiRoot}/quiz`, {
         method: 'GET',
         headers: {
            'Content-Type': 'application/json',
         },
      });

      const data = await response.json().catch(() => []);

      if (!response.ok) {
         return res.status(response.status).json({
            message: data.message || 'Failed to fetch quizzes',
            statusCode: response.status,
         });
      }

      return res.status(200).json(data);
   } catch (err) {
      console.error('Error in list-all quizzes API:', err.message);
      return res.status(500).json({
         message: 'Unable to reach quiz API',
         statusCode: 500,
      });
   }
}

export default withAuth(handler)
