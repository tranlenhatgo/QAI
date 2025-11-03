export default async function saveAttempt(takeId, questions) {
   if (!questions || questions.length === 0) {
      throw new Error('Questions are required to save the attempt');
   }

   const takeQuestionSaveRequestDtos = questions.map(q => ({
      question_id: q.id, 
      answer: q.answer, 
      check_answer: q.userAnswer
   }));

   const payload = {
      takeId, // Include the takeId
      takeQuestionSaveRequestDtos, // Include the transformed questions
   };

   try {
      const response = await fetch('/api/take/save-attempt', {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
         },
         body: JSON.stringify(payload), // Send the payload
      });

      if (!response.ok) {
         throw new Error(`Failed to save attempt: ${response.statusText}`);
      }

      const data = await response.json();
      return data; // Return the response data if needed
   } catch (error) {
      console.error('Error saving attempt:', error);
      throw error; // Re-throw the error for the caller to handle
   }
}