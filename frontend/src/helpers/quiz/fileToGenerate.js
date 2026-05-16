export default async function fileToGenerate(file, quizId) {
    try {
        const formData = new FormData();
        formData.append('quiz_id', quizId);
        formData.append('data', file);

        const response = await fetch('/api/quiz/upload', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }

        const responseData = await response.json();
        return responseData;
    } catch (error) {
        console.error('Error in fileToGenerate:', error.message);
        throw error;
    }
}