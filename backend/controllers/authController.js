const emailService = require('../services/emailService');
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
        const { email, name, credential, idToken, accessToken } = req.body;
        const googleToken = credential || idToken;

        let googleEmail = email;
        let googleName = name;
        let googlePicture = null;

        // 1. If Google ID Token / GIS credential is provided, verify with Google
        if (googleToken) {
            try {
                const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(googleToken)}`);
                if (googleRes.ok) {
                    const tokenInfo = await googleRes.json();
                    const expectedClientId = process.env.GOOGLE_CLIENT_ID;
                    if (tokenInfo.aud && expectedClientId && tokenInfo.aud !== expectedClientId) {
                        return res.status(401).json({ error: 'Google OAuth token audience mismatch.' });
                    }
                    googleEmail = tokenInfo.email;
                    googleName = tokenInfo.name || tokenInfo.email.split('@')[0];
                    googlePicture = tokenInfo.picture || null;
                } else {
                    return res.status(401).json({ error: 'Invalid Google OAuth ID token.' });
                }
            } catch (err) {
                console.warn('Google tokeninfo fetch warning:', err.message);
                if (!googleEmail) {
                    return res.status(401).json({ error: 'Failed to verify Google token with Google servers.' });
                }
            }
        } else if (accessToken) {
            // 2. If Google Access Token is provided, fetch Google userinfo
            try {
                const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                if (userinfoRes.ok) {
                    const profile = await userinfoRes.json();
                    googleEmail = profile.email;
                    googleName = profile.name || profile.email.split('@')[0];
                    googlePicture = profile.picture || null;
                } else {
                    return res.status(401).json({ error: 'Invalid Google access token.' });
                }
            } catch (err) {
                console.warn('Google userinfo fetch warning:', err.message);
                if (!googleEmail) {
                    return res.status(401).json({ error: 'Failed to verify Google access token.' });
                }
            }
        }

        // Fallback default for simulated development mode
        const finalEmail = (googleEmail && googleEmail.trim()) ? googleEmail.trim().toLowerCase() : '';
        if (!finalEmail) {
            return res.status(400).json({ error: 'Valid Google email is required.' });
        }
        const finalName = (googleName && googleName.trim()) ? googleName.trim() : finalEmail.split('@')[0];
        const avatarLetter = finalName.charAt(0).toUpperCase() || 'G';

        let result = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [finalEmail]);
        let user;
        let isNewUser = false;

        if (result.rows.length === 0) {
            isNewUser = true;
            // Create user with randomized high-entropy password
            const tempPass = await bcrypt.hash('GoogleOAuth_' + Math.random().toString(36), 10);
            const insertResult = await db.query(
                `INSERT INTO users (name, email, password, avatar_letter)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, name, email, avatar_letter, created_at`,
                [finalName, finalEmail, tempPass, avatarLetter]
            );
            user = insertResult.rows[0];
            try {
                await db.query('INSERT INTO profiles (user_id, name, email) VALUES ($1, $2, $3)', [user.id, user.name, user.email]);
                await db.query('INSERT INTO budget_settings (user_id) VALUES ($1)', [user.id]);
            } catch (e) {}
        } else {
            user = result.rows[0];
            // Update name and avatar letter if provided and changed
            if (finalName && user.name !== finalName) {
                try {
                    await db.query('UPDATE users SET name = $1, avatar_letter = $2 WHERE id = $3', [finalName, avatarLetter, user.id]);
                    user.name = finalName;
                    user.avatar_letter = avatarLetter;
                } catch (e) {}
            }
        }

        const token = generateToken(user);
        return res.status(200).json({
            message: 'Google login successful.',
            isNewUser: isNewUser,
            needsProfileSetup: isNewUser,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatarLetter: user.avatar_letter || avatarLetter,
                picture: googlePicture,
                isGoogleUser: true,
                isNewUser: isNewUser,
                needsProfileSetup: isNewUser
            },
            token
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/auth/forgot-password
 */
async function forgotPassword(req, res, next) {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email address is required.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const result = await db.query('SELECT id, name, email FROM users WHERE LOWER(email) = $1', [normalizedEmail]);

        // Security best practice: Always return 200 to prevent user enumeration
        if (result.rows.length === 0) {
            return res.status(200).json({
                message: 'If an account matches that email, reset instructions have been dispatched.'
            });
        }

        const user = result.rows[0];
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5000';

        const resetToken = jwt.sign(
            { userId: user.id, email: user.email, type: 'pwd_reset' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        const resetUrl = `${clientUrl}/auth.html?token=${resetToken}&tab=reset`;

        await emailService.sendPasswordResetEmail({
            to: user.email,
            name: user.name,
            resetUrl
        });

        return res.status(200).json({
            message: 'Password reset instructions have been dispatched successfully.',
            email: user.email
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/auth/reset-password
 */
async function resetPassword(req, res, next) {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (jwtErr) {
            return res.status(401).json({ error: 'Invalid or expired password reset link. Please request a new one.' });
        }

        if (decoded.type !== 'pwd_reset' || !decoded.userId) {
            return res.status(401).json({ error: 'Invalid reset token payload.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, decoded.userId]);

        return res.status(200).json({
            message: 'Password has been updated successfully. You can now sign in with your new password.'
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    register,
    login,
    getMe,
    googleAuth,
    forgotPassword,
    resetPassword
};
