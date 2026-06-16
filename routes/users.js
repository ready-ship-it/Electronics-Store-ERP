const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../utils/database');
const { requireRole } = require('../middleware/auth');

// List all users
router.get('/', requireRole(['master_admin', 'admin']), async (req, res) => {
    try {
        const [users] = await db.execute(
            'SELECT id, username, email, full_name, role, phone, is_active, created_at FROM users ORDER BY created_at DESC'
        );

        res.render('users/list', {
            title: 'User Management',
            users,
            user: req.user
        });
    } catch (error) {
        req.flash('error', 'Error loading users');
        res.redirect('/');
    }
});

// Add user page
router.get('/add', requireRole(['master_admin']), async (req, res) => {
    res.render('users/add', { title: 'Add User', user: req.user });
});

// Add user process
router.post('/add', requireRole(['master_admin']), async (req, res) => {
    try {
        const { username, email, password, full_name, role, phone } = req.body;

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.execute(
            'INSERT INTO users (username, email, password, full_name, role, phone) VALUES (?, ?, ?, ?, ?, ?)',
            [username, email, hashedPassword, full_name, role || 'user', phone || null]
        );

        req.flash('success', 'User added successfully');
        res.redirect('/users');

    } catch (error) {
        console.error('Add user error:', error);
        req.flash('error', 'Error adding user: ' + error.message);
        res.redirect('/users/add');
    }
});

// Edit user page
router.get('/edit/:id', requireRole(['master_admin']), async (req, res) => {
    try {
        const [users] = await db.execute('SELECT id, username, email, full_name, role, phone, is_active FROM users WHERE id = ?', [req.params.id]);
        if (users.length === 0) {
            req.flash('error', 'User not found');
            return res.redirect('/users');
        }

        res.render('users/edit', {
            title: 'Edit User',
            editUser: users[0],
            user: req.user
        });
    } catch (error) {
        req.flash('error', 'Error loading user');
        res.redirect('/users');
    }
});

// Update user
router.put('/edit/:id', requireRole(['master_admin']), async (req, res) => {
    try {
        const { email, full_name, role, phone, is_active, password } = req.body;
        const { id } = req.params;

        // Prevent changing own role from master_admin
        if (parseInt(id) === req.user.id && role !== 'master_admin') {
            req.flash('error', 'You cannot change your own role from Master Admin');
            return res.redirect('/users');
        }

        let query = 'UPDATE users SET email = ?, full_name = ?, role = ?, phone = ?, is_active = ?';
        let params = [email, full_name, role, phone || null, is_active === 'on' ? 1 : 0];

        if (password && password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(password, 10);
            query += ', password = ?';
            params.push(hashedPassword);
        }

        query += ' WHERE id = ?';
        params.push(id);

        await db.execute(query, params);

        req.flash('success', 'User updated successfully');
        res.redirect('/users');

    } catch (error) {
        console.error('Update user error:', error);
        req.flash('error', 'Error updating user');
        res.redirect('/users');
    }
});

// Toggle user status
router.post('/toggle/:id', requireRole(['master_admin']), async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent disabling self
        if (parseInt(id) === req.user.id) {
            req.flash('error', 'You cannot disable your own account');
            return res.redirect('/users');
        }

        const [users] = await db.execute('SELECT is_active FROM users WHERE id = ?', [id]);
        if (users.length === 0) {
            req.flash('error', 'User not found');
            return res.redirect('/users');
        }

        const newStatus = users[0].is_active ? 0 : 1;
        await db.execute('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, id]);

        req.flash('success', `User ${newStatus ? 'enabled' : 'disabled'} successfully`);
        res.redirect('/users');

    } catch (error) {
        req.flash('error', 'Error toggling user status');
        res.redirect('/users');
    }
});

module.exports = router;
