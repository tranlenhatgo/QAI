export default async function getQuestionsByQuizId(id) {
   if (!id) {
      throw new Error('ID is required to fetch questions');
   }
   try {
      const response = await fetch('/api/question/quiz-questions', {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
         },
         body: JSON.stringify({ id }),
      });

      const data = await response.json();
      return data;
   } catch (error) {
      console.error('Error fetching questions by ID:', error);
      throw error;
   }
}
