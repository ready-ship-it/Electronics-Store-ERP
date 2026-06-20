const express = require('express');
const router = express.Router();
const db = require('../utils/database');
const { requireAuth } = require('../middleware/auth');

/**
 * GET /api/products/stats
 * Product database statistics
 */
router.get('/stats', requireAuth, async (req, res) => {
    try {
        const [[productCount]] = await db.execute(
            'SELECT COUNT(*) as count FROM products WHERE is_active = TRUE'
        );

        const [[barcodeCount]] = await db.execute(
            'SELECT COUNT(DISTINCT barcode) as count FROM products WHERE barcode IS NOT NULL AND barcode != "" AND is_active = TRUE'
        );

        res.json({
            success: true,
            totalProducts: productCount.count,
            totalBarcodes: barcodeCount.count
        });
    } catch (error) {
        console.error('Product stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error loading product statistics'
        });
    }
});

module.exports = router;
