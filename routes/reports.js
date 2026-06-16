const express = require('express');
const router = express.Router();
const db = require('../utils/database');
const pdfService = require('../utils/pdf');

// Reports dashboard
router.get('/', async (req, res) => {
    try {
        // Daily sales (last 30 days)
        const [dailySales] = await db.execute(`
            SELECT DATE(created_at) as date, COUNT(*) as invoices, SUM(total_amount) as revenue
            FROM sales WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY DATE(created_at) ORDER BY date DESC
        `);

        // Monthly sales (last 12 months)
        const [monthlySales] = await db.execute(`
            SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as invoices, SUM(total_amount) as revenue
            FROM sales WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
            GROUP BY DATE_FORMAT(created_at, '%Y-%m') ORDER BY month DESC
        `);

        // Yearly sales
        const [yearlySales] = await db.execute(`
            SELECT YEAR(created_at) as year, COUNT(*) as invoices, SUM(total_amount) as revenue
            FROM sales GROUP BY YEAR(created_at) ORDER BY year DESC
        `);

        // Top selling products
        const [topProducts] = await db.execute(`
            SELECT p.name, p.brand, SUM(si.quantity) as total_sold, SUM(si.total_price) as total_revenue
            FROM sale_items si JOIN products p ON si.product_id = p.id
            GROUP BY si.product_id ORDER BY total_sold DESC LIMIT 10
        `);

        // Category-wise sales
        const [categorySales] = await db.execute(`
            SELECT c.name, COUNT(DISTINCT s.id) as sales_count, SUM(si.total_price) as revenue
            FROM sales s JOIN sale_items si ON s.id = si.sale_id
            JOIN products p ON si.product_id = p.id
            LEFT JOIN categories c ON p.category_id = c.id
            GROUP BY c.id ORDER BY revenue DESC
        `);

        res.render('reports/dashboard', {
            title: 'Reports & Analytics',
            dailySales,
            monthlySales,
            yearlySales,
            topProducts,
            categorySales,
            user: req.user
        });
    } catch (error) {
        console.error('Reports error:', error);
        req.flash('error', 'Error loading reports');
        res.redirect('/');
    }
});

// Daily sales report
router.get('/daily', async (req, res) => {
    try {
        const { date } = req.query;
        const reportDate = date || new Date().toISOString().split('T')[0];

        const [sales] = await db.execute(`
            SELECT s.*, u.full_name as created_by_name 
            FROM sales s LEFT JOIN users u ON s.created_by = u.id
            WHERE DATE(s.created_at) = ? ORDER BY s.created_at DESC
        `, [reportDate]);

        const [[summary]] = await db.execute(`
            SELECT COUNT(*) as total_invoices, SUM(total_amount) as total_revenue,
                   SUM(subtotal) as total_subtotal, SUM(gst_amount) as total_gst
            FROM sales WHERE DATE(created_at) = ?
        `, [reportDate]);

        res.render('reports/daily', {
            title: `Daily Report - ${reportDate}`,
            sales,
            summary,
            reportDate,
            user: req.user
        });
    } catch (error) {
        req.flash('error', 'Error loading daily report');
        res.redirect('/reports');
    }
});

// Daily report PDF
router.get('/daily/pdf', async (req, res) => {
    try {
        const { date } = req.query;
        const reportDate = date || new Date().toISOString().split('T')[0];

        const [sales] = await db.execute(`
            SELECT s.*, u.full_name as created_by_name 
            FROM sales s LEFT JOIN users u ON s.created_by = u.id
            WHERE DATE(s.created_at) = ? ORDER BY s.created_at DESC
        `, [reportDate]);

        const [[summary]] = await db.execute(`
            SELECT COUNT(*) as total_invoices, SUM(total_amount) as total_revenue
            FROM sales WHERE DATE(created_at) = ?
        `, [reportDate]);

        const headers = ['Invoice #', 'Customer', 'Subtotal', 'GST', 'Discount', 'Total', 'Payment', 'Time'];
        const rows = sales.map(s => [
            s.invoice_number,
            s.customer_name,
            `₹${parseFloat(s.subtotal).toFixed(2)}`,
            `₹${parseFloat(s.gst_amount).toFixed(2)}`,
            `₹${parseFloat(s.discount).toFixed(2)}`,
            `₹${parseFloat(s.total_amount).toFixed(2)}`,
            s.payment_method.toUpperCase(),
            new Date(s.created_at).toLocaleTimeString('en-IN')
        ]);

        const pdfBuffer = await pdfService.generateReportPDF({
            headers,
            rows,
            summary: [
                { label: 'Total Invoices', value: summary.total_invoices || 0 },
                { label: 'Total Revenue', value: `₹${(summary.total_revenue || 0).toFixed(2)}` }
            ],
            dateRange: `Date: ${new Date(reportDate).toLocaleDateString('en-IN')}`
        }, 'Daily Sales Report');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="daily_report_${reportDate}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Daily PDF error:', error);
        res.status(500).send('Error generating PDF');
    }
});

// Monthly sales report
router.get('/monthly', async (req, res) => {
    try {
        const { month, year } = req.query;
        const reportYear = year || new Date().getFullYear();
        const reportMonth = month || new Date().getMonth() + 1;

        const [sales] = await db.execute(`
            SELECT s.*, u.full_name as created_by_name 
            FROM sales s LEFT JOIN users u ON s.created_by = u.id
            WHERE YEAR(s.created_at) = ? AND MONTH(s.created_at) = ?
            ORDER BY s.created_at DESC
        `, [reportYear, reportMonth]);

        const [[summary]] = await db.execute(`
            SELECT COUNT(*) as total_invoices, SUM(total_amount) as total_revenue,
                   SUM(subtotal) as total_subtotal, SUM(gst_amount) as total_gst, SUM(discount) as total_discount
            FROM sales WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?
        `, [reportYear, reportMonth]);

        // Daily breakdown
        const [dailyBreakdown] = await db.execute(`
            SELECT DATE(created_at) as date, COUNT(*) as invoices, SUM(total_amount) as revenue
            FROM sales WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?
            GROUP BY DATE(created_at) ORDER BY date
        `, [reportYear, reportMonth]);

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        res.render('reports/monthly', {
            title: `Monthly Report - ${monthNames[reportMonth - 1]} ${reportYear}`,
            sales,
            summary,
            dailyBreakdown,
            reportMonth,
            reportYear,
            monthNames,
            user: req.user
        });
    } catch (error) {
        req.flash('error', 'Error loading monthly report');
        res.redirect('/reports');
    }
});

// Monthly report PDF
router.get('/monthly/pdf', async (req, res) => {
    try {
        const { month, year } = req.query;
        const reportYear = year || new Date().getFullYear();
        const reportMonth = month || new Date().getMonth() + 1;

        const [sales] = await db.execute(`
            SELECT s.* FROM sales s
            WHERE YEAR(s.created_at) = ? AND MONTH(s.created_at) = ?
            ORDER BY s.created_at DESC
        `, [reportYear, reportMonth]);

        const [[summary]] = await db.execute(`
            SELECT COUNT(*) as total_invoices, SUM(total_amount) as total_revenue
            FROM sales WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?
        `, [reportYear, reportMonth]);

        const headers = ['Invoice #', 'Customer', 'Subtotal', 'GST', 'Discount', 'Total', 'Date'];
        const rows = sales.map(s => [
            s.invoice_number,
            s.customer_name,
            `₹${parseFloat(s.subtotal).toFixed(2)}`,
            `₹${parseFloat(s.gst_amount).toFixed(2)}`,
            `₹${parseFloat(s.discount).toFixed(2)}`,
            `₹${parseFloat(s.total_amount).toFixed(2)}`,
            new Date(s.created_at).toLocaleDateString('en-IN')
        ]);

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        const pdfBuffer = await pdfService.generateReportPDF({
            headers,
            rows,
            summary: [
                { label: 'Total Invoices', value: summary.total_invoices || 0 },
                { label: 'Total Revenue', value: `₹${(summary.total_revenue || 0).toFixed(2)}` }
            ],
            dateRange: `Month: ${monthNames[reportMonth - 1]} ${reportYear}`
        }, 'Monthly Sales Report');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="monthly_report_${reportYear}_${reportMonth}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Monthly PDF error:', error);
        res.status(500).send('Error generating PDF');
    }
});

// Yearly sales report
router.get('/yearly', async (req, res) => {
    try {
        const { year } = req.query;
        const reportYear = year || new Date().getFullYear();

        const [sales] = await db.execute(`
            SELECT s.*, u.full_name as created_by_name 
            FROM sales s LEFT JOIN users u ON s.created_by = u.id
            WHERE YEAR(s.created_at) = ? ORDER BY s.created_at DESC
        `, [reportYear]);

        const [[summary]] = await db.execute(`
            SELECT COUNT(*) as total_invoices, SUM(total_amount) as total_revenue,
                   SUM(subtotal) as total_subtotal, SUM(gst_amount) as total_gst, SUM(discount) as total_discount
            FROM sales WHERE YEAR(created_at) = ?
        `, [reportYear]);

        // Monthly breakdown
        const [monthlyBreakdown] = await db.execute(`
            SELECT MONTH(created_at) as month, COUNT(*) as invoices, SUM(total_amount) as revenue
            FROM sales WHERE YEAR(created_at) = ?
            GROUP BY MONTH(created_at) ORDER BY month
        `, [reportYear]);

        res.render('reports/yearly', {
            title: `Yearly Report - ${reportYear}`,
            sales,
            summary,
            monthlyBreakdown,
            reportYear,
            user: req.user
        });
    } catch (error) {
        req.flash('error', 'Error loading yearly report');
        res.redirect('/reports');
    }
});

// Yearly report PDF
router.get('/yearly/pdf', async (req, res) => {
    try {
        const { year } = req.query;
        const reportYear = year || new Date().getFullYear();

        const [sales] = await db.execute(`
            SELECT s.* FROM sales s WHERE YEAR(s.created_at) = ? ORDER BY s.created_at DESC
        `, [reportYear]);

        const [[summary]] = await db.execute(`
            SELECT COUNT(*) as total_invoices, SUM(total_amount) as total_revenue
            FROM sales WHERE YEAR(created_at) = ?
        `, [reportYear]);

        const headers = ['Invoice #', 'Customer', 'Subtotal', 'GST', 'Discount', 'Total', 'Date'];
        const rows = sales.map(s => [
            s.invoice_number,
            s.customer_name,
            `₹${parseFloat(s.subtotal).toFixed(2)}`,
            `₹${parseFloat(s.gst_amount).toFixed(2)}`,
            `₹${parseFloat(s.discount).toFixed(2)}`,
            `₹${parseFloat(s.total_amount).toFixed(2)}`,
            new Date(s.created_at).toLocaleDateString('en-IN')
        ]);

        const pdfBuffer = await pdfService.generateReportPDF({
            headers,
            rows,
            summary: [
                { label: 'Total Invoices', value: summary.total_invoices || 0 },
                { label: 'Total Revenue', value: `₹${(summary.total_revenue || 0).toFixed(2)}` }
            ],
            dateRange: `Year: ${reportYear}`
        }, 'Yearly Sales Report');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="yearly_report_${reportYear}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Yearly PDF error:', error);
        res.status(500).send('Error generating PDF');
    }
});

module.exports = router;
