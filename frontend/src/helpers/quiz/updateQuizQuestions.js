export default async function updateQuestions(questions, quizId) {
   const formattedQuestions = questions.map((q) => ({
      questionId: q.id ?? null,
      quizId: quizId,
      content: q.question,
      answers: q.answers, 
      correctAnswer: q.correctAnswer,
   }));

   console.log('Formatted Questions:', formattedQuestions); 

   try {
      const response = await fetch('/api/quiz/update-questions', {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
         },
         body: JSON.stringify({ questions: formattedQuestions }),
      });
      if (!response.ok) {
         throw new Error('Failed to save questions');
      }
      return await response.json();
   } catch (error) {
      console.error('Error saving questions:', error);
      throw error;
   }
}