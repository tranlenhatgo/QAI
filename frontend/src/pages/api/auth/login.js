// import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    // if (req.method !== 'POST') {
    //     return res.status(405).json({ message: 'Only POST requests allowed', statusCode: 405 });
    // }

    // const { username, password } = req.body;

    // if (!username || !password) {
    //     return res.status(400).json({ message: 'Username and password are required', statusCode: 400 });
    // }

    // try {
    //     const mockUser = {
    //         id: 1,
    //         username: 'testuser',
    //         password: 'password123', 
    //         name: 'Test User',
    //     };

    //     if (username !== mockUser.username || password !== mockUser.password) {
    //         return res.status(401).json({ message: 'Invalid username or password', statusCode: 401 });
    //     }

    //     // Generate a JWT token (replace 'your-secret-key' with a secure key from your environment variables)
    //     const token = jwt.sign({ id: mockUser.id, username: mockUser.username }, process.env.JWT_SECRET, {
    //         expiresIn: '1h', // Token expires in 1 hour
    //     });

    //     // Return the token and user information
    //     return res.status(200).json({
    //         token,
    //         user: {
    //             id: mockUser.id,
    //             username: mockUser.username,
    //             name: mockUser.name,
    //         },
    //     });
    // } catch (error) {
    //     console.error('Error in login API:', error);
    //     return res.status(500).json({
    //         message: 'Internal Server Error',
    //         statusCode: 500,
    //     });
    // }
}