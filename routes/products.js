const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../utils/database');
const { requireRole } = require('../middleware/auth');

// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/products/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed'));
    }
});

// List all products
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
        const [categories] = await db.execute('SELECT * FROM categories ORDER BY name');

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

// Add product page
router.get('/add', requireRole(['master_admin', 'admin']), async (req, res) => {
    try {
        const [categories] = await db.execute('SELECT * FROM categories ORDER BY name');
        res.render('products/add', { title: 'Add Product', categories, user: req.user });
    } catch (error) {
        req.flash('error', 'Error loading form');
        res.redirect('/products');
    }
});

// Add product process
router.post('/add', requireRole(['master_admin', 'admin']), upload.single('image'), async (req, res) => {
    try {
        const {
            name, description, category_id, brand, model, sku, barcode,
            purchase_price, selling_price, mrp, gst_rate, quantity, min_stock, unit,
            specifications
        } = req.body;

        const image = req.file ? '/uploads/products/' + req.file.filename : null;

        const [result] = await db.execute(
            `INSERT INTO products (name, description, category_id, brand, model, sku, barcode,
             purchase_price, selling_price, mrp, gst_rate, quantity, min_stock, unit, image, specifications)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, description, category_id || null, brand, model, sku, barcode,
             purchase_price, selling_price, mrp || selling_price, gst_rate || 18, quantity || 0, min_stock || 5, unit || 'piece', image, specifications || null]
        );

        // Log stock entry
        if (quantity && quantity > 0) {
            await db.execute(
                `INSERT INTO stock_logs (product_id, type, quantity, previous_stock, new_stock, reason, created_by)
                 VALUES (?, 'in', ?, 0, ?, 'Initial stock', ?)`,
                [result.insertId, quantity, quantity, req.user.id]
            );
        }

        req.flash('success', 'Product added successfully');
        res.redirect('/products');

    } catch (error) {
        console.error('Add product error:', error);
        req.flash('error', 'Error adding product: ' + error.message);
        res.redirect('/products/add');
    }
});

// Edit product page
router.get('/edit/:id', requireRole(['master_admin', 'admin']), async (req, res) => {
    try {
        const [products] = await db.execute('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (products.length === 0) {
            req.flash('error', 'Product not found');
            return res.redirect('/products');
        }

        const [categories] = await db.execute('SELECT * FROM categories ORDER BY name');
        res.render('products/edit', {
            title: 'Edit Product',
            product: products[0],
            categories,
            user: req.user
        });
    } catch (error) {
        req.flash('error', 'Error loading product');
        res.redirect('/products');
    }
});

// Update product
router.put('/edit/:id', requireRole(['master_admin', 'admin']), upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, description, category_id, brand, model, sku, barcode,
            purchase_price, selling_price, mrp, gst_rate, quantity, min_stock, unit,
            specifications, remove_image
        } = req.body;

        // Get current product
        const [products] = await db.execute('SELECT * FROM products WHERE id = ?', [id]);
        if (products.length === 0) {
            req.flash('error', 'Product not found');
            return res.redirect('/products');
        }

        const product = products[0];
        let image = product.image;

        if (req.file) {
            image = '/uploads/products/' + req.file.filename;
        } else if (remove_image === 'on') {
            image = null;
        }

        const oldQuantity = product.quantity;
        const newQuantity = parseInt(quantity) || 0;

        await db.execute(
            `UPDATE products SET 
             name = ?, description = ?, category_id = ?, brand = ?, model = ?, sku = ?, barcode = ?,
             purchase_price = ?, selling_price = ?, mrp = ?, gst_rate = ?, quantity = ?, min_stock = ?, unit = ?, image = ?, specifications = ?
             WHERE id = ?`,
            [name, description, category_id || null, brand, model, sku, barcode,
             purchase_price, selling_price, mrp || selling_price, gst_rate || 18, newQuantity, min_stock || 5, unit || 'piece', image, specifications || null, id]
        );

        // Log stock change if quantity changed
        if (oldQuantity !== newQuantity) {
            const diff = newQuantity - oldQuantity;
            await db.execute(
                `INSERT INTO stock_logs (product_id, type, quantity, previous_stock, new_stock, reason, created_by)
                 VALUES (?, ?, ?, ?, ?, 'Stock adjustment', ?)`,
                [id, diff > 0 ? 'in' : 'out', Math.abs(diff), oldQuantity, newQuantity, req.user.id]
            );
        }

        req.flash('success', 'Product updated successfully');
        res.redirect('/products');

    } catch (error) {
        console.error('Update product error:', error);
        req.flash('error', 'Error updating product');
        res.redirect('/products');
    }
});

// Delete product (soft delete)
router.delete('/delete/:id', requireRole(['master_admin']), async (req, res) => {
    try {
        await db.execute('UPDATE products SET is_active = FALSE WHERE id = ?', [req.params.id]);
        req.flash('success', 'Product deleted successfully');
        res.redirect('/products');
    } catch (error) {
        req.flash('error', 'Error deleting product');
        res.redirect('/products');
    }
});

// Product detail
router.get('/detail/:id', async (req, res) => {
    try {
        const [products] = await db.execute(`
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.id = ?
        `, [req.params.id]);

        if (products.length === 0) {
            req.flash('error', 'Product not found');
            return res.redirect('/products');
        }

        // Get stock history
        const [stockLogs] = await db.execute(`
            SELECT sl.*, u.full_name as created_by_name 
            FROM stock_logs sl 
            LEFT JOIN users u ON sl.created_by = u.id 
            WHERE sl.product_id = ? 
            ORDER BY sl.created_at DESC LIMIT 20
        `, [req.params.id]);

        res.render('products/detail', {
            title: products[0].name,
            product: products[0],
            stockLogs,
            user: req.user
        });
    } catch (error) {
        req.flash('error', 'Error loading product details');
        res.redirect('/products');
    }
});

// Get product for AJAX (used in sales)
router.get('/api/:id', async (req, res) => {
    try {
        const [products] = await db.execute(
            'SELECT id, name, selling_price, mrp, gst_rate, quantity FROM products WHERE id = ? AND is_active = TRUE',
            [req.params.id]
        );

        if (products.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json(products[0]);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
