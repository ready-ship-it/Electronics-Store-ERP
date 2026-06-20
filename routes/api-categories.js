const express = require('express');
const router = express.Router();
const db = require('../utils/database');
const { requireAuth } = require('../middleware/auth');

/**
 * GET /api/categories
 * Get all categories for dropdowns
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const [categories] = await db.execute(
            'SELECT id, name FROM categories ORDER BY name'
        );

        res.json({
            success: true,
            categories
        });
    } catch (error) {
        console.error('Categories API error:', error);
        res.status(500).json({
            success: false,
            message: 'Error loading categories'
        });
    }
});

module.exports = router;
