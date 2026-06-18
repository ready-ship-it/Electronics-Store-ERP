
// ========== BARCODE SCANNER ROUTES ==========

// GET /products/scan - Barcode scanner page
router.get('/scan', async (req, res) => {
    try {
        res.render('products/scan', {
            title: 'Barcode Scanner',
            path: '/products/scan'
        });
    } catch (error) {
        console.error('Barcode scanner page error:', error);
        req.flash('error', 'Error loading scanner');
        res.redirect('/products');
    }
});

// GET /products/lookup-barcode/:barcode - API to lookup product by barcode
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
            // Parse specifications JSON if present
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

// POST /products/barcode-search - Search products by barcode (for AJAX)
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
