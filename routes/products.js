const express = require('express');
const router = express.Router();
const db = require('../utils/database');
const { requireAuth, requireRole } = require('../middleware/auth');

// Products list page
router.get('/', async (req, res) => {
    try {
        const { category, search, stock } = req.query;
        let query = `
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = TRUE
        `;
        const params = [];

        if (category) {
            query += ' AND p.category_id = ?';
            params.push(category);
        }

        if (search) {
            query += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.brand LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (stock === 'low') {
            query += ' AND p.quantity <= p.min_stock';
        } else if (stock === 'out') {
            query += ' AND p.quantity = 0';
        }

        query += ' ORDER BY p.created_at DESC';

        const [products] = await db.execute(query, params);
        // FIX: Use DISTINCT to prevent duplicate categories
        const [categories] = await db.execute("SELECT MIN(id) as id, name FROM categories WHERE name IS NOT NULL AND name != '' GROUP BY name ORDER BY name");

        res.render('products/list', {
            title: 'Products',
            products,
            categories,
            filters: { category, search, stock },
            user: req.user
        });
    } catch (error) {
        console.error('Products list error:', error);
        req.flash('error', 'Error loading products');
        res.redirect('/');
    }
});

// Barcode Scanner page
router.get('/scan', async (req, res) => {
    try {
        res.render('products/scan', {
            title: 'Barcode Scanner',
            path: '/products/scan',
            user: req.user
        });
    } catch (error) {
        console.error('Barcode scanner page error:', error);
        req.flash('error', 'Error loading scanner');
        res.redirect('/products');
    }
});

// API: Lookup product by barcode
router.get('/lookup-barcode/:barcode', async (req, res) => {
    try {
        const { barcode } = req.params;

        if (!barcode || barcode.trim() === '') {
            return res.json({ success: false, message: 'Barcode is required' });
        }

        const [products] = await db.execute(
            `SELECT p.*, c.name as category_name
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.barcode = ? AND p.is_active = TRUE`,
            [barcode.trim()]
        );

        if (products.length > 0) {
            const product = products[0];
            if (product.specifications) {
                try {
                    product.specifications = JSON.parse(product.specifications);
                } catch (e) {
                    product.specifications = {};
                }
            }
            res.json({ success: true, product });
        } else {
            res.json({ success: false, message: 'Product not found' });
        }
    } catch (error) {
        console.error('Barcode lookup error:', error);
        res.status(500).json({ success: false, message: 'Server error during lookup' });
    }
});

// API: Search products by barcode (POST for AJAX)
router.post('/barcode-search', async (req, res) => {
    try {
        const { barcode } = req.body;

        if (!barcode || barcode.trim() === '') {
            return res.json({ success: false, message: 'Barcode is required' });
        }

        const [products] = await db.execute(
            `SELECT p.id, p.name, p.brand, p.model, p.sku, p.barcode,
                    p.hsn_code, p.selling_price, p.mrp, p.gst_rate,
                    p.quantity, p.min_stock, p.image, c.name as category_name
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.barcode = ? AND p.is_active = TRUE`,
            [barcode.trim()]
        );

        if (products.length > 0) {
            res.json({ success: true, products });
        } else {
            res.json({ success: false, message: 'No product found with this barcode' });
        }
    } catch (error) {
        console.error('Barcode search error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Add product page
router.get('/add', async (req, res) => {
    try {
        const [categories] = await db.execute("SELECT MIN(id) as id, name FROM categories WHERE name IS NOT NULL AND name != '' GROUP BY name ORDER BY name");
        res.render('products/add', {
            title: 'Add Product',
            categories,
            user: req.user
        });
    } catch (error) {
        console.error('Add product page error:', error);
        req.flash('error', 'Error loading add product page');
        res.redirect('/products');
    }
});

// Create product
router.post('/add', async (req, res) => {
    try {
        const {
            name, sku, barcode, brand, model, category_id,
            description, hsn_code, gst_rate, unit,
            purchase_price, selling_price, mrp,
            quantity, min_stock, specifications
        } = req.body;

        const toNull = (val) => (val === undefined || val === '') ? null : val;

        // FIX: Handle specifications - if empty/invalid JSON, store null or '{}'
        const cleanSpecs = (specs) => {
            if (!specs || specs === '' || specs === 'null') return null;
            if (typeof specs === 'string') {
                // Check if it's valid JSON
                try {
                    JSON.parse(specs);
                    return specs;
                } catch (e) {
                    // Not valid JSON, try to stringify if it's an object
                    if (specs.trim() === '' || specs === '[object Object]') return null;
                    return JSON.stringify({ raw: specs });
                }
            }
            if (typeof specs === 'object') {
                return JSON.stringify(specs);
            }
            return null;
        };

        const [result] = await db.execute(
            `INSERT INTO products 
             (name, sku, barcode, brand, model, category_id, description,
              hsn_code, gst_rate, unit, purchase_price, selling_price, mrp,
              quantity, min_stock, specifications, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW(), NOW())`,
            [
                toNull(name), toNull(sku), toNull(barcode), toNull(brand), toNull(model), 
                toNull(category_id), toNull(description),
                toNull(hsn_code), toNull(gst_rate) || 18, toNull(unit) || 'piece',
                toNull(purchase_price), toNull(selling_price), toNull(mrp) || toNull(selling_price),
                toNull(quantity) || 0, toNull(min_stock) || 5, cleanSpecs(specifications)
            ]
        );

        req.flash('success', 'Product added successfully');
        res.redirect('/products');
    } catch (error) {
        console.error('Add product error:', error);
        req.flash('error', 'Error adding product: ' + error.message);
        res.redirect('/products/add');
    }
});

// Edit product page
router.get('/edit/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [products] = await db.execute(
            'SELECT * FROM products WHERE id = ? AND is_active = TRUE',
            [id]
        );

        if (products.length === 0) {
            req.flash('error', 'Product not found');
            return res.redirect('/products');
        }

        const [categories] = await db.execute("SELECT MIN(id) as id, name FROM categories WHERE name IS NOT NULL AND name != '' GROUP BY name ORDER BY name");
        res.render('products/edit', {
            title: 'Edit Product',
            product: products[0],
            categories,
            user: req.user
        });
    } catch (error) {
        console.error('Edit product page error:', error);
        req.flash('error', 'Error loading edit product page');
        res.redirect('/products');
    }
});

// Update product
router.post('/edit/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, sku, barcode, brand, model, category_id,
            description, hsn_code, gst_rate, unit,
            purchase_price, selling_price, mrp,
            quantity, min_stock, specifications
        } = req.body;

        // FIX: Convert undefined to null for MySQL binding
        const toNull = (val) => (val === undefined || val === '') ? null : val;

        // FIX: Handle specifications - if empty/invalid JSON, store null or '{}'
        const cleanSpecs = (specs) => {
            if (!specs || specs === '' || specs === 'null') return null;
            if (typeof specs === 'string') {
                // Check if it's valid JSON
                try {
                    JSON.parse(specs);
                    return specs;
                } catch (e) {
                    // Not valid JSON, try to stringify if it's an object
                    if (specs.trim() === '' || specs === '[object Object]') return null;
                    return JSON.stringify({ raw: specs });
                }
            }
            if (typeof specs === 'object') {
                return JSON.stringify(specs);
            }
            return null;
        };

        await db.execute(
            `UPDATE products SET
             name = ?, sku = ?, barcode = ?, brand = ?, model = ?,
             category_id = ?, description = ?, hsn_code = ?, gst_rate = ?,
             unit = ?, purchase_price = ?, selling_price = ?, mrp = ?,
             quantity = ?, min_stock = ?, specifications = ?, updated_at = NOW()
             WHERE id = ?`,
            [
                toNull(name), toNull(sku), toNull(barcode), toNull(brand), toNull(model), 
                toNull(category_id), toNull(description), toNull(hsn_code), toNull(gst_rate),
                toNull(unit), toNull(purchase_price), toNull(selling_price), toNull(mrp),
                toNull(quantity), toNull(min_stock), cleanSpecs(specifications), id
            ]
        );

        req.flash('success', 'Product updated successfully');
        res.redirect('/products');
    } catch (error) {
        console.error('Update product error:', error);
        req.flash('error', 'Error updating product: ' + error.message);
        res.redirect('/products/edit/' + req.params.id);
    }
});

// Delete product (soft delete)
router.delete('/delete/:id', requireRole(['master_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute(
            'UPDATE products SET is_active = FALSE, updated_at = NOW() WHERE id = ?',
            [id]
        );
        req.flash('success', 'Product deleted successfully');
        res.redirect('/products');
    } catch (error) {
        console.error('Delete product error:', error);
        req.flash('error', 'Error deleting product');
        res.redirect('/products');
    }
});

// Product detail page
router.get('/detail/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [products] = await db.execute(
            `SELECT p.*, c.name as category_name 
             FROM products p 
             LEFT JOIN categories c ON p.category_id = c.id 
             WHERE p.id = ? AND p.is_active = TRUE`,
            [id]
        );

        if (products.length === 0) {
            req.flash('error', 'Product not found');
            return res.redirect('/products');
        }

        let stockHistory = [];
        try {
            const [history] = await db.execute(
                'SELECT * FROM stock_history WHERE product_id = ? ORDER BY created_at DESC LIMIT 10',
                [id]
            );
            stockHistory = history;
        } catch (e) {}

        res.render('products/detail', {
            title: products[0].name,
            product: products[0],
            stockHistory,
            user: req.user
        });
    } catch (error) {
        console.error('Product detail error:', error);
        req.flash('error', 'Error loading product details');
        res.redirect('/products');
    }
});

// Add category (AJAX endpoint for edit/add pages)
router.post('/add-category', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).json({ success: false, message: 'Category name is required' });
        }
        const trimmedName = name.trim();

        const [existing] = await db.execute('SELECT id, name FROM categories WHERE name = ?', [trimmedName]);
        if (existing.length > 0) {
            return res.json({ success: true, message: 'Category already exists', categoryId: existing[0].id, categoryName: existing[0].name });
        }

        const [result] = await db.execute('INSERT INTO categories (name, created_at) VALUES (?, NOW())', [trimmedName]);
        res.json({ success: true, message: 'Category added', categoryId: result.insertId, categoryName: trimmedName });
    } catch (error) {
        console.error('Add category error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
