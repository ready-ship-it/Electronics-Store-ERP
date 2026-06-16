const db = require('../utils/database');

// Set user in request from session
async function setUser(req, res, next) {
    if (req.session && req.session.userId) {
        try {
            const [users] = await db.execute(
                'SELECT id, username, email, full_name, role, phone, is_active FROM users WHERE id = ?',
                [req.session.userId]
            );
            if (users.length > 0 && users[0].is_active) {
                req.user = users[0];
                req.session.user = users[0];
            } else {
                // User not found or inactive - clear session
                req.session.destroy();
                req.user = null;
            }
        } catch (error) {
            console.error('Auth middleware error:', error);
            req.user = null;
        }
    } else {
        req.user = null;
    }
    next();
}

// Check if user is authenticated
function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        req.flash('error', 'Please login to access this page');
        return res.redirect('/auth/login');
    }
    next();
}

// Check user role
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            req.flash('error', 'You do not have permission to access this page');
            return res.redirect('/');
        }
        next();
    };
}

// Check if user is master admin
function requireMasterAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'master_admin') {
        req.flash('error', 'Only Master Admin can perform this action');
        return res.redirect('/');
    }
    next();
}

module.exports = {
    setUser,
    requireAuth,
    requireRole,
    requireMasterAdmin
};
