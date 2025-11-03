import CryptoJS from 'crypto-js';

export default async function handler(req, res) {
   if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 });
   }

   const { selectedAnswer, correctAnswer } = req.body;

   if (!selectedAnswer || !correctAnswer) {
      return res.status(400).json({ message: 'Both selectedAnswer and correctAnswer are required', statusCode: 400 });
   }

   try {
      const encryptionKey = process.env.ANSWER_ENCRYPTION_KEY; 
      const bytes = CryptoJS.AES.decrypt(correctAnswer, encryptionKey);
      const decryptedCorrectAnswer = bytes.toString(CryptoJS.enc.Utf8);

      // Compare the decrypted correct answer with the selected answer
      const isCorrect = decryptedCorrectAnswer === selectedAnswer;

      return res.status(200).json({ isCorrect });
   } catch (error) {
      console.error('Error comparing answers:', error);
      return res.status(500).json({ message: 'Internal Server Error', statusCode: 500 });
   }
}