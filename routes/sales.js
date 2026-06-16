const express = require('express');
const router = express.Router();
const db = require('../utils/database');
const pdfService = require('../utils/pdf');

// List all sales
router.get('/', async (req, res) => {
    try {
        const { start_date, end_date, customer } = req.query;
        let query = `
            SELECT s.*, u.full_name as created_by_name 
            FROM sales s 
            LEFT JOIN users u ON s.created_by = u.id 
            WHERE 1=1
        `;
        const params = [];

        if (start_date) {
            query += ' AND DATE(s.created_at) >= ?';
            params.push(start_date);
        }
        if (end_date) {
            query += ' AND DATE(s.created_at) <= ?';
            params.push(end_date);
        }
        if (customer) {
            query += ' AND s.customer_name LIKE ?';
            params.push(`%${customer}%`);
        }

        query += ' ORDER BY s.created_at DESC';

        const [sales] = await db.execute(query, params);

        res.render('sales/list', {
            title: 'Sales',
            sales,
            filters: { start_date, end_date, customer },
            user: req.user
        });
    } catch (error) {
        console.error('Sales list error:', error);
        req.flash('error', 'Error loading sales');
        res.redirect('/');
    }
});

// New sale page
router.get('/new', async (req, res) => {
    try {
        const [products] = await db.execute(
            'SELECT id, name, selling_price, mrp, gst_rate, quantity FROM products WHERE is_active = TRUE AND quantity > 0 ORDER BY name'
        );

        // Generate invoice number
        const date = new Date();
        const invoicePrefix = `INV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
        const [[lastInvoice]] = await db.execute(
            "SELECT invoice_number FROM sales WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1",
            [`${invoicePrefix}%`]
        );

        let invoiceNumber;
        if (lastInvoice) {
            const lastNum = parseInt(lastInvoice.invoice_number.split('-').pop()) || 0;
            invoiceNumber = `${invoicePrefix}-${String(lastNum + 1).padStart(4, '0')}`;
        } else {
            invoiceNumber = `${invoicePrefix}-0001`;
        }

        res.render('sales/new', {
            title: 'New Sale',
            products,
            invoiceNumber,
            user: req.user
        });
    } catch (error) {
        console.error('New sale error:', error);
        req.flash('error', 'Error loading sale form');
        res.redirect('/sales');
    }
});

// Create sale
router.post('/new', async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const {
            invoice_number, customer_name, customer_phone, customer_email, customer_address,
            payment_method, payment_status, notes, discount,
            product_ids, quantities, unit_prices, gst_rates
        } = req.body;

        // Calculate totals
        let subtotal = 0;
        let totalGst = 0;
        const saleItems = [];

        for (let i = 0; i < product_ids.length; i++) {
            const productId = product_ids[i];
            const qty = parseInt(quantities[i]) || 0;
            const price = parseFloat(unit_prices[i]) || 0;
            const gst = parseFloat(gst_rates[i]) || 18;

            if (qty > 0) {
                const itemSubtotal = qty * price;
                const itemGst = itemSubtotal * (gst / 100);
                const itemTotal = itemSubtotal + itemGst;

                subtotal += itemSubtotal;
                totalGst += itemGst;

                saleItems.push({
                    product_id: productId,
                    quantity: qty,
                    unit_price: price,
                    gst_rate: gst,
                    gst_amount: itemGst,
                    total_price: itemTotal
                });
            }
        }

        const discountAmount = parseFloat(discount) || 0;
        const totalAmount = subtotal + totalGst - discountAmount;

        // Insert sale
        const [saleResult] = await connection.execute(
            `INSERT INTO sales (invoice_number, customer_name, customer_phone, customer_email, customer_address,
             subtotal, gst_amount, discount, total_amount, payment_method, payment_status, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [invoice_number, customer_name, customer_phone || null, customer_email || null, customer_address || null,
             subtotal, totalGst, discountAmount, totalAmount, payment_method || 'cash', payment_status || 'paid', notes || null, req.user.id]
        );

        const saleId = saleResult.insertId;

        // Insert sale items and update stock
        for (const item of saleItems) {
            await connection.execute(
                `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, gst_rate, gst_amount, total_price)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [saleId, item.product_id, item.quantity, item.unit_price, item.gst_rate, item.gst_amount, item.total_price]
            );

            // Update product stock
            await connection.execute(
                'UPDATE products SET quantity = quantity - ? WHERE id = ?',
                [item.quantity, item.product_id]
            );

            // Log stock out
            const [[product]] = await connection.execute(
                'SELECT quantity FROM products WHERE id = ?', [item.product_id]
            );

            await connection.execute(
                `INSERT INTO stock_logs (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, reference_type, created_by)
                 VALUES (?, 'out', ?, ?, ?, 'Sale', ?, 'sale', ?)`,
                [item.product_id, item.quantity, product.quantity + item.quantity, product.quantity, saleId, req.user.id]
            );
        }

        await connection.commit();

        req.flash('success', `Sale created successfully! Invoice: ${invoice_number}`);
        res.redirect(`/sales/invoice/${saleId}`);

    } catch (error) {
        await connection.rollback();
        console.error('Create sale error:', error);
        req.flash('error', 'Error creating sale: ' + error.message);
        res.redirect('/sales/new');
    } finally {
        connection.release();
    }
});

// View invoice
router.get('/invoice/:id', async (req, res) => {
    try {
        const [sales] = await db.execute(`
            SELECT s.*, u.full_name as created_by_name 
            FROM sales s 
            LEFT JOIN users u ON s.created_by = u.id 
            WHERE s.id = ?
        `, [req.params.id]);

        if (sales.length === 0) {
            req.flash('error', 'Sale not found');
            return res.redirect('/sales');
        }

        const [items] = await db.execute(`
            SELECT si.*, p.name as product_name, p.sku 
            FROM sale_items si 
            JOIN products p ON si.product_id = p.id 
            WHERE si.sale_id = ?
        `, [req.params.id]);

        // Get settings
        const [settings] = await db.execute('SELECT key_name, value FROM settings');
        const settingsMap = {};
        settings.forEach(s => settingsMap[s.key_name] = s.value);

        res.render('sales/invoice', {
            title: `Invoice ${sales[0].invoice_number}`,
            sale: sales[0],
            items,
            settings: settingsMap,
            user: req.user
        });
    } catch (error) {
        req.flash('error', 'Error loading invoice');
        res.redirect('/sales');
    }
});

// Download invoice PDF
router.get('/invoice/:id/pdf', async (req, res) => {
    try {
        const [sales] = await db.execute(`
            SELECT s.*, u.full_name as created_by_name 
            FROM sales s 
            LEFT JOIN users u ON s.created_by = u.id 
            WHERE s.id = ?
        `, [req.params.id]);

        if (sales.length === 0) {
            return res.status(404).send('Sale not found');
        }

        const [items] = await db.execute(`
            SELECT si.*, p.name as product_name, p.sku 
            FROM sale_items si 
            JOIN products p ON si.product_id = p.id 
            WHERE si.sale_id = ?
        `, [req.params.id]);

        const [settings] = await db.execute('SELECT key_name, value FROM settings');
        const settingsMap = {};
        settings.forEach(s => settingsMap[s.key_name] = s.value);

        const pdfBuffer = await pdfService.generateInvoicePDF({
            sale: sales[0],
            items,
            settings: settingsMap
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="invoice_${sales[0].invoice_number}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('PDF generation error:', error);
        res.status(500).send('Error generating PDF');
    }
});

// Delete sale
router.delete('/delete/:id', async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Get sale items to restore stock
        const [items] = await connection.execute(
            'SELECT * FROM sale_items WHERE sale_id = ?',
            [req.params.id]
        );

        // Restore stock
        for (const item of items) {
            await connection.execute(
                'UPDATE products SET quantity = quantity + ? WHERE id = ?',
                [item.quantity, item.product_id]
            );
        }

        // Delete sale (cascade will delete items)
        await connection.execute('DELETE FROM sales WHERE id = ?', [req.params.id]);

        await connection.commit();

        req.flash('success', 'Sale deleted and stock restored');
        res.redirect('/sales');

    } catch (error) {
        await connection.rollback();
        req.flash('error', 'Error deleting sale');
        res.redirect('/sales');
    } finally {
        connection.release();
    }
});

module.exports = router;
