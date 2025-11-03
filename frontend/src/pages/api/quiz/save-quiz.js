export default async function handler(req, res) {
   if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 });
   }

   try {
      const response = await fetch(`${process.env.REST_API_URL}/quiz`, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
         },
         body: JSON.stringify(req.body),
      });
      const data = await response.json();

      if (!response.ok) {
         return res.status(response.status).json({
            message: data.message || 'Failed to save quỉzoom',
            statusCode: response.status,
         });
      }

      return res.status(200).json(data);
   } 
   catch (err) {
      console.error('Error in save-quiz API:', err); // Log the full error object
      return res.status(500).json({
         message: 'Internal Server Error',
         statusCode: 500,
      });
   }
}