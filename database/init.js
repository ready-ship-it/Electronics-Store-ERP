const db = require('../utils/database');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
    try {
        // Create users table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                full_name VARCHAR(100) NOT NULL,
                role ENUM('master_admin', 'admin', 'user') DEFAULT 'user',
                phone VARCHAR(20),
                address TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Create categories table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                icon VARCHAR(50) DEFAULT 'box',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create products table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                category_id INT,
                brand VARCHAR(100),
                model VARCHAR(100),
                sku VARCHAR(100) UNIQUE,
                barcode VARCHAR(100) UNIQUE,
                purchase_price DECIMAL(12, 2) NOT NULL,
                selling_price DECIMAL(12, 2) NOT NULL,
                mrp DECIMAL(12, 2),
                gst_rate DECIMAL(5, 2) DEFAULT 18.00,
                quantity INT DEFAULT 0,
                min_stock INT DEFAULT 5,
                unit VARCHAR(20) DEFAULT 'piece',
                image VARCHAR(255),
                specifications JSON,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
            )
        `);

        // Create sales table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS sales (
                id INT AUTO_INCREMENT PRIMARY KEY,
                invoice_number VARCHAR(50) UNIQUE NOT NULL,
                customer_name VARCHAR(100) NOT NULL,
                customer_phone VARCHAR(20),
                customer_email VARCHAR(100),
                customer_address TEXT,
                subtotal DECIMAL(12, 2) NOT NULL,
                gst_amount DECIMAL(12, 2) NOT NULL,
                discount DECIMAL(12, 2) DEFAULT 0,
                total_amount DECIMAL(12, 2) NOT NULL,
                payment_method ENUM('cash', 'card', 'upi', 'credit') DEFAULT 'cash',
                payment_status ENUM('paid', 'pending', 'partial') DEFAULT 'paid',
                notes TEXT,
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            )
        `);

        // Create sale_items table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS sale_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sale_id INT NOT NULL,
                product_id INT NOT NULL,
                quantity INT NOT NULL,
                unit_price DECIMAL(12, 2) NOT NULL,
                gst_rate DECIMAL(5, 2) DEFAULT 18.00,
                gst_amount DECIMAL(12, 2) NOT NULL,
                total_price DECIMAL(12, 2) NOT NULL,
                FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
            )
        `);

        // Create stock_logs table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS stock_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                type ENUM('in', 'out', 'adjustment') NOT NULL,
                quantity INT NOT NULL,
                previous_stock INT NOT NULL,
                new_stock INT NOT NULL,
                reason VARCHAR(255),
                reference_id INT,
                reference_type VARCHAR(50),
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            )
        `);

        // Create settings table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                key_name VARCHAR(100) UNIQUE NOT NULL,
                value TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Insert default categories
        const categories = [
            ['Television', 'LED, OLED, Smart TVs', 'tv'],
            ['Refrigerator', 'Single Door, Double Door, Side-by-Side', 'snowflake'],
            ['Washing Machine', 'Front Load, Top Load, Semi-Automatic', 'droplet'],
            ['Air Conditioner', 'Split, Window, Inverter AC', 'wind'],
            ['Microwave Oven', 'Solo, Grill, Convection', 'fire'],
            ['Water Purifier', 'RO, UV, UF, Alkaline', 'droplet'],
            ['Fan', 'Ceiling, Table, Exhaust, Pedestal', 'fan'],
            ['Mixer Grinder', 'Mixer, Grinder, Juicer', 'blender'],
            ['Iron', 'Dry, Steam, Garment Steamer', 'shirt'],
            ['Heater', 'Room Heater, Immersion Rod', 'fire'],
            ['Induction Cooktop', 'Induction, Electric Stove', 'fire-alt'],
            ['Vacuum Cleaner', 'Dry, Wet & Dry, Robotic', 'broom'],
            ['Geyser', 'Instant, Storage, Gas', 'shower'],
            ['Inverter & Battery', 'Home Inverter, Solar Inverter', 'battery-full'],
            ['LED Bulb & Tube', 'LED Bulbs, Tubelights, Panels', 'lightbulb']
        ];

        for (const cat of categories) {
            try {
                await db.execute(
                    'INSERT IGNORE INTO categories (name, description, icon) VALUES (?, ?, ?)',
                    cat
                );
            } catch (e) {
                // Ignore duplicate errors
            }
        }

        // Check if master admin exists, if not create it
        const [existingUsers] = await db.execute('SELECT id FROM users WHERE username = ?', ['masteradmin']);

        if (existingUsers.length === 0) {
            console.log('Creating default master admin user...');
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await db.execute(
                `INSERT INTO users (username, email, password, full_name, role, is_active) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                ['masteradmin', 'admin@electronicsstore.com', hashedPassword, 'Master Administrator', 'master_admin', true]
            );
            console.log('✅ Default master admin created: masteradmin / admin123');
        } else {
            console.log('✅ Master admin already exists');
        }

        // Insert default settings
        const settings = [
            ['store_name', 'Electronics Store'],
            ['store_address', '123 Main Street, Mumbai, Maharashtra - 400001'],
            ['store_phone', '+91 98765 43210'],
            ['store_email', 'info@electronicsstore.com'],
            ['store_gstin', '27AABCU9603R1ZX'],
            ['store_pan', 'AABCU9603R'],
            ['currency', 'INR'],
            ['currency_symbol', '₹'],
            ['date_format', 'DD/MM/YYYY'],
            ['low_stock_alert', '5']
        ];

        for (const setting of settings) {
            try {
                await db.execute(
                    'INSERT IGNORE INTO settings (key_name, value) VALUES (?, ?)',
                    setting
                );
            } catch (e) {
                // Ignore duplicate errors
            }
        }

        console.log('✅ Database tables initialized');

        // Run HSN column migration
        const addHsnColumn = require('./add_hsn_column');
        await addHsnColumn();

        // Check if we should seed products
        const productsFile = path.join(__dirname, '../../products_final.json');
        if (fs.existsSync(productsFile)) {
            console.log('Found product data, seeding...');
            const seedProducts = require('./seed_products');
            await seedProducts();
        }
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        throw error;
    }
}

module.exports = initializeDatabase;
