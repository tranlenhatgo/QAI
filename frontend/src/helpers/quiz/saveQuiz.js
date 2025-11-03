export default function saveQuiz(name, description, startTime, endTime, categories, uid) {
   
   const payload = {
      user_id: uid,
      title: name,
      description: description,
      categories: categories.map(category => category.toUpperCase().replace(/\s+/g, '_')),
      start_time: startTime + ":00Z",
      end_time: endTime + ":00Z",
   };
   console.log('Payload:', payload); // Log the payload to be sent to the API
   const save = fetch('/api/quiz/save-quiz', {
      method: 'POST',
      headers: {
         'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
   }).then(res => res.json())
      .then(data => {
         if (data.statusCode >= 400) {
            const error = new Error(data.message)
            error.statusCode = data.status
            throw error
         } else return data
      })
      .catch(err => {
         console.log(err)
         throw err
      })

   return save
}