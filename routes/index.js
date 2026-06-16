const express = require('express');
const router = express.Router();
const db = require('../utils/database');
const { requireAuth } = require('../middleware/auth');

// Dashboard
router.get('/', requireAuth, async (req, res) => {
    try {
        // Get dashboard stats
        const [[todaySales]] = await db.execute(`
            SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as amount 
            FROM sales WHERE DATE(created_at) = CURDATE()
        `);

        const [[monthSales]] = await db.execute(`
            SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as amount 
            FROM sales WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())
        `);

        const [[yearSales]] = await db.execute(`
            SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as amount 
            FROM sales WHERE YEAR(created_at) = YEAR(CURDATE())
        `);

        const [[totalProducts]] = await db.execute('SELECT COUNT(*) as count FROM products WHERE is_active = TRUE');
        const [[lowStock]] = await db.execute('SELECT COUNT(*) as count FROM products WHERE quantity <= min_stock AND is_active = TRUE');
        const [[totalCustomers]] = await db.execute('SELECT COUNT(DISTINCT customer_phone) as count FROM sales WHERE customer_phone IS NOT NULL');

        // Recent sales
        const [recentSales] = await db.execute(`
            SELECT s.*, u.full_name as created_by_name 
            FROM sales s 
            LEFT JOIN users u ON s.created_by = u.id 
            ORDER BY s.created_at DESC LIMIT 10
        `);

        // Low stock products
        const [lowStockProducts] = await db.execute(`
            SELECT * FROM products WHERE quantity <= min_stock AND is_active = TRUE ORDER BY quantity ASC LIMIT 5
        `);

        // Sales chart data (last 7 days)
        const [chartData] = await db.execute(`
            SELECT DATE(created_at) as date, COUNT(*) as sales, SUM(total_amount) as revenue
            FROM sales 
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date
        `);

        res.render('dashboard', {
            title: 'Dashboard',
            stats: {
                todaySales,
                monthSales,
                yearSales,
                totalProducts: totalProducts.count,
                lowStock: lowStock.count,
                totalCustomers: totalCustomers.count
            },
            recentSales,
            lowStockProducts,
            chartData,
            user: req.user
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        req.flash('error', 'Error loading dashboard');
        res.render('dashboard', { title: 'Dashboard', stats: {}, recentSales: [], lowStockProducts: [], chartData: [] });
    }
});

module.exports = router;
