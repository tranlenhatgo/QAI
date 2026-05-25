export default async function getQuizByUserId(userId) {
   if (!userId) {
      throw new Error('userId is required to fetch quizzes');
   }

   const response = await fetch('/api/quiz/get-quizzes', {
      method: 'POST',
      headers: {
         'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: userId }),
   });

   const data = await response.json().catch(() => ({}));

   if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch quizzes');
   }

   return data;
}
