const express = require('express');
const router = express.Router();
const db = require('../utils/database');
const productSearchScraper = require('../utils/productSearchScraper');
const { requireMasterAdmin } = require('../middleware/auth');

/**
 * GET /products/search-online
 * Master Admin only - Search products on e-commerce sites
 */
router.get('/search-online', requireMasterAdmin, async (req, res) => {
    try {
        const { q, platform } = req.query;

        let results = { khosla: [], flipkart: [], amazon: [], errors: [] };

        if (q) {
            // Search requested platforms
            if (platform === 'all' || !platform) {
                results = await productSearchScraper.searchAll(q, 10);
            } else if (platform === 'khosla') {
                await productSearchScraper.initBrowser();
                results.khosla = await productSearchScraper.searchKhosla(q, 10);
                await productSearchScraper.closeBrowser();
            } else if (platform === 'flipkart') {
                await productSearchScraper.initBrowser();
                results.flipkart = await productSearchScraper.searchFlipkart(q, 10);
                await productSearchScraper.closeBrowser();
            } else if (platform === 'amazon') {
                await productSearchScraper.initBrowser();
                results.amazon = await productSearchScraper.searchAmazon(q, 10);
                await productSearchScraper.closeBrowser();
            }
        }

        res.render('products/search-online', {
            title: 'Search Products Online',
            query: q || '',
            platform: platform || 'all',
            results,
            user: req.user
        });
    } catch (error) {
        console.error('Online search error:', error);
        req.flash('error', 'Error searching products: ' + error.message);
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

        // Check for duplicate by barcode
        if (barcode && barcode.trim() !== '') {
            const [existing] = await connection.execute(
                'SELECT id FROM products WHERE barcode = ? AND is_active = TRUE',
                [barcode.trim()]
            );

            if (existing.length > 0) {
                await connection.rollback();
                return res.json({
                    success: false,
                    duplicate: true,
                    message: 'Product with this barcode already exists',
                    productId: existing[0].id
                });
            }
        }

        // Check for duplicate by name + brand
        const [existingName] = await connection.execute(
            'SELECT id FROM products WHERE name = ? AND brand = ? AND is_active = TRUE',
            [name, brand]
        );

        if (existingName.length > 0) {
            await connection.rollback();
            return res.json({
                success: false,
                duplicate: true,
                message: 'Product with this name and brand already exists',
                productId: existingName[0].id
            });
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
                name, description || null, category_id || null, brand || null, model || null,
                hsn_code || null, sku, barcode || null,
                purchase_price || 0, selling_price || 0, mrp || selling_price || 0,
                gst_rate || 18, 0, 5, 'piece',
                JSON.stringify({ source: source_platform, imported_from: 'online_search' })
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
 * GET /api/products/check-duplicate
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
