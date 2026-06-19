const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const flash = require('connect-flash');
const path = require('path');
const dotenv = require('dotenv');
const methodOverride = require('method-override');
const cron = require('node-cron');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const helmet = require('helmet');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Security: Validate required environment variables
if (isProduction) {
    if (!process.env.SESSION_SECRET) {
        console.error('❌ FATAL: SESSION_SECRET must be set in production');
        process.exit(1);
    }
    if (!process.env.DB_PASSWORD) {
        console.error('❌ FATAL: DB_PASSWORD must be set in production');
        process.exit(1);
    }
}

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

// Security middleware - FIXED CSP to allow unpkg and inline event handlers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://unpkg.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            connectSrc: ["'self'"]
        }
    }
}));

// Rate limiting for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false
});

// General rate limiting
const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
});

app.use(generalLimiter);

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

// Serve html5-qrcode from node_modules for barcode scanner
app.use('/js/html5-qrcode', express.static(path.join(__dirname, 'node_modules', 'html5-qrcode')));

// Trust proxy (Railway runs behind proxy)
if (isProduction) {
    app.set('trust proxy', 1);
}

// Session with secure cookie for production
app.use(session({
    key: 'electronics_store_session',
    secret: process.env.SESSION_SECRET || 'development_secret_change_in_production',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProduction,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: isProduction ? 'none' : 'lax'
    }
}));

// Flash MUST be before CSRF so error handler can use req.flash
app.use(flash());

// CSRF protection using session (no cookie-parser needed)
const csrfProtection = csrf({ cookie: false });
app.use(csrfProtection);

app.use(setUser);

// Make CSRF token available to all views
app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    res.locals.user = req.session.user || null;
    res.locals.success_msg = req.flash('success');
    res.locals.error_msg = req.flash('error');
    res.locals.path = req.path;
    next();
});

// Request logging (only in development)
if (!isProduction) {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
    });
}

// Routes
app.use('/', indexRoutes);
app.use('/auth', authLimiter, authRoutes);
app.use('/products', requireAuth, productRoutes);
app.use('/sales', requireAuth, saleRoutes);
app.use('/reports', requireAuth, reportRoutes);
app.use('/users', requireAuth, requireRole(['master_admin', 'admin']), userRoutes);
app.use('/backups', requireAuth, requireRole(['master_admin']), backupRoutes);

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: isProduction ? 'production' : 'development'
    });
});

app.use((req, res) => {
    res.status(404).render('404', { title: 'Page Not Found' });
});

app.use((err, req, res, next) => {
    console.error('ERROR:', err.stack);
    if (err.code === 'EBADCSRFTOKEN') {
        if (typeof req.flash === 'function') {
            req.flash('error', 'Invalid form submission. Please try again.');
        }
        const redirectUrl = req.headers.referer || '/login';
        return res.redirect(redirectUrl + '?csrf_error=1');
    }
    res.status(500).render('error', {
        title: 'Error',
        message: isProduction ? 'Something went wrong!' : err.message
    });
});

app.listen(PORT, async () => {
    console.log(`\n╔══════════════════════════════════════════════════════════╗`);
    console.log(`║  ELECTRONICS STORE ERP - INDIA EDITION v2.0              ║`);
    console.log(`║  Server running on port ${PORT}                            ║`);
    console.log(`║  Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}                          ║`);
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
