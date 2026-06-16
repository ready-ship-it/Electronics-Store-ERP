const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../utils/database');

// Login page
router.get('/login', (req, res) => {
    console.log('GET /login - sessionID:', req.sessionID, 'userId:', req.session?.userId);
    if (req.session && req.session.userId) {
        console.log('Already logged in, redirecting to dashboard');
        return res.redirect('/');
    }
    res.render('auth/login', { title: 'Login', layout: false });
});

// Login process
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log('POST /login - attempt:', username, 'sessionID:', req.sessionID);

    try {
        const [users] = await db.execute(
            'SELECT * FROM users WHERE username = ? AND is_active = TRUE',
            [username]
        );

        if (users.length === 0) {
            console.log('User not found:', username);
            req.flash('error', 'Invalid username or password');
            return res.redirect('/auth/login');
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        console.log('Password match for', username, ':', isMatch);

        if (!isMatch) {
            req.flash('error', 'Invalid username or password');
            return res.redirect('/auth/login');
        }

        // Set session data
        req.session.userId = user.id;
        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            role: user.role
        };

        // Explicitly save session
        req.session.save((err) => {
            if (err) {
                console.error('Session save ERROR:', err);
                req.flash('error', 'Login error. Please try again.');
                return res.redirect('/auth/login');
            }

            console.log('Session saved successfully. userId:', req.session.userId);
            console.log('Cookie settings:', req.session.cookie);

            // Force redirect with 302
            req.flash('success', `Welcome back, ${user.full_name}!`);
            return res.redirect('/');
        });

    } catch (error) {
        console.error('Login error:', error);
        req.flash('error', 'An error occurred during login');
        res.redirect('/auth/login');
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.clearCookie('electronics_store_session');
        res.redirect('/auth/login');
    });
});

module.exports = router;
