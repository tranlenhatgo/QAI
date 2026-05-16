import CryptoJS from 'crypto-js';

export default async function handler(req, res) {
   if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 });
   }

   const { id: quizId, name: playerName, uid: playerId } = req.body;

   if (!quizId || !playerName) {
      return res.status(400).json({ message: 'quizId and playerName are required', statusCode: 400 });
   }

   try {
      const response = await fetch(`${process.env.REST_API_URL}/take-quiz/start`, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
         },
         body: JSON.stringify({ quizId, playerName, playerId }),
      });

      if (!response.ok) {
         const errorData = await response.json();
         return res.status(response.status).json({
            message: errorData.message || 'Failed to start the quiz',
            statusCode: response.status,
         });
      }

      const data = await response.json();
      const { takeId, questionResponseDtos } = data;

      const encryptionKey = process.env.ANSWER_ENCRYPTION_KEY;
      const encryptedQuestions = questionResponseDtos.map(question => ({
         id: question.id,
         quizId: question.quizId,
         question: question.question,
         answers: question.answers,
         correctAnswer: CryptoJS.AES.encrypt(question.correctAnswer, encryptionKey).toString(),
         userAnswer: '',
         answer: '',
         status: question.status,
      }));

      return res.status(200).json({ takeId, questions: encryptedQuestions });
   } catch (error) {
      console.error('Error starting the quiz:', error.message);
      return res.status(500).json({
         message: 'Internal Server Error',
         statusCode: 500,
      });
   }
}