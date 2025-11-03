export default async function checkAnswer(selectedAnswer, correctAnswer) {
   try {
      const response = await fetch('/api/question/check-answer', {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
         },
         body: JSON.stringify({ selectedAnswer, correctAnswer }),
      });

      if (!response.ok) {
         const errorData = await response.json();
         console.error('Error from /api/check-answer:', errorData.message);
         return false; // Return false if the API request fails
      }

      const { isCorrect } = await response.json();
      return isCorrect; // Return true or false based on the API response
   } catch (error) {
      console.error('Error fetching /api/check-answer:', error);
      return false; // Return false if an error occurs
   }
}