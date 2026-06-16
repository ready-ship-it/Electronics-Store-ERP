const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const flash = require('connect-flash');
const path = require('path');
const dotenv = require('dotenv');
const methodOverride = require('method-override');
const cron = require('node-cron');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

const db = require('./utils/database');

const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const saleRoutes = require('./routes/sales');
const reportRoutes = require('./routes/reports');
const userRoutes = require('./routes/users');
const backupRoutes = require('./routes/backups');

const { setUser, requireAuth, requireRole } = require('./middleware/auth');
const backupService = require('./utils/backup');

// Session store (MySQL)
const sessionStoreOptions = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'electronics_store',
    createDatabaseTable: true
};

const sessionStore = new MySQLStore(sessionStoreOptions);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Trust proxy (Railway runs behind proxy)
if (isProduction) {
    app.set('trust proxy', 1);
}

// Session with proper cookie for production
app.use(session({
    key: 'electronics_store_session',
    secret: process.env.SESSION_SECRET || 'electronics_store_secret_2024_change_this',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProduction,      // true in production (HTTPS)
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: isProduction ? 'none' : 'lax',  // 'none' for cross-site in production
        domain: undefined           // let browser set automatically
    }
}));

app.use(flash());
app.use(setUser);

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.success_msg = req.flash('success');
    res.locals.error_msg = req.flash('error');
    res.locals.path = req.path;
    next();
});

// Debug middleware - log all requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} | Session: ${req.sessionID ? 'YES' : 'NO'} | User: ${req.session?.userId || 'none'}`);
    next();
});

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/products', requireAuth, productRoutes);
app.use('/sales', requireAuth, saleRoutes);
app.use('/reports', requireAuth, reportRoutes);
app.use('/users', requireAuth, requireRole(['master_admin', 'admin']), userRoutes);
app.use('/backups', requireAuth, requireRole(['master_admin']), backupRoutes);

app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        session: req.sessionID ? 'active' : 'none'
    });
});

app.use((req, res) => {
    res.status(404).render('404', { title: 'Page Not Found' });
});

app.use((err, req, res, next) => {
    console.error('ERROR:', err.stack);
    res.status(500).render('error', { 
        title: 'Error', 
        message: isProduction ? 'Something went wrong!' : err.message 
    });
});

app.listen(PORT, async () => {
    console.log(`\n╔══════════════════════════════════════════════════════════╗`);
    console.log(`║     ELECTRONICS STORE ERP - INDIA EDITION              ║`);
    console.log(`║     Server running on port ${PORT}                        ║`);
    console.log(`║     Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}                    ║`);
    console.log(`╚══════════════════════════════════════════════════════════╝\n`);

    try {
        const [result] = await db.execute('SELECT 1');
        console.log('✅ Database connected successfully');
        await require('./database/init')();
        console.log('✅ Database initialized');

        cron.schedule('0 */2 * * *', async () => {
            console.log('\n🔄 Running scheduled backup...');
            try {
                await backupService.createBackup();
                console.log('✅ Scheduled backup completed\n');
            } catch (error) {
                console.error('❌ Scheduled backup failed:', error.message);
            }
        });

        cron.schedule('0 * * * *', async () => {
            console.log('\n🧹 Running backup cleanup...');
            try {
                await backupService.cleanupOldBackups(5);
                console.log('✅ Backup cleanup completed\n');
            } catch (error) {
                console.error('❌ Backup cleanup failed:', error.message);
            }
        });

        console.log('✅ Auto-backup scheduled (every 2 hours)');
        console.log('✅ Backup cleanup scheduled (every 1 hour, keep last 5)');
        console.log('\n🚀 Application ready!');

    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
    }
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...');
    sessionStore.close();
    await db.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('\n🛑 SIGINT received, shutting down gracefully...');
    sessionStore.close();
    await db.end();
    process.exit(0);
});

module.exports = app;
