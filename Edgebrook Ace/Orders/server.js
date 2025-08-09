// server.js
import express from 'express';
import bcrypt from 'bcrypt';
import { Pool } from 'pg'
// import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
// const USERS_FILE = path.resolve('./users.dat');

// serve everything in /public as static files
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure Postgres pool
const isProd = process.env.NODE_ENV === 'production';
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProd
        ? { rejectUnauthorized: false }   // on Render, Postgres requires SSL
        : false                           // locally, disable SSL
});


// Make sure user table exists
await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        name     TEXT NOT NULL,
        hash     TEXT NOT NULL,
        is_admin BOOLEAN NOT NULL DEFAULT FALSE
        );
    `);

// Registration endpoint
app.post('/api/register', async (req, res) => {
    const { username, password, name, is_admin } = req.body;
    if (!username || !password || !name) {
        return res.status(400).json({ error: 'Missing fields' });
    }
    try {
        const hash = await bcrypt.hash(password, 12);
        const adminFlag = is_admin === true;
        await pool.query(
            'INSERT INTO users (username, name, hash, is_admin) VALUES ($1, $2, $3, $4)',
            [username, name, hash, adminFlag]
        );
        res.json({ success: true });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Username already exists' });
        }
        console.error(err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Missing fields' });
    }
    try {
        const result = await pool.query(
            'SELECT name, hash, is_admin FROM users WHERE username = $1',
            [username]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const { name, hash, is_admin } = result.rows[0];
        const match = await bcrypt.compare(password, hash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        res.json({ name, is_admin });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// --------------
// Get all users
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT username, name, hash AS password, is_admin FROM users ORDER BY username'
        );
        // Send back an array of { username, name, admin: boolean }
        res.json(
            result.rows.map(r => ({
                username: r.username,
                name: r.name,
                // password: r.password,
                admin: r.is_admin
            }))
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not fetch users' });
    }
});

// --------------
// Add one user (admin only)
app.post('/api/users', async (req, res) => {
    const { username, name, password, admin } = req.body;
    if (!username || !name || !password) {
        return res.status(400).json({ error: 'Missing fields' });
    }
    try {
        const hash = await bcrypt.hash(password, 12);
        await pool.query(
            'INSERT INTO users (username, name, hash, is_admin) VALUES ($1,$2,$3,$4)',
            [username, name, hash, admin === true]
        );
        res.status(201).end();
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'Username exists' });
        console.error(err);
        res.status(500).json({ error: 'Could not add user' });
    }
});

// --------------
// Delete multiple users (admin only)
app.delete('/api/users', async (req, res) => {
    const { usernames } = req.body;
    if (!Array.isArray(usernames) || usernames.length === 0) {
        return res.status(400).json({ error: 'No usernames provided' });
    }
    try {
        // Use SQL IN‐clause
        const placeholders = usernames.map((_, i) => `$${i + 1}`).join(',');
        await pool.query(
            `DELETE FROM users WHERE username IN (${placeholders})`,
            usernames
        );
        res.status(204).end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not delete users' });
    }
});

// Change a single user’s password
app.put('/api/users/:username/password', async (req, res) => {
    const { username } = req.params;
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ error: 'Password required' });
    }
    try {
        const hash = await bcrypt.hash(password, 12);
        const result = await pool.query(
            'UPDATE users SET hash = $1 WHERE username = $2',
            [hash, username]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(204).end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not update password' });
    }
});



app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});


// // load or initialize users array
// async function readUsers() {
//     try {
//         const txt = await fs.readFile(USERS_FILE, 'utf8');
//         return JSON.parse(txt);
//     } catch (e) {
//         if (e.code === 'ENOENT') return [];
//         throw e;
//     }
// }

// // write back to users.dat
// async function writeUsers(users) {
//     await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
// }

// // Login
// app.post('/api/login', async (req, res) => {
//     const { username, password } = req.body;
//     if (!username || !password) {
//         return res.status(400).json({ error: 'Username and password required' });
//     }

//     const users = await readUsers();
//     const user = users.find(u => u.username === username);
//     if (!user) {
//         return res.status(401).json({ error: 'Invalid credentials' });
//     }

//     const match = await bcrypt.compare(password, user.hash);
//     if (!match) {
//         return res.status(401).json({ error: 'Invalid credentials' });
//     }

//     // return only this user’s info
//     return res.json({
//         name: user.name,
//         admin: user.admin || false
//     })
// });

// // Get all users (admin only)
// app.get('/api/users', async (req, res) => {
//     const users = await readUsers();
//     res.json(users.map(u => ({
//         name: u.name,
//         username: u.username,
//         password: u.hash,       // your existing field
//         admin: u.admin || false  // <–– make sure this line is here
//     })));
// });

// // Add a new user
// app.post('/api/users', async (req, res) => {
//     const { name, username, password } = req.body;
//     if (!name || !username || !password) {
//         return res.status(400).json({ error: 'Name, username, and password are required' });
//     }

//     const users = await readUsers();
//     if (users.some(u => u.username === username)) {
//         return res.status(400).json({ error: 'Username already exists' });
//     }

//     const hash = await bcrypt.hash(password, 10);
//     const { admin = false } = req.body;
//     users.push({ name, username, hash, admin });
//     await writeUsers(users);

//     res.status(201).end();
// });

// // Delete users
// app.delete('/api/users', async (req, res) => {
//     const { usernames } = req.body;
//     if (!Array.isArray(usernames)) {
//         return res.status(400).json({ error: 'usernames must be an array' });
//     }

//     let users = await readUsers();
//     users = users.filter(u => !usernames.includes(u.username));
//     await writeUsers(users);

//     res.status(204).end();
// });

// app.listen(PORT, () => {
//     console.log(`Server listening on http://localhost:${PORT}`);
// });