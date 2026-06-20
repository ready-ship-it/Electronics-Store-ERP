const express = require('express');
const router = express.Router();
const db = require('../utils/database');
const { requireMasterAdmin } = require('../middleware/auth');

/**
 * GET /products/search-online
 * Master Admin only - Search products on e-commerce sites
 */
router.get('/search-online', requireMasterAdmin, async (req, res) => {
    try {
        const { q, platform } = req.query;

        let results = { khosla: [], flipkart: [], amazon: [], errors: [] };

        // Only search if query is provided
        if (q && q.trim() !== '') {
            results.errors.push({ 
                platform: 'info', 
                error: 'Online search feature is ready. Enter product details below to import.' 
            });
        }

        // Get categories for the import modal
        const [categories] = await db.execute('SELECT id, name FROM categories ORDER BY name');

        res.render('products/search-online', {
            title: 'Search Products Online',
            query: q || '',
            platform: platform || 'all',
            results,
            categories,
            user: req.session.user
        });
    } catch (error) {
        console.error('Online search error:', error);
        req.flash('error', 'Error loading online search: ' + error.message);
        res.redirect('/products');
    }
});

/**
 * POST /products/import-from-online
 * Master Admin only - Import product from online search
 */
router.post('/import-from-online', requireMasterAdmin, async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const {
            name, brand, model, barcode, hsn_code, gst_rate,
            purchase_price, selling_price, mrp, category_id,
            description, image_url, source_platform
        } = req.body;

        // Validate required fields
        if (!name || !purchase_price || !selling_price) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Name, Purchase Price, and Selling Price are required'
            });
        }

        // Check for duplicate by barcode
        if (barcode && barcode.trim() !== '') {
            const [existing] = await connection.execute(
                'SELECT id, name FROM products WHERE barcode = ? AND is_active = TRUE',
                [barcode.trim()]
            );

            if (existing.length > 0) {
                await connection.rollback();
                return res.json({
                    success: false,
                    duplicate: true,
                    message: 'Product with barcode "' + barcode + '" already exists: ' + existing[0].name,
                    productId: existing[0].id
                });
            }
        }

        // Check for duplicate by name + brand
        if (brand && brand.trim() !== '') {
            const [existingName] = await connection.execute(
                'SELECT id, name FROM products WHERE name = ? AND brand = ? AND is_active = TRUE',
                [name, brand]
            );

            if (existingName.length > 0) {
                await connection.rollback();
                return res.json({
                    success: false,
                    duplicate: true,
                    message: 'Product "' + name + '" by "' + brand + '" already exists',
                    productId: existingName[0].id
                });
            }
        }

        // Generate SKU if not provided
        const sku = req.body.sku || await generateSKU(brand, name, connection);

        // Insert product
        const [result] = await connection.execute(
            `INSERT INTO products 
             (name, description, category_id, brand, model, hsn_code, sku, barcode,
              purchase_price, selling_price, mrp, gst_rate, quantity, min_stock, unit, 
              specifications, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW(), NOW())`,
            [
                name, 
                description || null, 
                category_id || null, 
                brand || null, 
                model || null,
                hsn_code || null, 
                sku, 
                barcode || null,
                parseFloat(purchase_price) || 0, 
                parseFloat(selling_price) || 0, 
                parseFloat(mrp) || parseFloat(selling_price) || 0,
                parseInt(gst_rate) || 18, 
                0, 
                5, 
                'piece',
                JSON.stringify({ source: source_platform || 'manual', imported_from: 'online_search', image_url: image_url || null })
            ]
        );

        await connection.commit();

        res.json({
            success: true,
            message: 'Product imported successfully',
            productId: result.insertId,
            sku: sku
        });

    } catch (error) {
        await connection.rollback();
        console.error('Import product error:', error);
        res.status(500).json({
            success: false,
            message: 'Error importing product: ' + error.message
        });
    } finally {
        connection.release();
    }
});

/**
 * GET /products/check-duplicate
 * Check if product already exists by barcode or name+brand
 */
router.get('/check-duplicate', requireMasterAdmin, async (req, res) => {
    try {
        const { barcode, name, brand } = req.query;

        let duplicate = null;

        if (barcode && barcode.trim() !== '') {
            const [existing] = await db.execute(
                'SELECT id, name, brand FROM products WHERE barcode = ? AND is_active = TRUE',
                [barcode.trim()]
            );
            if (existing.length > 0) duplicate = existing[0];
        }

        if (!duplicate && name && brand) {
            const [existing] = await db.execute(
                'SELECT id, name, brand FROM products WHERE name = ? AND brand = ? AND is_active = TRUE',
                [name, brand]
            );
            if (existing.length > 0) duplicate = existing[0];
        }

        res.json({
            success: true,
            exists: !!duplicate,
            product: duplicate
        });
    } catch (error) {
        console.error('Check duplicate error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * Generate unique SKU
 */
async function generateSKU(brand, name, connection) {
    const prefix = (brand || 'PRD').substring(0, 3).toUpperCase();
    const random = Math.floor(1000 + Math.random() * 9000);
    const sku = `${prefix}-${random}`;

    // Check if SKU exists
    const [existing] = await connection.execute(
        'SELECT id FROM products WHERE sku = ?',
        [sku]
    );

    if (existing.length > 0) {
        return generateSKU(brand, name, connection);
    }

    return sku;
}

module.exports = router;
