const db = require('../utils/database');
const bcrypt = require('bcryptjs');

async function initializeDatabase() {
    try {
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
                force_password_change BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Migrate: Add force_password_change if it doesn't exist
        try {
            await db.execute(`ALTER TABLE users ADD COLUMN force_password_change BOOLEAN DEFAULT TRUE`);
            console.log('✅ Added column force_password_change to users');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                // Column already exists
            } else {
                console.warn('Warning adding column force_password_change:', e.message);
            }
        }

        await db.execute(`
            CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                icon VARCHAR(50) DEFAULT 'box',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

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
                hsn_code VARCHAR(20),
                purchase_price DECIMAL(12, 2) NOT NULL,
                selling_price DECIMAL(12, 2) NOT NULL,
                mrp DECIMAL(12, 2),
                gst_rate DECIMAL(5, 2) DEFAULT 18.00,
                cgst_rate DECIMAL(5, 2) DEFAULT 9.00,
                sgst_rate DECIMAL(5, 2) DEFAULT 9.00,
                igst_rate DECIMAL(5, 2) DEFAULT 18.00,
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

        // Migrate: Add new columns if they don't exist (for existing databases)
        const productColumns = [
            { name: 'hsn_code', type: 'VARCHAR(20)' },
            { name: 'cgst_rate', type: 'DECIMAL(5, 2) DEFAULT 9.00' },
            { name: 'sgst_rate', type: 'DECIMAL(5, 2) DEFAULT 9.00' },
            { name: 'igst_rate', type: 'DECIMAL(5, 2) DEFAULT 18.00' }
        ];
        for (const col of productColumns) {
            try {
                await db.execute(`ALTER TABLE products ADD COLUMN \`${col.name}\` ${col.type}`);
                console.log(`✅ Added column ${col.name} to products`);
            } catch (e) {
                if (e.code === 'ER_DUP_FIELDNAME') {
                    // Column already exists
                } else {
                    console.warn(`Warning adding column ${col.name}:`, e.message);
                }
            }
        }

        await db.execute(`
            CREATE TABLE IF NOT EXISTS sales (
                id INT AUTO_INCREMENT PRIMARY KEY,
                invoice_number VARCHAR(50) UNIQUE NOT NULL,
                customer_name VARCHAR(100) NOT NULL,
                customer_phone VARCHAR(20),
                customer_email VARCHAR(100),
                customer_address TEXT,
                customer_gstin VARCHAR(15),
                is_interstate BOOLEAN DEFAULT FALSE,
                subtotal DECIMAL(12, 2) NOT NULL,
                cgst_amount DECIMAL(12, 2) DEFAULT 0,
                sgst_amount DECIMAL(12, 2) DEFAULT 0,
                igst_amount DECIMAL(12, 2) DEFAULT 0,
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

        // Migrate: Add new columns if they don't exist
        const salesColumns = [
            { name: 'customer_gstin', type: 'VARCHAR(15)' },
            { name: 'is_interstate', type: 'BOOLEAN DEFAULT FALSE' },
            { name: 'cgst_amount', type: 'DECIMAL(12, 2) DEFAULT 0' },
            { name: 'sgst_amount', type: 'DECIMAL(12, 2) DEFAULT 0' },
            { name: 'igst_amount', type: 'DECIMAL(12, 2) DEFAULT 0' }
        ];
        for (const col of salesColumns) {
            try {
                await db.execute(`ALTER TABLE sales ADD COLUMN \`${col.name}\` ${col.type}`);
                console.log(`✅ Added column ${col.name} to sales`);
            } catch (e) {
                if (e.code === 'ER_DUP_FIELDNAME') {
                    // Column already exists
                } else {
                    console.warn(`Warning adding column ${col.name}:`, e.message);
                }
            }
        }

        await db.execute(`
            CREATE TABLE IF NOT EXISTS sale_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sale_id INT NOT NULL,
                product_id INT NOT NULL,
                quantity INT NOT NULL,
                unit_price DECIMAL(12, 2) NOT NULL,
                gst_rate DECIMAL(5, 2) DEFAULT 18.00,
                cgst_amount DECIMAL(12, 2) DEFAULT 0,
                sgst_amount DECIMAL(12, 2) DEFAULT 0,
                igst_amount DECIMAL(12, 2) DEFAULT 0,
                gst_amount DECIMAL(12, 2) NOT NULL,
                total_price DECIMAL(12, 2) NOT NULL,
                FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
            )
        `);

        // Migrate: Add new columns if they don't exist
        const saleItemColumns = [
            { name: 'cgst_amount', type: 'DECIMAL(12, 2) DEFAULT 0' },
            { name: 'sgst_amount', type: 'DECIMAL(12, 2) DEFAULT 0' },
            { name: 'igst_amount', type: 'DECIMAL(12, 2) DEFAULT 0' }
        ];
        for (const col of saleItemColumns) {
            try {
                await db.execute(`ALTER TABLE sale_items ADD COLUMN \`${col.name}\` ${col.type}`);
                console.log(`✅ Added column ${col.name} to sale_items`);
            } catch (e) {
                if (e.code === 'ER_DUP_FIELDNAME') {
                    // Column already exists
                } else {
                    console.warn(`Warning adding column ${col.name}:`, e.message);
                }
            }
        }

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

        await db.execute(`
            CREATE TABLE IF NOT EXISTS settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                key_name VARCHAR(100) UNIQUE NOT NULL,
                value TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS password_resets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                token VARCHAR(255) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Create indexes safely (MySQL doesn't support IF NOT EXISTS for indexes)
        const indexes = [
            { name: 'idx_sales_created_at', table: 'sales', column: 'created_at' },
            { name: 'idx_sales_invoice', table: 'sales', column: 'invoice_number' },
            { name: 'idx_sales_customer_phone', table: 'sales', column: 'customer_phone' },
            { name: 'idx_products_category', table: 'products', column: 'category_id' },
            { name: 'idx_products_sku', table: 'products', column: 'sku' },
            { name: 'idx_products_hsn', table: 'products', column: 'hsn_code' },
            { name: 'idx_sale_items_sale', table: 'sale_items', column: 'sale_id' },
            { name: 'idx_stock_logs_product', table: 'stock_logs', column: 'product_id' }
        ];

        for (const idx of indexes) {
            try {
                await db.execute(`CREATE INDEX \`${idx.name}\` ON \`${idx.table}\`(\`${idx.column}\`)`);
            } catch (e) {
                if (e.code === 'ER_DUP_KEYNAME') {
                    // Index already exists, ignore
                } else {
                    console.warn(`Warning creating index ${idx.name}:`, e.message);
                }
            }
        }

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
            ['LED Bulb & Tube', 'LED Bulbs, Tubelights, Panels', 'lightbulb'],
            ['Mobile Phone', 'Smartphones, Feature Phones', 'mobile-alt'],
            ['Laptop', 'Windows, MacBook, Chromebook', 'laptop'],
            ['Tablet', 'Android, iPad', 'tablet-alt'],
            ['Camera', 'DSLR, Mirrorless, Action Camera', 'camera'],
            ['Headphone & Speaker', 'Wired, Wireless, Bluetooth', 'headphones'],
            ['Kitchen Chimney', 'Auto Clean, Filterless', 'wind']
        ];

        for (const cat of categories) {
            try {
                await db.execute('INSERT IGNORE INTO categories (name, description, icon) VALUES (?, ?, ?)', cat);
            } catch (e) {}
        }

        const [existingUsers] = await db.execute('SELECT id FROM users WHERE username = ?', ['masteradmin']);

        if (existingUsers.length === 0) {
            const randomPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-4).toUpperCase();
            console.log('Creating default master admin user...');
            const hashedPassword = await bcrypt.hash(randomPassword, 12);
            await db.execute(
                `INSERT INTO users (username, email, password, full_name, role, is_active, force_password_change)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                ['masteradmin', 'admin@electronicsstore.com', hashedPassword, 'Master Administrator', 'master_admin', true, true]
            );
            console.log('✅ Default master admin created');
            console.log(`   Username: masteradmin`);
            console.log(`   Password: ${randomPassword}`);
            console.log('   ⚠️  You MUST change this password on first login!');
        } else {
            console.log('✅ Master admin already exists');
        }

        const settings = [
            ['store_name', 'Electronics Store'],
            ['store_address', '123 Main Street, Mumbai, Maharashtra - 400001'],
            ['store_phone', '+91 98765 43210'],
            ['store_email', 'info@electronicsstore.com'],
            ['store_gstin', '27AABCU9603R1ZX'],
            ['store_pan', 'AABCU9603R'],
            ['store_state', 'Maharashtra'],
            ['store_state_code', '27'],
            ['currency', 'INR'],
            ['currency_symbol', '₹'],
            ['date_format', 'DD/MM/YYYY'],
            ['low_stock_alert', '5'],
            ['gst_enabled', 'true'],
            ['default_gst_rate', '18']
        ];

        for (const setting of settings) {
            try {
                await db.execute('INSERT IGNORE INTO settings (key_name, value) VALUES (?, ?)', setting);
            } catch (e) {}
        }

        await seedProducts();
        console.log('✅ Database tables initialized');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        throw error;
    }
}

async function seedProducts() {
    const [existing] = await db.execute('SELECT COUNT(*) as count FROM products');
    if (existing[0].count > 0) {
        console.log(`✅ ${existing[0].count} products already exist, skipping seed`);
        return;
    }

    console.log('🌱 Seeding products from Khosla Electronics catalog with HSN codes...');

    const [cats] = await db.execute('SELECT id, name FROM categories');
    const catMap = {};
    cats.forEach(c => catMap[c.name] = c.id);

    const products = [
        { name: "LG 1.5 Ton 5 Star AI DUAL Inverter Split AC", description: "AI DUAL Inverter, 6-in-1 Convertible Cooling, HD Filter with Anti-Virus Protection, Ocean Black Fin", category: "Air Conditioner", brand: "LG", model: "RS-Q19YNZE", sku: "AC-LG-1.5T-5S-001", barcode: "8906057471234", hsn: "8415", purchase_price: 32000.00, selling_price: 38999.00, mrp: 45999.00, gst_rate: 18.00, quantity: 15, min_stock: 3, specs: '{"capacity":"1.5 Ton","star_rating":"5 Star","compressor":"DUAL Inverter","cooling_modes":"6-in-1 Convertible","filter":"HD Filter with Anti-Virus","warranty":"1 Year Comprehensive + 10 Years Compressor","power_consumption":"818.81 kWh/year","noise_level":"31 dB","refrigerant":"R32","dimensions":"998 x 330 x 210 mm (IDU)"}' },
        { name: "Samsung 1.5 Ton 3 Star WindFree Inverter Split AC", description: "WindFree Cooling, Digital Inverter Technology, Anti-Bacterial Filter, Auto Clean", category: "Air Conditioner", brand: "Samsung", model: "AR18BY3ZAWK", sku: "AC-SAM-1.5T-3S-001", barcode: "8806090475678", hsn: "8415", purchase_price: 28000.00, selling_price: 32999.00, mrp: 38999.00, gst_rate: 18.00, quantity: 12, min_stock: 3, specs: '{"capacity":"1.5 Ton","star_rating":"3 Star","compressor":"Digital Inverter","cooling_technology":"WindFree","filter":"Anti-Bacterial","warranty":"1 Year Comprehensive + 10 Years Compressor","power_consumption":"1050 kWh/year","noise_level":"45 dB","refrigerant":"R32","dimensions":"1055 x 299 x 215 mm (IDU)"}' },
        { name: "Daikin 1.5 Ton 5 Star Inverter Split AC", description: "Coanda Airflow, PM 2.5 Filter, Dew Clean Technology, Stabilizer Free Operation", category: "Air Conditioner", brand: "Daikin", model: "FTKF50TV16U", sku: "AC-DAI-1.5T-5S-001", barcode: "8901725123456", hsn: "8415", purchase_price: 35000.00, selling_price: 41999.00, mrp: 48999.00, gst_rate: 18.00, quantity: 8, min_stock: 2, specs: '{"capacity":"1.5 Ton","star_rating":"5 Star","compressor":"Swing Inverter","airflow":"Coanda Airflow","filter":"PM 2.5 Filter","warranty":"1 Year Comprehensive + 10 Years Compressor","power_consumption":"785 kWh/year","noise_level":"38 dB","refrigerant":"R32","dimensions":"990 x 298 x 222 mm (IDU)"}' },
        { name: "Blue Star 1.0 Ton 3 Star Inverter Split AC", description: "Turbo Cool, Self Diagnosis, Anti-Corrosive Blue Fins, Sleep Mode", category: "Air Conditioner", brand: "Blue Star", model: "IC312RBTU", sku: "AC-BS-1.0T-3S-001", barcode: "8904134123456", hsn: "8415", purchase_price: 22000.00, selling_price: 25999.00, mrp: 30999.00, gst_rate: 18.00, quantity: 10, min_stock: 3, specs: '{"capacity":"1.0 Ton","star_rating":"3 Star","compressor":"Inverter","features":"Turbo Cool, Self Diagnosis","fins":"Anti-Corrosive Blue Fins","warranty":"1 Year Comprehensive + 5 Years Compressor","power_consumption":"650 kWh/year","noise_level":"42 dB","refrigerant":"R32","dimensions":"890 x 280 x 200 mm (IDU)"}' },
        { name: "Voltas 1.5 Ton 5 Star Inverter Split AC", description: "Adjustable Inverter AC, 4-in-1 Convertible Cooling, Anti-Dust Filter, Copper Condenser", category: "Air Conditioner", brand: "Voltas", model: "185V ADS", sku: "AC-VOL-1.5T-5S-001", barcode: "8904134789012", hsn: "8415", purchase_price: 29000.00, selling_price: 34999.00, mrp: 40999.00, gst_rate: 18.00, quantity: 14, min_stock: 3, specs: '{"capacity":"1.5 Ton","star_rating":"5 Star","compressor":"Inverter","cooling_modes":"4-in-1 Convertible","filter":"Anti-Dust Filter","warranty":"1 Year Comprehensive + 5 Years Compressor","power_consumption":"830 kWh/year","noise_level":"40 dB","refrigerant":"R32","condenser":"100% Copper","dimensions":"970 x 310 x 215 mm (IDU)"}' },
        { name: "Samsung 253L Double Door Frost Free Refrigerator", description: "Digital Inverter Technology, Convertible 5-in-1, Curd Maestro, Power Cool, Power Freeze", category: "Refrigerator", brand: "Samsung", model: "RT28C3733S8/HL", sku: "REF-SAM-253L-DD-001", barcode: "8806090123456", hsn: "8418", purchase_price: 22000.00, selling_price: 26999.00, mrp: 31999.00, gst_rate: 18.00, quantity: 10, min_stock: 3, specs: '{"capacity":"253 Litres","door_type":"Double Door","defrost_type":"Frost Free","compressor":"Digital Inverter","features":"Convertible 5-in-1, Curd Maestro","warranty":"1 Year Comprehensive + 10 Years Compressor","star_rating":"3 Star","annual_consumption":"228 kWh/year","dimensions":"637 x 555 x 1545 mm","weight":"46 kg"}' },
        { name: "LG 260L Double Door Smart Inverter Refrigerator", description: "Smart Inverter Compressor, Auto Smart Connect, Multi Air Flow, Moist Balance Crisper", category: "Refrigerator", brand: "LG", model: "GL-I292RPZX", sku: "REF-LG-260L-DD-001", barcode: "8906057890123", hsn: "8418", purchase_price: 24000.00, selling_price: 28999.00, mrp: 33999.00, gst_rate: 18.00, quantity: 8, min_stock: 2, specs: '{"capacity":"260 Litres","door_type":"Double Door","defrost_type":"Frost Free","compressor":"Smart Inverter","features":"Auto Smart Connect, Multi Air Flow","warranty":"1 Year Comprehensive + 10 Years Compressor","star_rating":"3 Star","annual_consumption":"198 kWh/year","dimensions":"585 x 703 x 1475 mm","weight":"50 kg"}' },
        { name: "Whirlpool 265L IntelliFresh Inverter Double Door Refrigerator", description: "IntelliSense Inverter Technology, Adaptive Intelligence, Zeolite Technology, MicroBlock", category: "Refrigerator", brand: "Whirlpool", model: "INTELLIFRESH INV CNV 278 2S", sku: "REF-WHI-265L-DD-001", barcode: "8901134567890", hsn: "8418", purchase_price: 21000.00, selling_price: 24999.00, mrp: 29999.00, gst_rate: 18.00, quantity: 12, min_stock: 3, specs: '{"capacity":"265 Litres","door_type":"Double Door","defrost_type":"Frost Free","compressor":"IntelliSense Inverter","features":"Adaptive Intelligence, Zeolite Technology","warranty":"1 Year Comprehensive + 10 Years Compressor","star_rating":"2 Star","annual_consumption":"245 kWh/year","dimensions":"570 x 660 x 1603 mm","weight":"52 kg"}' },
        { name: "Godrej 190L Single Door Direct Cool Refrigerator", description: "Base Stand Drawer, Aroma Lock, Jumbo Vegetable Tray, Turbo Cooling Technology", category: "Refrigerator", brand: "Godrej", model: "RD EDGEPRO 190 CT 3.2", sku: "REF-GOD-190L-SD-001", barcode: "8901790123456", hsn: "8418", purchase_price: 12000.00, selling_price: 14999.00, mrp: 17999.00, gst_rate: 18.00, quantity: 15, min_stock: 5, specs: '{"capacity":"190 Litres","door_type":"Single Door","defrost_type":"Direct Cool","compressor":"Standard","features":"Base Stand Drawer, Aroma Lock","warranty":"1 Year Comprehensive + 10 Years Compressor","star_rating":"3 Star","annual_consumption":"168 kWh/year","dimensions":"623 x 532 x 1254 mm","weight":"35 kg"}' },
        { name: "Haier 325L Bottom Mount Frost Free Refrigerator", description: "Twin Inverter Technology, 360 Degree Cooling, Deo Fresh Technology, Stabilizer Free", category: "Refrigerator", brand: "Haier", model: "HRB-3404BS-E", sku: "REF-HAI-325L-BM-001", barcode: "6901018123456", hsn: "8418", purchase_price: 28000.00, selling_price: 32999.00, mrp: 38999.00, gst_rate: 18.00, quantity: 6, min_stock: 2, specs: '{"capacity":"325 Litres","door_type":"Bottom Mount","defrost_type":"Frost Free","compressor":"Twin Inverter","features":"360 Degree Cooling, Deo Fresh","warranty":"1 Year Comprehensive + 10 Years Compressor","star_rating":"3 Star","annual_consumption":"210 kWh/year","dimensions":"595 x 660 x 1775 mm","weight":"58 kg"}' },
        { name: "LG 8.0 kg 5 Star Inverter Fully-Automatic Front Load Washing Machine", description: "AI Direct Drive, Steam Technology, 6 Motion Direct Drive, Inverter Direct Drive Motor", category: "Washing Machine", brand: "LG", model: "FHM1408BDL", sku: "WM-LG-8KG-FL-001", barcode: "8906057345678", hsn: "8450", purchase_price: 32000.00, selling_price: 38999.00, mrp: 44999.00, gst_rate: 18.00, quantity: 8, min_stock: 2, specs: '{"capacity":"8.0 kg","type":"Fully-Automatic Front Load","star_rating":"5 Star","motor":"Inverter Direct Drive","technology":"AI Direct Drive, Steam","wash_programs":"14","warranty":"2 Years Comprehensive + 10 Years Motor","spin_speed":"1400 RPM","dimensions":"600 x 560 x 850 mm","weight":"63 kg"}' },
        { name: "Samsung 7.5 kg 5 Star AI EcoBubble Front Load Washing Machine", description: "AI Control, EcoBubble Technology, Hygiene Steam, Digital Inverter Motor", category: "Washing Machine", brand: "Samsung", model: "WW75T504DTW/TL", sku: "WM-SAM-7.5KG-FL-001", barcode: "8806090567890", hsn: "8450", purchase_price: 29000.00, selling_price: 34999.00, mrp: 40999.00, gst_rate: 18.00, quantity: 10, min_stock: 3, specs: '{"capacity":"7.5 kg","type":"Fully-Automatic Front Load","star_rating":"5 Star","motor":"Digital Inverter","technology":"EcoBubble, Hygiene Steam","wash_programs":"22","warranty":"2 Years Comprehensive + 20 Years Motor","spin_speed":"1400 RPM","dimensions":"600 x 550 x 850 mm","weight":"61 kg"}' },
        { name: "Whirlpool 7.5 kg 5 Star Stainwash Pro Fully-Automatic Top Load", description: "6th Sense Technology, Hard Water Wash, ZPF Technology, Inbuilt Heater", category: "Washing Machine", brand: "Whirlpool", model: "360 BW PRO (540) H 7.5 KG", sku: "WM-WHI-7.5KG-TL-001", barcode: "8901134789012", hsn: "8450", purchase_price: 18000.00, selling_price: 21999.00, mrp: 25999.00, gst_rate: 18.00, quantity: 12, min_stock: 3, specs: '{"capacity":"7.5 kg","type":"Fully-Automatic Top Load","star_rating":"5 Star","technology":"6th Sense, Hard Water Wash","features":"ZPF Technology, Inbuilt Heater","wash_programs":"12","warranty":"2 Years Comprehensive + 10 Years Motor","spin_speed":"740 RPM","dimensions":"540 x 560 x 940 mm","weight":"32 kg"}' },
        { name: "IFB 6.5 kg 5 Star Aqua Conserve Fully-Automatic Front Load", description: "Aqua Energie, Cradle Wash, 3D Wash System, Crescent Moon Drum", category: "Washing Machine", brand: "IFB", model: "SENATOR WSS 6510", sku: "WM-IFB-6.5KG-FL-001", barcode: "8901789012345", hsn: "8450", purchase_price: 25000.00, selling_price: 29999.00, mrp: 34999.00, gst_rate: 18.00, quantity: 7, min_stock: 2, specs: '{"capacity":"6.5 kg","type":"Fully-Automatic Front Load","star_rating":"5 Star","technology":"Aqua Energie, 3D Wash","features":"Cradle Wash, Crescent Moon Drum","wash_programs":"14","warranty":"4 Years Comprehensive + 10 Years Motor","spin_speed":"1000 RPM","dimensions":"598 x 506 x 875 mm","weight":"65 kg"}' },
        { name: "Bosch 7 kg 5 Star Front Load Washing Machine", description: "EcoSilence Drive, ActiveWater Plus, Anti-Vibration Design, SpeedPerfect", category: "Washing Machine", brand: "Bosch", model: "WAJ2416WIN", sku: "WM-BOS-7KG-FL-001", barcode: "4242005123456", hsn: "8450", purchase_price: 27000.00, selling_price: 31999.00, mrp: 36999.00, gst_rate: 18.00, quantity: 6, min_stock: 2, specs: '{"capacity":"7.0 kg","type":"Fully-Automatic Front Load","star_rating":"5 Star","motor":"EcoSilence Drive","technology":"ActiveWater Plus, SpeedPerfect","features":"Anti-Vibration Design","wash_programs":"15","warranty":"2 Years Comprehensive + 12 Years Motor","spin_speed":"1200 RPM","dimensions":"598 x 590 x 848 mm","weight":"71 kg"}' },
        { name: "Samsung 55 inch Crystal 4K UHD Smart LED TV", description: "Crystal Processor 4K, PurColor, HDR 10+, Smart Hub, Voice Assistant", category: "Television", brand: "Samsung", model: "UA55CUE70AKLXL", sku: "TV-SAM-55IN-4K-001", barcode: "8806090789012", hsn: "8528", purchase_price: 38000.00, selling_price: 44999.00, mrp: 52999.00, gst_rate: 18.00, quantity: 8, min_stock: 2, specs: '{"screen_size":"55 inch (139 cm)","resolution":"4K UHD (3840 x 2160)","processor":"Crystal Processor 4K","display_technology":"LED","hdr":"HDR 10+","smart_tv":"Tizen OS","connectivity":"3 HDMI, 2 USB, Wi-Fi, Bluetooth","sound":"20W, Dolby Digital Plus","warranty":"1 Year Comprehensive","dimensions":"1230.5 x 706.5 x 59.9 mm (without stand)","weight":"15.5 kg"}' },
        { name: "LG 43 inch 4K UHD Smart LED TV", description: "a5 AI Processor 4K Gen6, WebOS 23, Magic Remote, Filmmaker Mode", category: "Television", brand: "LG", model: "43UR7500PSC", sku: "TV-LG-43IN-4K-001", barcode: "8906057567890", hsn: "8528", purchase_price: 26000.00, selling_price: 29999.00, mrp: 34999.00, gst_rate: 18.00, quantity: 12, min_stock: 3, specs: '{"screen_size":"43 inch (108 cm)","resolution":"4K UHD (3840 x 2160)","processor":"a5 AI Processor 4K Gen6","display_technology":"LED","hdr":"HDR 10, HLG","smart_tv":"WebOS 23","connectivity":"2 HDMI, 1 USB, Wi-Fi, Bluetooth","sound":"20W, AI Sound","warranty":"1 Year Comprehensive","dimensions":"960 x 562 x 85.4 mm (without stand)","weight":"8.3 kg"}' },
        { name: "Sony Bravia 65 inch 4K UHD Google TV", description: "X1 4K Processor, Live Colour, Google TV, Dolby Vision, Dolby Atmos", category: "Television", brand: "Sony", model: "KD-65X74L", sku: "TV-SON-65IN-4K-001", barcode: "4548736123456", hsn: "8528", purchase_price: 65000.00, selling_price: 74999.00, mrp: 89999.00, gst_rate: 18.00, quantity: 5, min_stock: 2, specs: '{"screen_size":"65 inch (164 cm)","resolution":"4K UHD (3840 x 2160)","processor":"X1 4K Processor","display_technology":"LED","hdr":"Dolby Vision, HDR 10","smart_tv":"Google TV","connectivity":"4 HDMI, 2 USB, Wi-Fi, Bluetooth","sound":"20W, Dolby Atmos","warranty":"1 Year Comprehensive + 1 Year Panel","dimensions":"1452 x 836 x 70 mm (without stand)","weight":"20.8 kg"}' },
        { name: "OnePlus 50 inch Y Series 4K UHD Smart LED TV", description: "Gamma Engine, Android TV 11, Google Assistant, Chromecast Built-in", category: "Television", brand: "OnePlus", model: "50Y1S Pro", sku: "TV-ONE-50IN-4K-001", barcode: "6973315123456", hsn: "8528", purchase_price: 28000.00, selling_price: 32999.00, mrp: 38999.00, gst_rate: 18.00, quantity: 10, min_stock: 3, specs: '{"screen_size":"50 inch (126 cm)","resolution":"4K UHD (3840 x 2160)","processor":"Gamma Engine","display_technology":"LED","hdr":"HDR 10+, HLG","smart_tv":"Android TV 11","connectivity":"3 HDMI, 2 USB, Wi-Fi, Bluetooth","sound":"24W, Dolby Audio","warranty":"1 Year Comprehensive","dimensions":"1115 x 650 x 80 mm (without stand)","weight":"9.8 kg"}' },
        { name: "Mi 32 inch HD Ready Smart LED TV", description: "PatchWall, Android TV 11, Google Assistant, Dolby Audio", category: "Television", brand: "Xiaomi", model: "L32M7-EAIN", sku: "TV-XIA-32IN-HD-001", barcode: "6971408123456", hsn: "8528", purchase_price: 10000.00, selling_price: 12999.00, mrp: 15999.00, gst_rate: 18.00, quantity: 20, min_stock: 5, specs: '{"screen_size":"32 inch (80 cm)","resolution":"HD Ready (1366 x 768)","processor":"Amlogic Cortex-A35","display_technology":"LED","hdr":"No","smart_tv":"Android TV 11","connectivity":"2 HDMI, 2 USB, Wi-Fi, Bluetooth","sound":"20W, Dolby Audio","warranty":"1 Year Comprehensive","dimensions":"715 x 425 x 75 mm (without stand)","weight":"3.9 kg"}' },
        { name: "LG 28L Convection Microwave Oven", description: "Charcoal Lighting Heater, Diet Fry, Indian Roti Basket, 360 Motorised Rotisserie", category: "Microwave Oven", brand: "LG", model: "MJ2886BFUM", sku: "MW-LG-28L-CONV-001", barcode: "8906057789012", hsn: "8516", purchase_price: 14000.00, selling_price: 16999.00, mrp: 19999.00, gst_rate: 18.00, quantity: 8, min_stock: 2, specs: '{"capacity":"28 Litres","type":"Convection","power":"1950W","features":"Charcoal Lighting Heater, Diet Fry, Rotisserie","auto_cook_menu":"251","warranty":"1 Year Comprehensive + 4 Years Magnetron","dimensions":"507 x 310 x 405 mm","weight":"17 kg"}' },
        { name: "Samsung 28L Convection Microwave Oven", description: "Slim Fry, Tandoor Technology, Curd Making, Ceramic Enamel Cavity", category: "Microwave Oven", brand: "Samsung", model: "CE1041DSB2/TL", sku: "MW-SAM-28L-CONV-001", barcode: "8806090890123", hsn: "8516", purchase_price: 12000.00, selling_price: 14999.00, mrp: 17999.00, gst_rate: 18.00, quantity: 10, min_stock: 3, specs: '{"capacity":"28 Litres","type":"Convection","power":"1400W","features":"Slim Fry, Tandoor Technology, Curd Making","auto_cook_menu":"200","warranty":"1 Year Comprehensive + 10 Years Cavity","dimensions":"517 x 310 x 474 mm","weight":"16 kg"}' },
        { name: "Kent Grand Plus 8L RO + UV + UF + TDS Water Purifier", description: "Mineral RO Technology, UV LED in Tank, Zero Water Wastage, TDS Controller", category: "Water Purifier", brand: "Kent", model: "Grand Plus", sku: "WP-KEN-8L-RO-001", barcode: "8901789345678", hsn: "8421", purchase_price: 15000.00, selling_price: 17999.00, mrp: 21999.00, gst_rate: 18.00, quantity: 12, min_stock: 3, specs: '{"capacity":"8 Litres","purification":"RO + UV + UF + TDS","technology":"Mineral RO, UV LED in Tank","features":"Zero Water Wastage, TDS Controller","purification_capacity":"20 L/hr","warranty":"1 Year Comprehensive + 3 Years Free Service","dimensions":"410 x 260 x 520 mm","weight":"9.4 kg"}' },
        { name: "Aquaguard Aura 7L RO + UV + UF + MTDS Water Purifier", description: "Active Copper Technology, Mineral Guard, UV E-Boiling, Smart LED Indicator", category: "Water Purifier", brand: "Aquaguard", model: "Aura", sku: "WP-AQU-7L-RO-001", barcode: "8901790567890", hsn: "8421", purchase_price: 13000.00, selling_price: 15499.00, mrp: 18999.00, gst_rate: 18.00, quantity: 15, min_stock: 4, specs: '{"capacity":"7 Litres","purification":"RO + UV + UF + MTDS","technology":"Active Copper, Mineral Guard","features":"UV E-Boiling, Smart LED Indicator","purification_capacity":"15 L/hr","warranty":"1 Year Comprehensive","dimensions":"316 x 251 x 462 mm","weight":"7.5 kg"}' },
        { name: "Crompton Energion HS 1200mm BLDC Ceiling Fan", description: "BLDC Motor, 5 Star Rated, Remote Control, Underlight Option, 35W Power", category: "Fan", brand: "Crompton", model: "Energion HS", sku: "FAN-CRO-1200-BLDC-001", barcode: "8901789789012", hsn: "8414", purchase_price: 2800.00, selling_price: 3499.00, mrp: 4299.00, gst_rate: 18.00, quantity: 25, min_stock: 8, specs: '{"sweep":"1200 mm","motor_type":"BLDC","star_rating":"5 Star","power_consumption":"35W","speed":"370 RPM","air_delivery":"230 CMM","features":"Remote Control, Underlight Option","warranty":"5 Years","dimensions":"1200 x 1200 x 300 mm","weight":"4.2 kg"}' },
        { name: "Orient Electric Aeroquiet 1200mm BLDC Ceiling Fan", description: "Aeroquiet Series, BLDC Motor, Remote Control, 32W Power, 5 Star", category: "Fan", brand: "Orient Electric", model: "Aeroquiet", sku: "FAN-ORI-1200-BLDC-001", barcode: "8901790123456", hsn: "8414", purchase_price: 2500.00, selling_price: 2999.00, mrp: 3699.00, gst_rate: 18.00, quantity: 20, min_stock: 6, specs: '{"sweep":"1200 mm","motor_type":"BLDC","star_rating":"5 Star","power_consumption":"32W","speed":"360 RPM","air_delivery":"220 CMM","features":"Remote Control, Silent Operation","warranty":"5 Years","dimensions":"1200 x 1200 x 280 mm","weight":"3.8 kg"}' },
        { name: "Preethi Zodiac MG 218 750W Mixer Grinder", description: "Master Chef Plus Jar, 3-in-1 Insta Fresh Juicer Jar, Vega W5 Motor, 5 Jars", category: "Mixer Grinder", brand: "Preethi", model: "Zodiac MG 218", sku: "MG-PRE-750W-5J-001", barcode: "8901789123456", hsn: "8509", purchase_price: 6500.00, selling_price: 7999.00, mrp: 9499.00, gst_rate: 18.00, quantity: 15, min_stock: 5, specs: '{"power":"750W","motor":"Vega W5","jars":"5 (1.5L, 1.0L, 0.5L, 0.4L, 0.3L)","features":"Master Chef Plus, Insta Fresh Juicer","speed_control":"3 Speed + Pulse","warranty":"2 Years Comprehensive + 5 Years Motor","dimensions":"380 x 230 x 290 mm","weight":"6.2 kg"}' },
        { name: "Bajaj Rex 500W Mixer Grinder", description: "Titan Motor, 3 Stainless Steel Jars, Multi-Functional Blade System", category: "Mixer Grinder", brand: "Bajaj", model: "Rex 500", sku: "MG-BAJ-500W-3J-001", barcode: "8901790234567", hsn: "8509", purchase_price: 1800.00, selling_price: 2199.00, mrp: 2699.00, gst_rate: 18.00, quantity: 25, min_stock: 8, specs: '{"power":"500W","motor":"Titan","jars":"3 (1.2L, 0.8L, 0.3L)","features":"Multi-Functional Blade System","speed_control":"3 Speed","warranty":"2 Years","dimensions":"310 x 200 x 260 mm","weight":"3.1 kg"}' },
        { name: "AO Smith HSE-SHS-015 15L Storage Water Heater", description: "Blue Diamond Glass Lined Tank, BEE 5 Star Rated, Long-Lasting Anode Rod", category: "Geyser", brand: "AO Smith", model: "HSE-SHS-015", sku: "GEY-AOS-15L-STR-001", barcode: "8901790345678", hsn: "8516", purchase_price: 8000.00, selling_price: 9999.00, mrp: 11999.00, gst_rate: 18.00, quantity: 10, min_stock: 3, specs: '{"capacity":"15 Litres","type":"Storage","star_rating":"5 Star","tank":"Blue Diamond Glass Lined","power":"2000W","pressure_rating":"8 bar","warranty":"2 Years Comprehensive + 7 Years Tank","dimensions":"350 x 350 x 380 mm","weight":"11 kg"}' },
        { name: "Bajaj New Shakti Neo 15L Storage Water Heater", description: "Glassline Inner Tank, Swirl Flow Technology, PUF Insulation, 4 Star", category: "Geyser", brand: "Bajaj", model: "New Shakti Neo", sku: "GEY-BAJ-15L-STR-001", barcode: "8901790456789", hsn: "8516", purchase_price: 5500.00, selling_price: 6499.00, mrp: 7999.00, gst_rate: 18.00, quantity: 15, min_stock: 5, specs: '{"capacity":"15 Litres","type":"Storage","star_rating":"4 Star","tank":"Glassline Inner Tank","power":"2000W","pressure_rating":"8 bar","warranty":"2 Years Comprehensive + 5 Years Tank","dimensions":"340 x 340 x 370 mm","weight":"9.5 kg"}' },
        { name: "Dyson V12 Detect Slim Cordless Vacuum Cleaner", description: "Laser Dust Detection, Piezo Sensor, LCD Screen, 60 Min Run Time, HEPA Filtration", category: "Vacuum Cleaner", brand: "Dyson", model: "V12 Detect Slim", sku: "VC-DYS-V12-SLIM-001", barcode: "5025155123456", hsn: "8508", purchase_price: 45000.00, selling_price: 52999.00, mrp: 61999.00, gst_rate: 18.00, quantity: 5, min_stock: 2, specs: '{"type":"Cordless Stick","suction_power":"150 AW","run_time":"60 minutes","features":"Laser Dust Detection, Piezo Sensor, LCD Screen","filtration":"HEPA","bin_capacity":"0.35 L","warranty":"2 Years","dimensions":"252 x 250 x 1100 mm","weight":"2.2 kg"}' },
        { name: "Eureka Forbes Quick Clean DX 1200W Vacuum Cleaner", description: "Bagless, HEPA Filter, Multiple Accessories, 1.5L Dust Cup", category: "Vacuum Cleaner", brand: "Eureka Forbes", model: "Quick Clean DX", sku: "VC-EF-1200W-BG-001", barcode: "8901790567890", hsn: "8508", purchase_price: 3500.00, selling_price: 4299.00, mrp: 5299.00, gst_rate: 18.00, quantity: 12, min_stock: 4, specs: '{"type":"Canister","power":"1200W","features":"Bagless, HEPA Filter","dust_capacity":"1.5 L","cord_length":"5 m","warranty":"1 Year","dimensions":"380 x 280 x 260 mm","weight":"3.5 kg"}' },
        { name: "Philips HD4928/01 2100W Induction Cooktop", description: "Auto-Off Program, 6 Preset Cooking Menus, Touch Start, 0 to 3 Hours Time Setting", category: "Induction Cooktop", brand: "Philips", model: "HD4928/01", sku: "IC-PHI-2100W-001", barcode: "8710103123456", hsn: "8516", purchase_price: 2800.00, selling_price: 3499.00, mrp: 4299.00, gst_rate: 18.00, quantity: 15, min_stock: 5, specs: '{"power":"2100W","cooking_menus":"6 Preset","features":"Auto-Off, Touch Start, Timer","timer":"0 to 3 Hours","warranty":"1 Year","dimensions":"281 x 356 x 65 mm","weight":"2.5 kg"}' },
        { name: "Prestige PIC 20.0 1200W Induction Cooktop", description: "Indian Menu Options, Automatic Voltage Regulator, Anti-Magnetic Wall", category: "Induction Cooktop", brand: "Prestige", model: "PIC 20.0", sku: "IC-PRE-1200W-001", barcode: "8901790678901", hsn: "8516", purchase_price: 1800.00, selling_price: 2199.00, mrp: 2699.00, gst_rate: 18.00, quantity: 20, min_stock: 6, specs: '{"power":"1200W","cooking_menus":"Indian Menu Options","features":"Automatic Voltage Regulator, Anti-Magnetic Wall","warranty":"1 Year","dimensions":"270 x 340 x 60 mm","weight":"2.1 kg"}' },
        { name: "Samsung Galaxy S24 Ultra 5G (12GB + 256GB)", description: "Snapdragon 8 Gen 3, 200MP Camera, S Pen, 6.8 inch QHD+ AMOLED, 5000mAh", category: "Mobile Phone", brand: "Samsung", model: "SM-S928BZKCINS", sku: "MP-SAM-S24U-12GB-001", barcode: "8806090901234", hsn: "8517", purchase_price: 105000.00, selling_price: 119999.00, mrp: 134999.00, gst_rate: 18.00, quantity: 8, min_stock: 2, specs: '{"display":"6.8 inch QHD+ Dynamic AMOLED 2X","processor":"Snapdragon 8 Gen 3","ram":"12 GB","storage":"256 GB","rear_camera":"200MP + 50MP + 12MP + 10MP","front_camera":"12MP","battery":"5000 mAh","os":"Android 14","connectivity":"5G, Wi-Fi 7, Bluetooth 5.3","warranty":"1 Year","dimensions":"162.3 x 79.0 x 8.6 mm","weight":"233 g"}' },
        { name: "iPhone 15 Pro Max (256GB) - Natural Titanium", description: "A17 Pro Chip, 48MP Camera System, Titanium Design, Action Button", category: "Mobile Phone", brand: "Apple", model: "MU793HN/A", sku: "MP-APP-15PM-256GB-001", barcode: "1959490123456", hsn: "8517", purchase_price: 140000.00, selling_price: 159900.00, mrp: 179900.00, gst_rate: 18.00, quantity: 6, min_stock: 2, specs: '{"display":"6.7 inch Super Retina XDR OLED","processor":"A17 Pro","ram":"8 GB","storage":"256 GB","rear_camera":"48MP + 12MP + 12MP","front_camera":"12MP","battery":"4422 mAh","os":"iOS 17","connectivity":"5G, Wi-Fi 6E, Bluetooth 5.3","warranty":"1 Year","dimensions":"159.9 x 76.7 x 8.25 mm","weight":"221 g"}' },
        { name: "Redmi Note 13 Pro+ 5G (8GB + 256GB)", description: "MediaTek Dimensity 7200-Ultra, 200MP Camera, 120W HyperCharge, 1.5K AMOLED", category: "Mobile Phone", brand: "Xiaomi", model: "23090RA98I", sku: "MP-XIA-N13P-8GB-001", barcode: "6971408901234", hsn: "8517", purchase_price: 26000.00, selling_price: 29999.00, mrp: 34999.00, gst_rate: 18.00, quantity: 15, min_stock: 5, specs: '{"display":"6.67 inch 1.5K AMOLED","processor":"Dimensity 7200-Ultra","ram":"8 GB","storage":"256 GB","rear_camera":"200MP + 8MP + 2MP","front_camera":"16MP","battery":"5000 mAh","charging":"120W HyperCharge","os":"MIUI 14 (Android 13)","connectivity":"5G, Wi-Fi 6, Bluetooth 5.3","warranty":"1 Year","dimensions":"161.4 x 74.2 x 8.9 mm","weight":"199 g"}' },
        { name: "OnePlus 12 5G (12GB + 256GB) - Flowy Emerald", description: "Snapdragon 8 Gen 3, Hasselblad Camera, 5400mAh, 100W SUPERVOOC", category: "Mobile Phone", brand: "OnePlus", model: "CPH2581", sku: "MP-ONE-12-12GB-001", barcode: "6973315901234", hsn: "8517", purchase_price: 58000.00, selling_price: 64999.00, mrp: 74999.00, gst_rate: 18.00, quantity: 10, min_stock: 3, specs: '{"display":"6.82 inch 2K AMOLED ProXDR","processor":"Snapdragon 8 Gen 3","ram":"12 GB","storage":"256 GB","rear_camera":"50MP + 48MP + 64MP Hasselblad","front_camera":"32MP","battery":"5400 mAh","charging":"100W SUPERVOOC, 50W Wireless","os":"OxygenOS 14 (Android 14)","connectivity":"5G, Wi-Fi 7, Bluetooth 5.4","warranty":"1 Year","dimensions":"163.3 x 75.8 x 9.15 mm","weight":"220 g"}' },
        { name: "HP Pavilion 15 13th Gen Intel Core i5 Laptop", description: "i5-1340P, 16GB RAM, 512GB SSD, 15.6 inch FHD, Intel Iris Xe, Backlit Keyboard", category: "Laptop", brand: "HP", model: "15-eg3039TU", sku: "LP-HP-15-I5-16GB-001", barcode: "1951220123456", hsn: "8471", purchase_price: 52000.00, selling_price: 59999.00, mrp: 69999.00, gst_rate: 18.00, quantity: 8, min_stock: 2, specs: '{"display":"15.6 inch FHD (1920 x 1080)","processor":"Intel Core i5-1340P","ram":"16 GB DDR4","storage":"512 GB SSD","graphics":"Intel Iris Xe","os":"Windows 11 Home","features":"Backlit Keyboard, Fingerprint Reader","connectivity":"Wi-Fi 6, Bluetooth 5.3","warranty":"1 Year","dimensions":"360 x 234 x 17.9 mm","weight":"1.75 kg"}' },
        { name: "Dell Inspiron 15 Intel Core i5 12th Gen Laptop", description: "i5-1235U, 16GB RAM, 512GB SSD, 15.6 inch FHD, Intel UHD, FHD Webcam", category: "Laptop", brand: "Dell", model: "Inspiron 3520", sku: "LP-DEL-15-I5-16GB-001", barcode: "8841163123456", hsn: "8471", purchase_price: 48000.00, selling_price: 54999.00, mrp: 63999.00, gst_rate: 18.00, quantity: 10, min_stock: 3, specs: '{"display":"15.6 inch FHD (1920 x 1080)","processor":"Intel Core i5-1235U","ram":"16 GB DDR4","storage":"512 GB SSD","graphics":"Intel UHD","os":"Windows 11 Home","features":"FHD Webcam, ExpressCharge","connectivity":"Wi-Fi 6, Bluetooth 5.2","warranty":"1 Year","dimensions":"358 x 235 x 18.9 mm","weight":"1.65 kg"}' },
        { name: "Lenovo IdeaPad Slim 3 Intel Core i3 12th Gen Laptop", description: "i3-1215U, 8GB RAM, 512GB SSD, 15.6 inch FHD, Intel UHD, Dolby Audio", category: "Laptop", brand: "Lenovo", model: "82RK00VVIN", sku: "LP-LEN-15-I3-8GB-001", barcode: "1953487123456", hsn: "8471", purchase_price: 32000.00, selling_price: 36999.00, mrp: 42999.00, gst_rate: 18.00, quantity: 15, min_stock: 5, specs: '{"display":"15.6 inch FHD (1920 x 1080)","processor":"Intel Core i3-1215U","ram":"8 GB DDR4","storage":"512 GB SSD","graphics":"Intel UHD","os":"Windows 11 Home","features":"Dolby Audio, Rapid Charge","connectivity":"Wi-Fi 5, Bluetooth 5.1","warranty":"1 Year","dimensions":"359 x 236 x 19.9 mm","weight":"1.63 kg"}' },
        { name: "MacBook Air M3 (13-inch, 8GB + 256GB)", description: "Apple M3 Chip, 13.6 inch Liquid Retina, 18 Hours Battery, MagSafe 3", category: "Laptop", brand: "Apple", model: "MRXN3HN/A", sku: "LP-APP-MBA-M3-8GB-001", barcode: "1959490234567", hsn: "8471", purchase_price: 95000.00, selling_price: 109900.00, mrp: 124900.00, gst_rate: 18.00, quantity: 6, min_stock: 2, specs: '{"display":"13.6 inch Liquid Retina (2560 x 1664)","processor":"Apple M3","ram":"8 GB Unified Memory","storage":"256 GB SSD","graphics":"10-core GPU","os":"macOS Sonoma","features":"MagSafe 3, Touch ID","connectivity":"Wi-Fi 6E, Bluetooth 5.3","warranty":"1 Year","dimensions":"304.1 x 215 x 11.3 mm","weight":"1.24 kg"}' },
        { name: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones", description: "Industry-Leading Noise Cancellation, 30hr Battery, Quick Charge, Speak-to-Chat", category: "Headphone & Speaker", brand: "Sony", model: "WH-1000XM5", sku: "HS-SON-WH1000XM5-001", barcode: "4548736234567", hsn: "8518", purchase_price: 26000.00, selling_price: 29999.00, mrp: 34999.00, gst_rate: 18.00, quantity: 10, min_stock: 3, specs: '{"type":"Over-Ear Wireless","connectivity":"Bluetooth 5.2, NFC","features":"Industry-Leading ANC, Speak-to-Chat","battery":"30 hours","quick_charge":"3 min = 3 hours","warranty":"1 Year","dimensions":"254 x 195 x 80 mm","weight":"250 g"}' },
        { name: "JBL Tune 760NC Wireless Over-Ear ANC Headphones", description: "Active Noise Cancellation, 50hr Battery, Multi-Point Connection, Voice Assistant", category: "Headphone & Speaker", brand: "JBL", model: "Tune 760NC", sku: "HS-JBL-T760NC-001", barcode: "0500363123456", hsn: "8518", purchase_price: 5500.00, selling_price: 6499.00, mrp: 7999.00, gst_rate: 18.00, quantity: 15, min_stock: 5, specs: '{"type":"Over-Ear Wireless","connectivity":"Bluetooth 5.0","features":"ANC, Multi-Point Connection","battery":"50 hours","quick_charge":"5 min = 2 hours","warranty":"1 Year","dimensions":"195 x 175 x 75 mm","weight":"220 g"}' },
        { name: "boAt Stone 1200 14W Portable Bluetooth Speaker", description: "14W Output, IPX7 Waterproof, 9hr Battery, RGB LEDs, TWS Mode", category: "Headphone & Speaker", brand: "boAt", model: "Stone 1200", sku: "SP-BOA-STONE1200-001", barcode: "8904134123457", hsn: "8518", purchase_price: 2800.00, selling_price: 3499.00, mrp: 4299.00, gst_rate: 18.00, quantity: 20, min_stock: 6, specs: '{"type":"Portable Bluetooth","output":"14W","features":"IPX7 Waterproof, RGB LEDs, TWS Mode","battery":"9 hours","connectivity":"Bluetooth 5.0, AUX","warranty":"1 Year","dimensions":"175 x 80 x 80 mm","weight":"650 g"}' },
        { name: "Canon EOS R50 Mirrorless Camera with RF-S 18-45mm Lens", description: "24.2MP APS-C CMOS, 4K Video, Dual Pixel CMOS AF II, Vari-Angle Touch Screen", category: "Camera", brand: "Canon", model: "EOS R50", sku: "CAM-CAN-R50-KIT-001", barcode: "4549292123456", hsn: "9006", purchase_price: 52000.00, selling_price: 59999.00, mrp: 69999.00, gst_rate: 18.00, quantity: 5, min_stock: 2, specs: '{"sensor":"24.2MP APS-C CMOS","video":"4K UHD at 30p","autofocus":"Dual Pixel CMOS AF II","screen":"3.0 inch Vari-Angle Touch","connectivity":"Wi-Fi, Bluetooth","battery":"LP-E17 (approx 370 shots)","warranty":"2 Years","dimensions":"116.3 x 85.5 x 68.8 mm","weight":"375 g (body only)"}' },
        { name: "Sony Alpha ZV-E10 Mirrorless Camera Body", description: "24.2MP APS-C, 4K Video, Real-time Eye AF, Product Showcase Setting, Directional Mic", category: "Camera", brand: "Sony", model: "ZV-E10", sku: "CAM-SON-ZVE10-BDY-001", barcode: "4548736345678", hsn: "9006", purchase_price: 48000.00, selling_price: 54999.00, mrp: 62999.00, gst_rate: 18.00, quantity: 6, min_stock: 2, specs: '{"sensor":"24.2MP APS-C Exmor CMOS","video":"4K UHD at 30p","autofocus":"Real-time Eye AF","screen":"3.0 inch Vari-Angle Touch","connectivity":"Wi-Fi, Bluetooth","battery":"NP-FW50 (approx 440 shots)","warranty":"2 Years","dimensions":"115.2 x 64.2 x 44.8 mm","weight":"343 g (body only)"}' },
        { name: "Faber 90cm 1200 m3/hr Auto Clean Chimney", description: "Filterless Technology, Touch Control, LED Lamps, Oil Collector, 12 Years Warranty", category: "Kitchen Chimney", brand: "Faber", model: "HOOD PRIMUS PLUS TC BK 90", sku: "CH-FAB-90CM-1200-001", barcode: "8901790789012", hsn: "8414", purchase_price: 18000.00, selling_price: 21999.00, mrp: 25999.00, gst_rate: 18.00, quantity: 8, min_stock: 2, specs: '{"size":"90 cm","suction_capacity":"1200 m3/hr","technology":"Filterless Auto Clean","control":"Touch Control","features":"LED Lamps, Oil Collector","noise_level":"58 dB","warranty":"1 Year Comprehensive + 12 Years Motor","dimensions":"900 x 520 x 600 mm","weight":"12 kg"}' },
        { name: "Elica 60cm 1100 m3/hr Filterless Auto Clean Chimney", description: "Motion Sensor, Touch Control, LED Lamps, Oil Collector, 5 Years Motor Warranty", category: "Kitchen Chimney", brand: "Elica", model: "WD HAC TOUCH BF 60 MS", sku: "CH-ELI-60CM-1100-001", barcode: "8901790890123", hsn: "8414", purchase_price: 12000.00, selling_price: 14999.00, mrp: 17999.00, gst_rate: 18.00, quantity: 10, min_stock: 3, specs: '{"size":"60 cm","suction_capacity":"1100 m3/hr","technology":"Filterless Auto Clean","control":"Touch + Motion Sensor","features":"LED Lamps, Oil Collector","noise_level":"58 dB","warranty":"1 Year Comprehensive + 5 Years Motor","dimensions":"600 x 480 x 520 mm","weight":"10 kg"}' },
        { name: "Philips 10W B22 LED Bulb (Cool Day Light, Pack of 4)", description: "EyeComfort Technology, 25000 Hours Life, Flicker-Free, No UV/IR Radiation", category: "LED Bulb & Tube", brand: "Philips", model: "Stellar Bright", sku: "LED-PHI-10W-B22-4PK-001", barcode: "8718696123456", hsn: "9405", purchase_price: 350.00, selling_price: 449.00, mrp: 599.00, gst_rate: 5.00, quantity: 50, min_stock: 15, specs: '{"wattage":"10W","base_type":"B22","color_temperature":"6500K Cool Day Light","lifespan":"25000 hours","features":"EyeComfort, Flicker-Free","lumen_output":"1000 lm","warranty":"2 Years","pack_size":"4 bulbs"}' },
        { name: "Havells 20W LED Tube Light (Cool Day Light, Pack of 2)", description: "Energy Efficient, 25000 Hours Life, Instant Start, No Mercury", category: "LED Bulb & Tube", brand: "Havells", model: "Adore", sku: "LED-HAV-20W-TUBE-2PK-001", barcode: "8901790901234", hsn: "9405", purchase_price: 450.00, selling_price: 549.00, mrp: 699.00, gst_rate: 5.00, quantity: 40, min_stock: 12, specs: '{"wattage":"20W","type":"T5 Tube Light","color_temperature":"6500K Cool Day Light","lifespan":"25000 hours","features":"Energy Efficient, Instant Start","lumen_output":"2000 lm","warranty":"2 Years","pack_size":"2 tubes"}' },
        { name: "Samsung Galaxy Tab S9 FE+ 12.4 inch (8GB + 128GB)", description: "Exynos 1380, S Pen Included, IP68, 10090mAh Battery, Dolby Atmos", category: "Tablet", brand: "Samsung", model: "SM-X610NZSAINS", sku: "TAB-SAM-S9FE-8GB-001", barcode: "8806090123457", hsn: "8471", purchase_price: 38000.00, selling_price: 43999.00, mrp: 49999.00, gst_rate: 18.00, quantity: 8, min_stock: 2, specs: '{"display":"12.4 inch WQXGA (2560 x 1600)","processor":"Exynos 1380","ram":"8 GB","storage":"128 GB","features":"S Pen Included, IP68","battery":"10090 mAh","os":"Android 13","connectivity":"Wi-Fi, Bluetooth 5.3","warranty":"1 Year","dimensions":"285 x 185 x 6.5 mm","weight":"627 g"}' },
        { name: "Apple iPad Air 5th Gen 10.9 inch (64GB) - Space Grey", description: "M1 Chip, Liquid Retina, Apple Pencil 2 Support, Touch ID, 12MP Ultra Wide Front", category: "Tablet", brand: "Apple", model: "MM9C3HN/A", sku: "TAB-APP-IPADA-64GB-001", barcode: "1959490345678", hsn: "8471", purchase_price: 48000.00, selling_price: 54900.00, mrp: 59900.00, gst_rate: 18.00, quantity: 10, min_stock: 3, specs: '{"display":"10.9 inch Liquid Retina (2360 x 1640)","processor":"Apple M1","ram":"8 GB","storage":"64 GB","features":"Apple Pencil 2, Touch ID","battery":"Up to 10 hours","os":"iPadOS 16","connectivity":"Wi-Fi 6, Bluetooth 5.0","warranty":"1 Year","dimensions":"247.6 x 178.5 x 6.1 mm","weight":"461 g"}' },
        { name: "Luminous Zelio+ 1100 Pure Sine Wave Inverter with RC18000 Battery", description: "Pure Sine Wave, 900VA Capacity, 150Ah Battery, Low Maintenance", category: "Inverter & Battery", brand: "Luminous", model: "Zelio+ 1100 + RC18000", sku: "INV-LUM-Z1100-RC18-001", barcode: "8901791012345", hsn: "8504", purchase_price: 18000.00, selling_price: 21999.00, mrp: 25999.00, gst_rate: 18.00, quantity: 8, min_stock: 2, specs: '{"inverter_capacity":"900VA / 720W","battery_capacity":"150Ah","waveform":"Pure Sine Wave","backup_time":"4-6 hours (typical load)","features":"LCD Display, MCB Protection","battery_type":"Tubular Lead Acid","warranty":"2 Years Inverter + 3 Years Battery","dimensions":"300 x 250 x 180 mm (inverter)","weight":"12 kg (inverter)"}' },
        { name: "Microtek UPS SEBz 1100VA Pure Sine Wave Inverter", description: "Pure Sine Wave, 1100VA, Intelli Pure Sinewave Technology, LCD Display", category: "Inverter & Battery", brand: "Microtek", model: "UPS SEBz 1100", sku: "INV-MIC-SEBz1100-001", barcode: "8901791123456", hsn: "8504", purchase_price: 6500.00, selling_price: 7999.00, mrp: 9499.00, gst_rate: 18.00, quantity: 12, min_stock: 4, specs: '{"inverter_capacity":"1100VA","waveform":"Pure Sine Wave","features":"Intelli Pure Sinewave, LCD Display","protection":"Overload, Short Circuit","battery_compatibility":"12V","warranty":"2 Years","dimensions":"280 x 220 x 160 mm","weight":"8.5 kg"}' },
        { name: "Philips GC1905 1440W Steam Iron", description: "American Heritage Soleplate, 15g/min Continuous Steam, 90g Steam Boost, Spray", category: "Iron", brand: "Philips", model: "GC1905", sku: "IRN-PHI-GC1905-001", barcode: "8710103234567", hsn: "8516", purchase_price: 1200.00, selling_price: 1499.00, mrp: 1799.00, gst_rate: 18.00, quantity: 20, min_stock: 6, specs: '{"power":"1440W","soleplate":"American Heritage","steam_output":"15g/min continuous, 90g boost","features":"Spray, Drip Stop","water_tank":"180 ml","warranty":"2 Years","dimensions":"290 x 120 x 140 mm","weight":"1.1 kg"}' },
        { name: "Bajaj MX-35N 2000W Steam Iron", description: "Non-Stick Coated Soleplate, 22g/min Steam, Vertical Steam, Self-Cleaning", category: "Iron", brand: "Bajaj", model: "MX-35N", sku: "IRN-BAJ-MX35N-001", barcode: "8901791234567", hsn: "8516", purchase_price: 800.00, selling_price: 999.00, mrp: 1199.00, gst_rate: 18.00, quantity: 25, min_stock: 8, specs: '{"power":"2000W","soleplate":"Non-Stick Coated","steam_output":"22g/min","features":"Vertical Steam, Self-Cleaning","water_tank":"220 ml","warranty":"2 Years","dimensions":"280 x 115 x 135 mm","weight":"1.2 kg"}' },
        { name: "Bajaj Majesty RX11 2000W Room Heater", description: "2 Heat Settings, Adjustable Thermostat, Safety Thermal Cut-Out, Cool Touch Body", category: "Heater", brand: "Bajaj", model: "Majesty RX11", sku: "HT-BAJ-RX11-2000W-001", barcode: "8901791345678", hsn: "8516", purchase_price: 2200.00, selling_price: 2699.00, mrp: 3299.00, gst_rate: 18.00, quantity: 15, min_stock: 5, specs: '{"power":"2000W","heat_settings":"2 (1000W / 2000W)","features":"Adjustable Thermostat, Thermal Cut-Out","safety":"Cool Touch Body, Tip-Over Switch","warranty":"2 Years","dimensions":"380 x 140 x 300 mm","weight":"2.5 kg"}' },
        { name: "Havells Calido PTC 2000W Room Heater", description: "PTC Heating Element, 2 Heat Settings, Oscillation, Remote Control, LED Display", category: "Heater", brand: "Havells", model: "Calido PTC", sku: "HT-HAV-CALIDO-2000W-001", barcode: "8901791456789", hsn: "8516", purchase_price: 4500.00, selling_price: 5499.00, mrp: 6499.00, gst_rate: 18.00, quantity: 10, min_stock: 3, specs: '{"power":"2000W","heating_element":"PTC","heat_settings":"2","features":"Oscillation, Remote Control, LED Display","safety":"Overheat Protection, Tip-Over Switch","warranty":"2 Years","dimensions":"300 x 180 x 550 mm","weight":"3.8 kg"}' }
    ];

    let inserted = 0;
    let failed = 0;

    for (const p of products) {
        try {
            const categoryId = catMap[p.category];
            if (!categoryId) {
                console.warn(`⚠️ Category not found for product: ${p.name} (category: ${p.category})`);
                failed++;
                continue;
            }

            const cgst = p.gst_rate / 2;
            const sgst = p.gst_rate / 2;
            const igst = p.gst_rate;

            await db.execute(
                `INSERT INTO products (name, description, category_id, brand, model, sku, barcode, hsn_code,
                 purchase_price, selling_price, mrp, gst_rate, cgst_rate, sgst_rate, igst_rate,
                 quantity, min_stock, unit, specifications)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    p.name, p.description, categoryId, p.brand, p.model, p.sku, p.barcode, p.hsn,
                    p.purchase_price, p.selling_price, p.mrp, p.gst_rate, cgst, sgst, igst,
                    p.quantity, p.min_stock, 'piece', p.specs
                ]
            );
            inserted++;
        } catch (e) {
            console.error(`❌ Error inserting product ${p.sku}:`, e.message);
            failed++;
        }
    }

    console.log(`✅ Seeded ${inserted} products successfully` + (failed > 0 ? ` (${failed} failed)` : ''));
}

module.exports = initializeDatabase;
