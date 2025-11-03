export default async function takeQuiz(id, name, uid) {
   if (!id) {
      throw new Error('ID is required to fetch questions');
   }
   if (!name) {
      throw new Error('Name is required to fetch questions');
   }
   try {
      const response = await fetch('/api/take/take-quiz', {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
         },
         body: JSON.stringify({ id, name, uid }),
      });

      if (!response.ok) {
         const errorData = await response.json();
         throw new Error(errorData.message || 'Failed to fetch questions');
      }

      const data = await response.json();

      const { takeId, questions } = data;

      return { takeId, questions };
   } catch (error) {
      console.error('Error fetching questions by ID:', error);
      throw error;
   }
}