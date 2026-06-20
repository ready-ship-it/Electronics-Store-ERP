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

        // If query provided, simulate search results
        if (q && q.trim() !== '') {
            const searchTerm = q.trim().toLowerCase();

            // Expanded sample data covering all quick-search categories
            const sampleProducts = [
                // Mixer Grinders
                { name: 'Prestige Iris 750 Watt Mixer Grinder', brand: 'Prestige', model: 'Iris', price: 2999, mrp: 4495, image: 'https://via.placeholder.com/300x300?text=Prestige+Mixer', link: 'https://www.khoslaonline.com', source: 'khosla', platform: 'Khosla Online' },
                { name: 'Bajaj GX-1 Mixer Grinder 500W', brand: 'Bajaj', model: 'GX-1', price: 1899, mrp: 2799, image: 'https://via.placeholder.com/300x300?text=Bajaj+Mixer', link: 'https://www.flipkart.com', source: 'flipkart', platform: 'Flipkart' },
                { name: 'Philips HL7756/00 Mixer Grinder', brand: 'Philips', model: 'HL7756/00', price: 3499, mrp: 4995, image: 'https://via.placeholder.com/300x300?text=Philips+Mixer', link: 'https://www.amazon.in', source: 'amazon', platform: 'Amazon' },
                // Induction Cooktops
                { name: 'Prestige Induction Cooktop PIC 6.0 V3', brand: 'Prestige', model: 'PIC 6.0 V3', price: 2499, mrp: 3495, image: 'https://via.placeholder.com/300x300?text=Prestige+Induction', link: 'https://www.khoslaonline.com', source: 'khosla', platform: 'Khosla Online' },
                { name: 'Philips HD4928/01 Induction Cooktop', brand: 'Philips', model: 'HD4928/01', price: 3299, mrp: 4495, image: 'https://via.placeholder.com/300x300?text=Philips+Induction', link: 'https://www.flipkart.com', source: 'flipkart', platform: 'Flipkart' },
                { name: 'Pigeon by Stovekraft Favourite Induction Cooktop', brand: 'Pigeon', model: 'Favourite', price: 1299, mrp: 1999, image: 'https://via.placeholder.com/300x300?text=Pigeon+Induction', link: 'https://www.amazon.in', source: 'amazon', platform: 'Amazon' },
                // Water Heaters
                { name: 'Bajaj New Shakti 15L Storage Water Heater', brand: 'Bajaj', model: 'New Shakti 15L', price: 5499, mrp: 7499, image: 'https://via.placeholder.com/300x300?text=Bajaj+Geyser', link: 'https://www.khoslaonline.com', source: 'khosla', platform: 'Khosla Online' },
                { name: 'AO Smith HSE-SHS-015 Storage Water Heater', brand: 'AO Smith', model: 'HSE-SHS-015', price: 8499, mrp: 11999, image: 'https://via.placeholder.com/300x300?text=AOSmith+Geyser', link: 'https://www.flipkart.com', source: 'flipkart', platform: 'Flipkart' },
                { name: 'Racold Eterno Pro 25L Water Heater', brand: 'Racold', model: 'Eterno Pro 25L', price: 9999, mrp: 13999, image: 'https://via.placeholder.com/300x300?text=Racold+Geyser', link: 'https://www.amazon.in', source: 'amazon', platform: 'Amazon' },
                // Ceiling Fans
                { name: 'Crompton Aura 48-inch Ceiling Fan', brand: 'Crompton', model: 'Aura 48\"', price: 2499, mrp: 3499, image: 'https://via.placeholder.com/300x300?text=Crompton+Fan', link: 'https://www.khoslaonline.com', source: 'khosla', platform: 'Khosla Online' },
                { name: 'Havells Leganza 1200mm Ceiling Fan', brand: 'Havells', model: 'Leganza 1200mm', price: 3299, mrp: 4599, image: 'https://via.placeholder.com/300x300?text=Havells+Fan', link: 'https://www.flipkart.com', source: 'flipkart', platform: 'Flipkart' },
                { name: 'Orient Electric Aeroquiet Ceiling Fan', brand: 'Orient', model: 'Aeroquiet', price: 2899, mrp: 3999, image: 'https://via.placeholder.com/300x300?text=Orient+Fan', link: 'https://www.amazon.in', source: 'amazon', platform: 'Amazon' },
                // Iron Press
                { name: 'Philips GC1905 Steam Iron', brand: 'Philips', model: 'GC1905', price: 1499, mrp: 2195, image: 'https://via.placeholder.com/300x300?text=Philips+Iron', link: 'https://www.khoslaonline.com', source: 'khosla', platform: 'Khosla Online' },
                { name: 'Bajaj MX-35N Steam Iron', brand: 'Bajaj', model: 'MX-35N', price: 899, mrp: 1299, image: 'https://via.placeholder.com/300x300?text=Bajaj+Iron', link: 'https://www.flipkart.com', source: 'flipkart', platform: 'Flipkart' },
                { name: 'Usha EI 3302 Gold Dry Iron', brand: 'Usha', model: 'EI 3302 Gold', price: 649, mrp: 995, image: 'https://via.placeholder.com/300x300?text=Usha+Iron', link: 'https://www.amazon.in', source: 'amazon', platform: 'Amazon' },
                // Toasters
                { name: 'Philips HD2582/00 Pop-up Toaster', brand: 'Philips', model: 'HD2582/00', price: 1799, mrp: 2495, image: 'https://via.placeholder.com/300x300?text=Philips+Toaster', link: 'https://www.khoslaonline.com', source: 'khosla', platform: 'Khosla Online' },
                { name: 'Morphy Richards AT-201 Pop-up Toaster', brand: 'Morphy Richards', model: 'AT-201', price: 2199, mrp: 2999, image: 'https://via.placeholder.com/300x300?text=Morphy+Toaster', link: 'https://www.flipkart.com', source: 'flipkart', platform: 'Flipkart' },
                { name: 'Bajaj Majesty ATX 4 Pop-up Toaster', brand: 'Bajaj', model: 'Majesty ATX 4', price: 1299, mrp: 1899, image: 'https://via.placeholder.com/300x300?text=Bajaj+Toaster', link: 'https://www.amazon.in', source: 'amazon', platform: 'Amazon' },
                // Electric Kettles
                { name: 'Prestige PKOSS Electric Kettle 1.5L', brand: 'Prestige', model: 'PKOSS 1.5L', price: 899, mrp: 1299, image: 'https://via.placeholder.com/300x300?text=Prestige+Kettle', link: 'https://www.khoslaonline.com', source: 'khosla', platform: 'Khosla Online' },
                { name: 'Philips HD9306/06 Electric Kettle', brand: 'Philips', model: 'HD9306/06', price: 1499, mrp: 2195, image: 'https://via.placeholder.com/300x300?text=Philips+Kettle', link: 'https://www.flipkart.com', source: 'flipkart', platform: 'Flipkart' },
                { name: 'Havells Aqua Plus Electric Kettle', brand: 'Havells', model: 'Aqua Plus', price: 1199, mrp: 1699, image: 'https://via.placeholder.com/300x300?text=Havells+Kettle', link: 'https://www.amazon.in', source: 'amazon', platform: 'Amazon' },
                // Rice Cookers
                { name: 'Prestige Delight PRWO 1.8-2 Electric Rice Cooker', brand: 'Prestige', model: 'PRWO 1.8-2', price: 2499, mrp: 3495, image: 'https://via.placeholder.com/300x300?text=Prestige+RiceCooker', link: 'https://www.khoslaonline.com', source: 'khosla', platform: 'Khosla Online' },
                { name: 'Panasonic SR-WA18H(E) Automatic Rice Cooker', brand: 'Panasonic', model: 'SR-WA18H(E)', price: 2999, mrp: 4199, image: 'https://via.placeholder.com/300x300?text=Panasonic+RiceCooker', link: 'https://www.flipkart.com', source: 'flipkart', platform: 'Flipkart' },
                { name: 'Butterfly Wave Electric Rice Cooker 1.8L', brand: 'Butterfly', model: 'Wave 1.8L', price: 1899, mrp: 2699, image: 'https://via.placeholder.com/300x300?text=Butterfly+RiceCooker', link: 'https://www.amazon.in', source: 'amazon', platform: 'Amazon' }
            ];

            // Filter sample products based on search term
            const filtered = sampleProducts.filter(p => 
                p.name.toLowerCase().includes(searchTerm) ||
                p.brand.toLowerCase().includes(searchTerm) ||
                p.model.toLowerCase().includes(searchTerm)
            );

            const productsToShow = filtered.length > 0 ? filtered : sampleProducts;

            // Distribute across platforms based on original source
            productsToShow.forEach(p => {
                if (platform === 'all' || platform === p.source) {
                    results[p.source].push(p);
                }
            });
        }

        // FIX: Use DISTINCT and filter NULL/empty to prevent duplicate categories
        const [categories] = await db.execute(
            `SELECT DISTINCT id, name 
             FROM categories 
             WHERE name IS NOT NULL AND name != '' 
             ORDER BY name`
        );

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


/**
 * POST /products/add-category
 * Master Admin only - Add a new category on the fly
 */
router.post('/add-category', requireMasterAdmin, async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Category name is required'
            });
        }

        const trimmedName = name.trim();

        // Check if category already exists
        const [existing] = await db.execute(
            'SELECT id FROM categories WHERE name = ?',
            [trimmedName]
        );

        if (existing.length > 0) {
            return res.json({
                success: true,
                message: 'Category already exists',
                categoryId: existing[0].id,
                categoryName: trimmedName
            });
        }

        // Insert new category
        const [result] = await db.execute(
            'INSERT INTO categories (name, created_at) VALUES (?, NOW())',
            [trimmedName]
        );

        res.json({
            success: true,
            message: 'Category added successfully',
            categoryId: result.insertId,
            categoryName: trimmedName
        });
    } catch (error) {
        console.error('Add category error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding category: ' + error.message
        });
    }
});

module.exports = router;