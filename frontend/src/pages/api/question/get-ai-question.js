import withAuth from '@/lib/withAuth'

async function handler(req, res) {
   if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 });
   }

   const { id } = req.body;

   if (!id) {
      return res.status(400).json({ message: 'ID is required', statusCode: 400 });
   }

   try {
      const response = await fetch(`${process.env.REST_API_URL}/n8n/get-question`, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
         },
         body: JSON.stringify({ quiz_id: id }),
      });

      if (!response.ok) {
         const errorData = await response.json();
         return res.status(response.status).json({
            message: errorData.message || 'Failed to fetch question',
            statusCode: response.status,
         });
      }

      const data = await response.json();
      return res.status(200).json(data);
   } catch (error) {
      console.error('Error fetching question:', error.message);
      return res.status(500).json({
         message: 'Internal Server Error',
         statusCode: 500,
      });
   }
}

export default withAuth(handler)