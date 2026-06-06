import withAuth from '@/lib/withAuth'

async function handler(req, res) {
   if (!['POST', 'DELETE'].includes(req.method)) {
      return res.status(405).json({ message: 'Only POST or DELETE requests allowed', statusCode: 405 });
   }

   if (!process.env.REST_API_URL) {
      return res.status(500).json({ message: 'REST_API_URL is not configured', statusCode: 500 });
   }

   const { quizId } = req.body;

   if (!quizId) {
      return res.status(400).json({ message: 'quizId is required', statusCode: 400 });
   }

   try {
      const apiRoot = process.env.REST_API_URL.replace(/\/+$/, '');
      let response = await fetch(`${apiRoot}/quiz/delete/${encodeURIComponent(quizId)}`, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
         },
      });

      if (response.status === 404 || response.status === 405) {
         response = await fetch(`${apiRoot}/quiz/${encodeURIComponent(quizId)}`, {
            method: 'DELETE',
            headers: {
               'Content-Type': 'application/json',
            },
         });
      }

      if (!response.ok) {
         const data = await response.json().catch(() => ({}));
         return res.status(response.status).json({
            message: data.message || 'Failed to delete quiz',
            statusCode: response.status,
         });
      }

      return res.status(200).json({ success: true });
   } catch (error) {
      return res.status(500).json({ message: error.message || 'Internal server error', statusCode: 500 });
   }
}

export default withAuth(handler)
