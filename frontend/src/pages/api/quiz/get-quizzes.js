export default async function handler(req, res) {
   if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 });
   }

   const { id } = req.body;

   if (!id) {
      return res.status(400).json({ message: 'id is required', statusCode: 400 });
   }

   try {
      const response = await fetch(`${process.env.REST_API_URL}/user/quiz-profile?userId=${id}`, {
         method: 'GET',
         headers: {
            'Content-Type': 'application/json',
         },
      });

      const data = await response.json();

      if (!response.ok) {
         return res.status(response.status).json({
            message: data.message || 'Failed to load quizzes',
            statusCode: response.status,
         });
      }

      const { quizzesCreated, quizzesTaken } = data;
      const result = {
         quizzes: quizzesCreated,
         history: quizzesTaken,
      };
      return res.status(200).json(result);
   } catch (err) {
      console.error('Error in get-quizzes API:', err);
      return res.status(500).json({
         message: 'Internal Server Error',
         statusCode: 500,
      });
   }
}