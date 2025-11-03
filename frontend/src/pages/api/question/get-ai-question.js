export default async function handler(req, res) {
   if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 });
   }

   const { id } = req.body;

   if (!id) {
      return res.status(400).json({ message: 'ID and Name are required', statusCode: 400 });
   }

   try {
      // Fetch questions from the external REST API
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

      return res.status(200).json(data); // Return the data with encrypted correctAnswer
   } catch (error) {
      console.error('Error fetching question:', error);
      return res.status(500).json({
         message: 'Internal Server Error',
         statusCode: 500,
      });
   }
}