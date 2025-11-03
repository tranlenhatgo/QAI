export default async function generateQuestion(quizId) {
   if (!quizId) {
      throw new Error('quizId is required to fetch questions');
   }
   try {
      const response = await fetch('/api/question/get-ai-question', {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
         },
         body: JSON.stringify({ id: quizId }), 
      });

      if (!response.ok) {
         const errorData = await response.json();
         throw new Error(errorData.message || 'Failed to fetch questions');
      }

      const data = await response.json();
      return data; 
   } catch (error) {
      console.error('Error fetching questions by quizId:', error);
      throw error; 
   }
}
