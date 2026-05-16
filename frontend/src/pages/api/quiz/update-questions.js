import withAuth from '@/lib/withAuth'

async function handler(req, res) {
   if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 });
   }

   try {
      const response = await fetch(`${process.env.REST_API_URL}/question/update`, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
         },
         body: JSON.stringify(req.body.questions),
      });

      const data = await response.json();

      if (!response.ok) {
         return res.status(response.status).json({
            message: data.message || 'Failed to save questions',
            statusCode: response.status,
         });
      }

      return res.status(200).json(data);
   } catch (err) {
      console.error('Error in update-questions API:', err.message);
      return res.status(500).json({
         message: 'Internal Server Error',
         statusCode: 500,
      });
   }
}

export default withAuth(handler)