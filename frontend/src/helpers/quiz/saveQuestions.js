export default async function saveQuestions(questions, quizId) {
   const formattedQuestions = questions.map((q) => ({
      quiz_id: quizId,
      content: q.question,
      answers: q.answers, 
      correct_answer: q.correctAnswer,
   }));

   console.log('Formatted Questions:', formattedQuestions); 

   try {
      const response = await fetch('/api/quiz/save-questions', {
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