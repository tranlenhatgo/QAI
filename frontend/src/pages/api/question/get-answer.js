import CryptoJS from 'crypto-js';

export default async function handler(req, res) {
   if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 });
   }

   const { correctAnswer } = req.body;

   if (!correctAnswer) {
      return res.status(400).json({ message: 'correctAnswer is required', statusCode: 400 });
   }

   try {
      const encryptionKey = process.env.ANSWER_ENCRYPTION_KEY;
      const bytes = CryptoJS.AES.decrypt(correctAnswer, encryptionKey);
      const decryptedCorrectAnswer = bytes.toString(CryptoJS.enc.Utf8);

      return res.status(200).json({ decryptedCorrectAnswer });
   } catch (error) {
      console.error('Error comparing answers:', error);
      return res.status(500).json({ message: 'Internal Server Error', statusCode: 500 });
   }
}