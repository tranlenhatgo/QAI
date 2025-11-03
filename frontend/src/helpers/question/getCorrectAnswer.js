export default async function getCorrectAnswer(correctAnswer) {
   try {
      const response = await fetch('/api/question/get-answer', {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
         },
         body: JSON.stringify({ correctAnswer }),
      });

      if (!response.ok) {
         const errorData = await response.json();
         console.error('Error from /api/get-answer:', errorData.message);
         return false; // Return false if the API request fails
      }

      const { decryptedCorrectAnswer } = await response.json();
      return decryptedCorrectAnswer; // Return true or false based on the API response
   } catch (error) {
      console.error('Error fetching /api/get-answer:', error);
      return false; // Return false if an error occurs
   }
}