const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../utils/database');

// Login page
router.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/');
    }
    res.render('auth/login', { title: 'Login', layout: false });
});

// Login process
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const [users] = await db.execute(
            'SELECT * FROM users WHERE username = ? AND is_active = TRUE',
            [username]
        );

        if (users.length === 0) {
            req.flash('error', 'Invalid username or password');
            return res.redirect('/auth/login');
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            req.flash('error', 'Invalid username or password');
            return res.redirect('/auth/login');
        }

        req.session.userId = user.id;
        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            role: user.role
        };

        req.flash('success', `Welcome back, ${user.full_name}!`);
        res.redirect('/');

    } catch (error) {
        console.error('Login error:', error);
        req.flash('error', 'An error occurred during login');
        res.redirect('/auth/login');
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/auth/login');
});

module.exports = router;
