export default async function getQuizByUserId(userId) {
   if (!userId) {
      throw new Error('userId is required to fetch quizzes');
   }
   try {
      const response = await fetch('/api/quiz/get-quizzes', {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
         },
         body: JSON.stringify({ id: userId }), 
      });

      if (!response.ok) {
         const errorData = await response.json();
         throw new Error(errorData.message || 'Failed to fetch quizzes');
      }

      const data = await response.json();
      console.log('Fetched quizzes:', data);
      return data; 
   } catch (error) {
      console.error('Error fetching quizzes by userId:', error);
      throw error; 
   }
}
