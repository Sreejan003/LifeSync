/**
 * LifeSync Auth Controller (backend/controllers/authController.js)
 * -------------------------------------------------------------
 * Handles user registration with bcrypt password hashing,
 * credential login, JWT token issuance, and current user retrieval.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'lifesync_super_secret_jwt_key_2026_student_dev';
const JWT_EXPIRES_IN = '7d';

/**
 * Generate cryptographically signed JWT token
 */
function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            name: user.name
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * POST /api/auth/register
 */
async function register(req, res, next) {
    try {
        const { name, email, password } = req.body;

        // Validation
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Name is required.' });
        }
        if (!email || !email.trim()) {
            return res.status(400).json({ error: 'Email is required.' });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return res.status(400).json({ error: 'Please provide a valid email address.' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const trimmedName = name.trim();

        // Check for existing email
        const existing = await db.query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'An account with this email already exists.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const avatarLetter = trimmedName.charAt(0).toUpperCase() || 'S';

        // Insert new user
        const result = await db.query(
            `INSERT INTO users (name, email, password, avatar_letter)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, email, avatar_letter, created_at`,
            [trimmedName, normalizedEmail, hashedPassword, avatarLetter]
        );

        const newUser = result.rows[0];

        // Initialize default user profile & budget settings
        try {
            await db.query(
                `INSERT INTO profiles (user_id, name, email) VALUES ($1, $2, $3)`,
                [newUser.id, newUser.name, newUser.email]
            );
            await db.query(
                `INSERT INTO budget_settings (user_id) VALUES ($1)`,
                [newUser.id]
            );
        } catch (initErr) {
            console.warn('Initial profile/settings seed notice:', initErr.message);
        }

        const token = generateToken(newUser);

        return res.status(201).json({
            message: 'User registered successfully.',
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                avatarLetter: newUser.avatar_letter || avatarLetter,
                createdAt: newUser.created_at
            },
            token
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/auth/login
 */
async function login(req, res, next) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Look up user
        const result = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const user = result.rows[0];

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const token = generateToken(user);

        return res.status(200).json({
            message: 'Logged in successfully.',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatarLetter: user.avatar_letter || user.name.charAt(0).toUpperCase(),
                createdAt: user.created_at
            },
            token
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/auth/me
 */
async function getMe(req, res, next) {
    try {
        const result = await db.query(
            'SELECT id, name, email, avatar_letter, created_at FROM users WHERE id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const user = result.rows[0];
        return res.status(200).json({
            id: user.id,
            name: user.name,
            email: user.email,
            avatarLetter: user.avatar_letter || user.name.charAt(0).toUpperCase(),
            createdAt: user.created_at
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/auth/google (Google OAuth / Simulation Endpoint)
 */
async function googleAuth(req, res, next) {
    try {
        const { email, name } = req.body;
        const googleEmail = (email && email.trim()) ? email.trim().toLowerCase() : 'student.google@gmail.com';
        const googleName = (name && name.trim()) ? name.trim() : 'Google Student';
        const avatarLetter = googleName.charAt(0).toUpperCase() || 'G';

        let result = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [googleEmail]);
        let user;

        if (result.rows.length === 0) {
            // Create user with randomized high-entropy password
            const tempPass = await bcrypt.hash('GoogleOAuth_' + Math.random().toString(36), 10);
            const insertResult = await db.query(
                `INSERT INTO users (name, email, password, avatar_letter)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, name, email, avatar_letter, created_at`,
                [googleName, googleEmail, tempPass, avatarLetter]
            );
            user = insertResult.rows[0];
            try {
                await db.query('INSERT INTO profiles (user_id, name, email) VALUES ($1, $2, $3)', [user.id, user.name, user.email]);
                await db.query('INSERT INTO budget_settings (user_id) VALUES ($1)', [user.id]);
            } catch (e) {}
        } else {
            user = result.rows[0];
        }

        const token = generateToken(user);
        return res.status(200).json({
            message: 'Google login successful.',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatarLetter: user.avatar_letter || avatarLetter,
                isGoogleUser: true
            },
            token
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    register,
    login,
    getMe,
    googleAuth
};
