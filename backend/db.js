const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const OpenAI = require('openai');
const path = require('path');
let db;

// Define the absolute path to the database file
const dbPath = path.join(__dirname, 'database.sqlite');

async function initializeDatabase() {
    try {
        // Open database with absolute path
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        // Create tables
        await createTables();

        // Check if universities table is empty
        const count = await db.get('SELECT COUNT(*) as count FROM universities');
        if (count.count === 0) {
            await populateUniversities();
        }

        console.log('Database initialized successfully');
        return db;
    } catch (error) {
        console.error('Database initialization error:', error);
        process.exit(1);
    }
}

async function createTables() {
    await db.exec(`
        -- Users table
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            
            password TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Universities table
        CREATE TABLE IF NOT EXISTS universities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            location TEXT NOT NULL,
            description TEXT,
            programs TEXT,
            tuition_range TEXT,
            facilities TEXT,
            student_population INTEGER,
            established_year INTEGER,
            website TEXT,
            email TEXT,
            phone TEXT,
            ranking INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            logo_url TEXT
        );

        -- Favorites table
        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            university_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (university_id) REFERENCES universities(id),
            UNIQUE(user_id, university_id)
        );
    `);
}

async function populateUniversities() {
    try {
        const openai = new OpenAI({
            apiKey: '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'
        });

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are a Kenyan university database expert. Provide detailed information about major universities in Kenya."
                },
                {
                    role: "user",
                    content: `List 20 major universities in Kenya with their details in this JSON format:
                    {
                        "universities": [
                            {
                                "name": "string",
                                "location": "string",
                                "description": "string",
                                "programs": ["string"],
                                "tuition_range": "string",
                                "facilities": ["string"],
                                "student_population": number,
                                "established_year": number,
                                "website": "string",
                                "email": "string",
                                "phone": "string",
                                "ranking": number
                            }
                        ]
                    }`
                }
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        const universities = JSON.parse(completion.choices[0].message.content).universities;

        // Insert universities into database
        for (const uni of universities) {
            await db.run(`
                INSERT OR IGNORE INTO universities (
                    name, location, description, programs, 
                    tuition_range, facilities, student_population,
                    established_year, website, email, phone, ranking
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uni.name,
                uni.location,
                uni.description,
                JSON.stringify(uni.programs),
                uni.tuition_range,
                JSON.stringify(uni.facilities),
                uni.student_population,
                uni.established_year,
                uni.website,
                uni.email,
                uni.phone,
                uni.ranking
            ]);
        }

        console.log('Universities populated successfully');
    } catch (error) {
        console.error('Error populating universities:', error);
    }
}

function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized');
    }
    return db;
}

module.exports = {
    initializeDatabase,
    getDatabase
};