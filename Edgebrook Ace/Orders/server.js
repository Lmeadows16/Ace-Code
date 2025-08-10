// server.js
import express from 'express';
import bcrypt from 'bcrypt';
import { Pool } from 'pg'
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Behind Render's proxy to get the real client IP for rate limiting
app.set('trust proxy', 1);

// serve everything in /public as static files
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure Postgres pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false
});

pool.on('connect', client => client.query('SET search_path TO public'));


// Make sure user table exists
await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        username    TEXT UNIQUE NOT NULL,
        name        TEXT NOT NULL,
        hash        TEXT NOT NULL,
        is_admin    BOOLEAN NOT NULL DEFAULT FALSE
        );
    `);

// Health endpoints
app.get('/healthz', async (req, res) => {
    const start = Date.now();
    try {
        await pool.query('SELECT 1');
        res.status(200).json({ status: 'ok', db: 'up', latency_ms: Date.now() - start });
    } catch (e) {
        res.status(503).json({ status: 'degraded', db: 'down', error: e.message });
    }
});

app.get('/readyz', async (req, res) => {
    try {
        await pool.query('SELECT 1 FROM public.users LIMIT 1');
        res.status(200).json({ ready: true });
    } catch (e) {
        res.status(503).json({ ready: false, error: e.message });
    }
});

// Limit login attempts to 5 per IP per minute
const loginLimiter = rateLimit({
    windowMs: 60 * 1000,    // 1 minutes
    max: 5,                 // limit each IP to 5 requests per window
    message: { error: 'Too many login attempts. Please try again in 1 minute.' },
    standardHeaders: true,  // send RateLimit-* headers
    legacyHeaders: false,   // disable X-RateLimit-* headers
});

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
            'INSERT INTO public.users (username, name, hash, is_admin) VALUES ($1, $2, $3, $4)',
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

// Login endpoint (rate-limited)
app.post('/api/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({error: 'Missing fields'});

    try {
        const r = await pool.query(
            'SELECT id, name, username, hash, is_admin FROM public.users WHERE username = $1',
            [username]
        );
        if (!r.rowCount) return res.status(401).json({error: 'Invalid credentials'});

        const user = r.rows[0];
        const ok = await bcrypt.compare(password, user.hash);
        if (!ok) return res.status(401).json({error: 'Invalid credentials'});
        
        // Success
        return res.json({ok: true, id: user.id, name: user.name, username: user.username, is_admin: user.is_admin});
    } catch (err) {
        console.error(err);
        res.status(500).json({error: 'Login failed'});
    }
});

// Get all users
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT username, name, is_admin FROM public.users ORDER BY username'
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
            'INSERT INTO public.users (username, name, hash, is_admin) VALUES ($1,$2,$3,$4)',
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
            `DELETE FROM public.users WHERE username IN (${placeholders})`,
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
            'UPDATE public.users SET hash = $1 WHERE username = $2',
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
