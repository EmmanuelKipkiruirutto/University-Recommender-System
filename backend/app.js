const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { OpenAI } = require('openai');
const { initializeDatabase, getDatabase } = require('./db');
const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET 
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyDesqvm8IXp5bVHR3b-5Ey05wghHPdni9Q';
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || 'https://programmablesearchengine.google.com/';

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Nodemailer configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'infounimatch1@gmail.com',
        pass: process.env.EMAIL_PASS || 'blsb mqci yqcv vxiu'
    }
});

// Store reset tokens (in production, use a database)
const resetTokens = new Map();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize database
initializeDatabase();

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        const db = getDatabase();

        // Validate input
        if (!fullName || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if user already exists
        const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        const result = await db.run(
            'INSERT INTO users (full_name, email, password) VALUES (?, ?, ?)',
            [fullName, email, hashedPassword]
        );

        // Generate token
        const token = jwt.sign({ userId: result.lastID, email }, JWT_SECRET);

        res.status(201).json({ token });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const db = getDatabase();

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign({ userId: user.id, email }, JWT_SECRET);

        res.json({ token });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/verify-email', async (req, res) => {
    try {
        const { email } = req.body;
        const db = getDatabase();

        // Check if user exists
        const user = await db.get('SELECT id FROM users WHERE email = ?', [email]);
        
        res.json({ exists: !!user });
    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        const db = getDatabase();

        // Find user by email
        const user = await db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);

        res.json({ message: 'Password reset successful' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const db = getDatabase();
        
        // Check if email exists
        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(404).json({ error: 'Email not found' });
        }

        // Generate 6-digit reset token
        const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
        resetTokens.set(email, {
            token: resetToken,
            timestamp: Date.now()
        });

        // Send email with reset token
        const mailOptions = {
            from: process.env.EMAIL_USER || 'infounimatch1@gmail.com',
            to: email,
            subject: 'Password Reset Token',
            text: `Your password reset token is: ${resetToken}\nThis token will expire in 1 hour.`
        };

        await transporter.sendMail(mailOptions);
        res.json({ message: 'Reset token sent to email' });
    } catch (error) {
        console.error('Error in forgot-password:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/auth/verify-reset-token', async (req, res) => {
    try {
        const { email, token } = req.body;
        
        const storedData = resetTokens.get(email);
        if (!storedData) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        if (Date.now() - storedData.timestamp > 3600000) { // 1 hour expiration
            resetTokens.delete(email);
            return res.status(400).json({ error: 'Token expired' });
        }

        if (storedData.token !== token) {
            return res.status(400).json({ error: 'Invalid token' });
        }

        res.json({ valid: true });
    } catch (error) {
        console.error('Error in verify-reset-token:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// University Search Route
app.post('/api/universities/search', authenticateToken, async (req, res) => {
    try {
        const { description } = req.body;

        // First, extract user requirements
        const requirementsCompletion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "Extract specific requirements from the user's description. Return as a simple array of requirements."
                },
                {
                    role: "user",
                    content: `Extract all specific requirements from this description: ${description}
                    Return in this JSON format:
                    {
                        "requirements": ["requirement1", "requirement2", ...]
                    }`
                }
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        const userRequirements = JSON.parse(requirementsCompletion.choices[0].message.content);
        const totalRequirements = userRequirements.requirements.length;

        // Get university matches with requirement matching
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are a specialized Kenyan university matching expert. For each university, compare against these specific requirements: ${JSON.stringify(userRequirements.requirements)}. Calculate match percentage as: (matched requirements / ${totalRequirements}) * 100`
                },
                {
                    role: "user",
                    content: `Based on these requirements, provide 10 Kenyan university matches in this exact JSON format:
                    {
                        "universities": [
                            {
                                "id": "string",
                                "name": "string",
                                "location": "string",
                                "programs": ["string"],
                                "tuition_range": "string",
                                "match_score": number,
                                "description": "string",
                                "matched_requirements": ["requirement1", "requirement2"]
                            }
                        ]
                    }`
                }
            ],
            temperature: 0.7,
            max_tokens: 2000,
            response_format: { type: "json_object" }
        });

        let parsedResponse;
        try {
            const responseText = completion.choices[0].message.content;
            parsedResponse = JSON.parse(responseText);

            if (!parsedResponse.universities || !Array.isArray(parsedResponse.universities)) {
                throw new Error('Invalid response structure');
            }

            // Calculate final match scores based on matched requirements ratio
            const formattedResults = parsedResponse.universities.map(university => ({
                id: university.id || String(Math.random()),
                name: university.name || 'Unknown University',
                location: university.location || 'Location not specified',
                programs: Array.isArray(university.programs) ? university.programs : [],
                tuition_range: university.tuition_range || 'Not specified',
                match_score: Math.round((university.matched_requirements.length / totalRequirements) * 100),
                description: university.description || '',
                matched_requirements: university.matched_requirements || []
            }));

            res.json(formattedResults);
        } catch (parseError) {
            console.error('Response parsing error:', parseError);
            console.error('Raw response:', completion.choices[0].message.content);
            res.status(500).json({ 
                error: 'Error processing search results',
                details: parseError.message 
            });
        }
    } catch (error) {
        console.error('Error in university search:', error);
        res.status(500).json({ error: 'Failed to process university search' });
    }
});

// Favorites Routes
app.post('/api/favorites/add', authenticateToken, async (req, res) => {
    try {
        const { universityName } = req.body;
        const userId = req.user.userId;
        const db = getDatabase();

        // First check if university exists
        let university = await db.get('SELECT id FROM universities WHERE name = ?', [universityName]);
        
        if (!university) {
            // Fetch university details from OpenAI
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful assistant that provides information about universities in Kenya."
                    },
                    {
                        role: "user",
                        content: `Please provide the location of ${universityName} in Kenya. Return just the city/town name.`
                    }
                ],
                temperature: 0.7,
                max_tokens: 100
            });

            const location = completion.choices[0].message.content.trim() || 'Kenya';

            // Create university with fetched location
            const result = await db.run(
                'INSERT INTO universities (name, location) VALUES (?, ?)',
                [universityName, location]
            );
            university = { id: result.lastID };
        }

        // Add to favorites
        await db.run(
            'INSERT OR IGNORE INTO favorites (user_id, university_id) VALUES (?, ?)',
            [userId, university.id]
        );

        res.status(200).json({ message: 'University added to favorites' });
    } catch (error) {
        console.error('Error adding to favorites:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/favorites/remove', authenticateToken, async (req, res) => {
    try {
        const { universityName } = req.body;
        const userId = req.user.userId;
        const db = getDatabase();

        // Get university ID from name
        const university = await db.get('SELECT id FROM universities WHERE name = ?', [universityName]);
        
        if (!university) {
            return res.status(404).json({ error: 'University not found' });
        }

        // Remove from favorites
        await db.run(
            'DELETE FROM favorites WHERE user_id = ? AND university_id = ?',
            [userId, university.id]
        );

        res.status(200).json({ message: 'University removed from favorites' });
    } catch (error) {
        console.error('Error removing from favorites:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/favorites', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const db = getDatabase();

        const favorites = await db.all(`
            SELECT u.* 
            FROM universities u
            JOIN favorites f ON u.id = f.university_id
            WHERE f.user_id = ?
        `, [userId]);

        res.status(200).json({ data: favorites });
    } catch (error) {
        console.error('Error getting favorites:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// University Details Route
app.get('/api/universities/:id', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const university = await db.get('SELECT * FROM universities WHERE id = ?', [req.params.id]);
        
        if (!university) {
            return res.status(404).json({ error: 'University not found' });
        }

        res.json(university);
    } catch (error) {
        console.error('Error fetching university details:', error);
        res.status(500).json({ error: 'Failed to fetch university details' });
    }
});

// University Comparison Route
app.post('/api/universities/compare', authenticateToken, async (req, res) => {
    try {
        const { universityIds } = req.body;
        const db = getDatabase();

        const universities = await Promise.all(
            universityIds.map(id => 
                db.get('SELECT * FROM universities WHERE id = ?', [id])
            )
        );

        res.json({ universities });
    } catch (error) {
        console.error('Error comparing universities:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// University Details Route using OpenAI
app.post('/api/universities/details', authenticateToken, async (req, res) => {
    try {
        const { universityName } = req.body;

        const prompt = `
            Give me detailed information about ${universityName} in Kenya. Include:
            1. Location
            2. Year established
            3. Student population
            4. Total number of programs offered
            5. Average tuition fees
            6. A brief description
            7. List of popular programs (at least 5)
            8. Available facilities and amenities
            9. Contact information (email, phone, website)
            10. Any notable rankings or achievements

            Format the response as a JSON object with the following structure:
            {
                "name": "University Name",
                "location": "City, County",
                "establishedYear": "YYYY",
                "studentPopulation": "Number",
                "totalPrograms": "Number",
                "averageTuition": "Range in KES",
                "description": "Brief description",
                "programs": ["Program 1", "Program 2", ...],
                "facilities": ["Facility 1", "Facility 2", ...],
                "email": "contact@university.ac.ke",
                "phone": "Phone number",
                "website": "https://university.ac.ke",
                "ranking": "National/Regional ranking if available"
            }
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that provides detailed information about universities in Kenya. Always provide accurate information in the requested JSON format."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 1000
        });

        // Parse the response to get the JSON object
        const responseText = completion.choices[0].message.content;
        const universityDetails = JSON.parse(responseText);

        res.json(universityDetails);
    } catch (error) {
        console.error('Error fetching university details:', error);
        res.status(500).json({ error: 'Failed to fetch university details' });
    }
});

// Helper function to parse OpenAI response
function parseOpenAIResponse(response) {
    try {
        // First try to parse as JSON in case it's already formatted correctly
        try {
            return JSON.parse(response);
        } catch (e) {
            // If not JSON, parse the text response into structured data
            const universities = [];
            const lines = response.split('\n');
            let currentUniversity = null;

            lines.forEach(line => {
                // Look for university name and match percentage
                const matchRegex = /(\d+)%\s+match/i;
                if (line.includes(':')) {
                    const [key, value] = line.split(':').map(s => s.trim());
                    
                    if (line.toLowerCase().includes('university') || line.toLowerCase().includes('college')) {
                        // New university entry
                        if (currentUniversity) {
                            universities.push(currentUniversity);
                        }
                        currentUniversity = {
                            name: key,
                            matchRate: (line.match(matchRegex) || [0, '70'])[1],
                            programs: [],
                            location: '',
                            tuition: ''
                        };
                    } else if (currentUniversity) {
                        // Add details to current university
                        if (key.toLowerCase().includes('location')) {
                            currentUniversity.location = value;
                        } else if (key.toLowerCase().includes('program')) {
                            currentUniversity.programs = value.split(',').map(p => p.trim());
                        } else if (key.toLowerCase().includes('tuition')) {
                            currentUniversity.tuition = value;
                        }
                    }
                }
            });

            // Add the last university if exists
            if (currentUniversity) {
                universities.push(currentUniversity);
            }

            return universities;
        }
    } catch (error) {
        console.error('Error parsing OpenAI response:', error);
        return [];
    }
}

app.get('/api/universities/logo/:id', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const university = await db.get('SELECT name, logo_url FROM universities WHERE id = ?', [req.params.id]);
        
        if (!university) {
            return res.status(404).json({ error: 'University not found' });
        }

        // If logo already exists, return it
        if (university.logo_url) {
            return res.json({ logo_url: university.logo_url });
        }

        // Use Google Custom Search API to find the university logo
        const searchQuery = `${university.name} Kenya university official logo site:.ac.ke OR site:.edu`;
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(searchQuery)}&searchType=image&num=1`;

        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        let logoUrl = '/frontend/images/logo.png'; // Default fallback

        if (searchData.items && searchData.items.length > 0) {
            logoUrl = searchData.items[0].link;
        }

        // Save the logo URL to the database
        await db.run(
            'UPDATE universities SET logo_url = ? WHERE id = ?',
            [logoUrl, req.params.id]
        );

        res.json({ logo_url: logoUrl });
    } catch (error) {
        console.error('Error fetching university logo:', error);
        res.status(500).json({ 
            error: 'Failed to fetch logo',
            logo_url: '/frontend/images/logo.png'
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
