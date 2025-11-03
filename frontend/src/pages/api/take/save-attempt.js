export default async function handler(req, res) {
   if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 });
   }

   try {
      const { takeId, takeQuestionSaveRequestDtos } = req.body;

      if (!takeId || !Array.isArray(takeQuestionSaveRequestDtos) || takeQuestionSaveRequestDtos.length === 0) {
         return res.status(400).json({ message: 'Invalid request payload', statusCode: 400 });
      }

      const response = await fetch(`${process.env.REST_API_URL}/take-quiz/end`, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
         },
         body: JSON.stringify({
            takeId,
            takeQuestionSaveRequestDtos,
         }),
      });

      const data = await response.json();

      if (!response.ok) {
         return res.status(response.status).json({
            message: data.message || 'Failed to save attempt',
            statusCode: response.status,
         });
      }

      return res.status(200).json(data);
   } catch (err) {
      console.error('Error in save-attempt API:', err);
      return res.status(500).json({
         message: 'Internal Server Error',
         statusCode: 500,
      });
   }
}