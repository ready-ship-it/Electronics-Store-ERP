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

        await db.execute(`CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_sales_customer_phone ON sales(customer_phone)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_products_hsn ON products(hsn_code)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_stock_logs_product ON stock_logs(product_id)`);

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
        ('LG 1.5 Ton 5 Star AI DUAL Inverter Split AC', 'AI DUAL Inverter, 6-in-1 Convertible Cooling, HD Filter with Anti-Virus Protection, Ocean Black Fin', 'Air Conditioner', 'LG', 'RS-Q19YNZE', 'AC-LG-1.5T-5S-001', '8906057471234', '8415', 32000.0, 38999.0, 45999.0, 18.0, 15, 3, '{"capacity":"1.5 Ton","star_rating":"5 Star","compressor":"DUAL Inverter","cooling_modes":"6-in-1 Convertible","filter":"HD Filter with Anti-Virus","warranty":"1 Year Comprehensive + 10 Years Compressor","power_consumption":"818.81 kWh/year","noise_level":"31 dB","refrigerant":"R32","dimensions":"998 x 330 x 210 mm (IDU)"}'),
        ('Samsung 1.5 Ton 3 Star WindFree Inverter Split AC', 'WindFree Cooling, Digital Inverter Technology, Anti-Bacterial Filter, Auto Clean', 'Air Conditioner', 'Samsung', 'AR18BY3ZAWK', 'AC-SAM-1.5T-3S-001', '8806090475678', '8415', 28000.0, 32999.0, 38999.0, 18.0, 12, 3, '{"capacity":"1.5 Ton","star_rating":"3 Star","compressor":"Digital Inverter","cooling_technology":"WindFree","filter":"Anti-Bacterial","warranty":"1 Year Comprehensive + 10 Years Compressor","power_consumption":"1050 kWh/year","noise_level":"45 dB","refrigerant":"R32","dimensions":"1055 x 299 x 215 mm (IDU)"}'),
        ('Daikin 1.5 Ton 5 Star Inverter Split AC', 'Coanda Airflow, PM 2.5 Filter, Dew Clean Technology, Stabilizer Free Operation', 'Air Conditioner', 'Daikin', 'FTKF50TV16U', 'AC-DAI-1.5T-5S-001', '8901725123456', '8415', 35000.0, 41999.0, 48999.0, 18.0, 8, 2, '{"capacity":"1.5 Ton","star_rating":"5 Star","compressor":"Swing Inverter","airflow":"Coanda Airflow","filter":"PM 2.5 Filter","warranty":"1 Year Comprehensive + 10 Years Compressor","power_consumption":"785 kWh/year","noise_level":"38 dB","refrigerant":"R32","dimensions":"990 x 298 x 222 mm (IDU)"}'),
        ('Blue Star 1.0 Ton 3 Star Inverter Split AC', 'Turbo Cool, Self Diagnosis, Anti-Corrosive Blue Fins, Sleep Mode', 'Air Conditioner', 'Blue Star', 'IC312RBTU', 'AC-BS-1.0T-3S-001', '8904134123456', '8415', 22000.0, 25999.0, 30999.0, 18.0, 10, 3, '{"capacity":"1.0 Ton","star_rating":"3 Star","compressor":"Inverter","features":"Turbo Cool, Self Diagnosis","fins":"Anti-Corrosive Blue Fins","warranty":"1 Year Comprehensive + 5 Years Compressor","power_consumption":"650 kWh/year","noise_level":"42 dB","refrigerant":"R32","dimensions":"890 x 280 x 200 mm (IDU)"}'),
        ('Voltas 1.5 Ton 5 Star Inverter Split AC', 'Adjustable Inverter AC, 4-in-1 Convertible Cooling, Anti-Dust Filter, Copper Condenser', 'Air Conditioner', 'Voltas', '185V ADS', 'AC-VOL-1.5T-5S-001', '8904134789012', '8415', 29000.0, 34999.0, 40999.0, 18.0, 14, 3, '{"capacity":"1.5 Ton","star_rating":"5 Star","compressor":"Inverter","cooling_modes":"4-in-1 Convertible","filter":"Anti-Dust Filter","warranty":"1 Year Comprehensive + 5 Years Compressor","power_consumption":"830 kWh/year","noise_level":"40 dB","refrigerant":"R32","condenser":"100% Copper","dimensions":"970 x 310 x 215 mm (IDU)"}'),
        ('Samsung 253L Double Door Frost Free Refrigerator', 'Digital Inverter Technology, Convertible 5-in-1, Curd Maestro, Power Cool, Power Freeze', 'Refrigerator', 'Samsung', 'RT28C3733S8/HL', 'REF-SAM-253L-DD-001', '8806090123456', '8418', 22000.0, 26999.0, 31999.0, 18.0, 10, 3, '{"capacity":"253 Litres","door_type":"Double Door","defrost_type":"Frost Free","compressor":"Digital Inverter","features":"Convertible 5-in-1, Curd Maestro","warranty":"1 Year Comprehensive + 10 Years Compressor","star_rating":"3 Star","annual_consumption":"228 kWh/year","dimensions":"637 x 555 x 1545 mm","weight":"46 kg"}'),
        ('LG 260L Double Door Smart Inverter Refrigerator', 'Smart Inverter Compressor, Auto Smart Connect, Multi Air Flow, Moist Balance Crisper', 'Refrigerator', 'LG', 'GL-I292RPZX', 'REF-LG-260L-DD-001', '8906057890123', '8418', 24000.0, 28999.0, 33999.0, 18.0, 8, 2, '{"capacity":"260 Litres","door_type":"Double Door","defrost_type":"Frost Free","compressor":"Smart Inverter","features":"Auto Smart Connect, Multi Air Flow","warranty":"1 Year Comprehensive + 10 Years Compressor","star_rating":"3 Star","annual_consumption":"198 kWh/year","dimensions":"585 x 703 x 1475 mm","weight":"50 kg"}'),
        ('Whirlpool 265L IntelliFresh Inverter Double Door Refrigerator', 'IntelliSense Inverter Technology, Adaptive Intelligence, Zeolite Technology, MicroBlock', 'Refrigerator', 'Whirlpool', 'INTELLIFRESH INV CNV 278 2S', 'REF-WHI-265L-DD-001', '8901134567890', '8418', 21000.0, 24999.0, 29999.0, 18.0, 12, 3, '{"capacity":"265 Litres","door_type":"Double Door","defrost_type":"Frost Free","compressor":"IntelliSense Inverter","features":"Adaptive Intelligence, Zeolite Technology","warranty":"1 Year Comprehensive + 10 Years Compressor","star_rating":"2 Star","annual_consumption":"245 kWh/year","dimensions":"570 x 660 x 1603 mm","weight":"52 kg"}'),
        ('Godrej 190L Single Door Direct Cool Refrigerator', 'Base Stand Drawer, Aroma Lock, Jumbo Vegetable Tray, Turbo Cooling Technology', 'Refrigerator', 'Godrej', 'RD EDGEPRO 190 CT 3.2', 'REF-GOD-190L-SD-001', '8901790123456', '8418', 12000.0, 14999.0, 17999.0, 18.0, 15, 5, '{"capacity":"190 Litres","door_type":"Single Door","defrost_type":"Direct Cool","compressor":"Standard","features":"Base Stand Drawer, Aroma Lock","warranty":"1 Year Comprehensive + 10 Years Compressor","star_rating":"3 Star","annual_consumption":"168 kWh/year","dimensions":"623 x 532 x 1254 mm","weight":"35 kg"}'),
        ('Haier 325L Bottom Mount Frost Free Refrigerator', 'Twin Inverter Technology, 360 Degree Cooling, Deo Fresh Technology, Stabilizer Free', 'Refrigerator', 'Haier', 'HRB-3404BS-E', 'REF-HAI-325L-BM-001', '6901018123456', '8418', 28000.0, 32999.0, 38999.0, 18.0, 6, 2, '{"capacity":"325 Litres","door_type":"Bottom Mount","defrost_type":"Frost Free","compressor":"Twin Inverter","features":"360 Degree Cooling, Deo Fresh","warranty":"1 Year Comprehensive + 10 Years Compressor","star_rating":"3 Star","annual_consumption":"210 kWh/year","dimensions":"595 x 660 x 1775 mm","weight":"58 kg"}'),
        ('LG 8.0 kg 5 Star Inverter Fully-Automatic Front Load Washing Machine', 'AI Direct Drive, Steam Technology, 6 Motion Direct Drive, Inverter Direct Drive Motor', 'Washing Machine', 'LG', 'FHM1408BDL', 'WM-LG-8KG-FL-001', '8906057345678', '8450', 32000.0, 38999.0, 44999.0, 18.0, 8, 2, '{"capacity":"8.0 kg","type":"Fully-Automatic Front Load","star_rating":"5 Star","motor":"Inverter Direct Drive","technology":"AI Direct Drive, Steam","wash_programs":"14","warranty":"2 Years Comprehensive + 10 Years Motor","spin_speed":"1400 RPM","dimensions":"600 x 560 x 850 mm","weight":"63 kg"}'),
        ('Samsung 7.5 kg 5 Star AI EcoBubble Front Load Washing Machine', 'AI Control, EcoBubble Technology, Hygiene Steam, Digital Inverter Motor', 'Washing Machine', 'Samsung', 'WW75T504DTW/TL', 'WM-SAM-7.5KG-FL-001', '8806090567890', '8450', 29000.0, 34999.0, 40999.0, 18.0, 10, 3, '{"capacity":"7.5 kg","type":"Fully-Automatic Front Load","star_rating":"5 Star","motor":"Digital Inverter","technology":"EcoBubble, Hygiene Steam","wash_programs":"22","warranty":"2 Years Comprehensive + 20 Years Motor","spin_speed":"1400 RPM","dimensions":"600 x 550 x 850 mm","weight":"61 kg"}'),
        ('Whirlpool 7.5 kg 5 Star Stainwash Pro Fully-Automatic Top Load', '6th Sense Technology, Hard Water Wash, ZPF Technology, Inbuilt Heater', 'Washing Machine', 'Whirlpool', '360 BW PRO (540) H 7.5 KG', 'WM-WHI-7.5KG-TL-001', '8901134789012', '8450', 18000.0, 21999.0, 25999.0, 18.0, 12, 3, '{"capacity":"7.5 kg","type":"Fully-Automatic Top Load","star_rating":"5 Star","technology":"6th Sense, Hard Water Wash","features":"ZPF Technology, Inbuilt Heater","wash_programs":"12","warranty":"2 Years Comprehensive + 10 Years Motor","spin_speed":"740 RPM","dimensions":"540 x 560 x 940 mm","weight":"32 kg"}'),
        ('IFB 6.5 kg 5 Star Aqua Conserve Fully-Automatic Front Load', 'Aqua Energie, Cradle Wash, 3D Wash System, Crescent Moon Drum', 'Washing Machine', 'IFB', 'SENATOR WSS 6510', 'WM-IFB-6.5KG-FL-001', '8901789012345', '8450', 25000.0, 29999.0, 34999.0, 18.0, 7, 2, '{"capacity":"6.5 kg","type":"Fully-Automatic Front Load","star_rating":"5 Star","technology":"Aqua Energie, 3D Wash","features":"Cradle Wash, Crescent Moon Drum","wash_programs":"14","warranty":"4 Years Comprehensive + 10 Years Motor","spin_speed":"1000 RPM","dimensions":"598 x 506 x 875 mm","weight":"65 kg"}'),
        ('Bosch 7 kg 5 Star Front Load Washing Machine', 'EcoSilence Drive, ActiveWater Plus, Anti-Vibration Design, SpeedPerfect', 'Washing Machine', 'Bosch', 'WAJ2416WIN', 'WM-BOS-7KG-FL-001', '4242005123456', '8450', 27000.0, 31999.0, 36999.0, 18.0, 6, 2, '{"capacity":"7.0 kg","type":"Fully-Automatic Front Load","star_rating":"5 Star","motor":"EcoSilence Drive","technology":"ActiveWater Plus, SpeedPerfect","features":"Anti-Vibration Design","wash_programs":"15","warranty":"2 Years Comprehensive + 12 Years Motor","spin_speed":"1200 RPM","dimensions":"598 x 590 x 848 mm","weight":"71 kg"}'),
        ('Samsung 55 inch Crystal 4K UHD Smart LED TV', 'Crystal Processor 4K, PurColor, HDR 10+, Smart Hub, Voice Assistant', 'Television', 'Samsung', 'UA55CUE70AKLXL', 'TV-SAM-55IN-4K-001', '8806090789012', '8528', 38000.0, 44999.0, 52999.0, 18.0, 8, 2, '{"screen_size":"55 inch (139 cm)","resolution":"4K UHD (3840 x 2160)","processor":"Crystal Processor 4K","display_technology":"LED","hdr":"HDR 10+","smart_tv":"Tizen OS","connectivity":"3 HDMI, 2 USB, Wi-Fi, Bluetooth","sound":"20W, Dolby Digital Plus","warranty":"1 Year Comprehensive","dimensions":"1230.5 x 706.5 x 59.9 mm (without stand)","weight":"15.5 kg"}'),
        ('LG 43 inch 4K UHD Smart LED TV', 'a5 AI Processor 4K Gen6, WebOS 23, Magic Remote, Filmmaker Mode', 'Television', 'LG', '43UR7500PSC', 'TV-LG-43IN-4K-001', '8906057567890', '8528', 26000.0, 29999.0, 34999.0, 18.0, 12, 3, '{"screen_size":"43 inch (108 cm)","resolution":"4K UHD (3840 x 2160)","processor":"a5 AI Processor 4K Gen6","display_technology":"LED","hdr":"HDR 10, HLG","smart_tv":"WebOS 23","connectivity":"2 HDMI, 1 USB, Wi-Fi, Bluetooth","sound":"20W, AI Sound","warranty":"1 Year Comprehensive","dimensions":"960 x 562 x 85.4 mm (without stand)","weight":"8.3 kg"}'),
        ('Sony Bravia 65 inch 4K UHD Google TV', 'X1 4K Processor, Live Colour, Google TV, Dolby Vision, Dolby Atmos', 'Television', 'Sony', 'KD-65X74L', 'TV-SON-65IN-4K-001', '4548736123456', '8528', 65000.0, 74999.0, 89999.0, 18.0, 5, 2, '{"screen_size":"65 inch (164 cm)","resolution":"4K UHD (3840 x 2160)","processor":"X1 4K Processor","display_technology":"LED","hdr":"Dolby Vision, HDR 10","smart_tv":"Google TV","connectivity":"4 HDMI, 2 USB, Wi-Fi, Bluetooth","sound":"20W, Dolby Atmos","warranty":"1 Year Comprehensive + 1 Year Panel","dimensions":"1452 x 836 x 70 mm (without stand)","weight":"20.8 kg"}'),
        ('OnePlus 50 inch Y Series 4K UHD Smart LED TV', 'Gamma Engine, Android TV 11, Google Assistant, Chromecast Built-in', 'Television', 'OnePlus', '50Y1S Pro', 'TV-ONE-50IN-4K-001', '6973315123456', '8528', 28000.0, 32999.0, 38999.0, 18.0, 10, 3, '{"screen_size":"50 inch (126 cm)","resolution":"4K UHD (3840 x 2160)","processor":"Gamma Engine","display_technology":"LED","hdr":"HDR 10+, HLG","smart_tv":"Android TV 11","connectivity":"3 HDMI, 2 USB, Wi-Fi, Bluetooth","sound":"24W, Dolby Audio","warranty":"1 Year Comprehensive","dimensions":"1115 x 650 x 80 mm (without stand)","weight":"9.8 kg"}'),
        ('Mi 32 inch HD Ready Smart LED TV', 'PatchWall, Android TV 11, Google Assistant, Dolby Audio', 'Television', 'Xiaomi', 'L32M7-EAIN', 'TV-XIA-32IN-HD-001', '6971408123456', '8528', 10000.0, 12999.0, 15999.0, 18.0, 20, 5, '{"screen_size":"32 inch (80 cm)","resolution":"HD Ready (1366 x 768)","processor":"Amlogic Cortex-A35","display_technology":"LED","hdr":"No","smart_tv":"Android TV 11","connectivity":"2 HDMI, 2 USB, Wi-Fi, Bluetooth","sound":"20W, Dolby Audio","warranty":"1 Year Comprehensive","dimensions":"715 x 425 x 75 mm (without stand)","weight":"3.9 kg"}'),
        ('LG 28L Convection Microwave Oven', 'Charcoal Lighting Heater, Diet Fry, Indian Roti Basket, 360 Motorised Rotisserie', 'Microwave Oven', 'LG', 'MJ2886BFUM', 'MW-LG-28L-CONV-001', '8906057789012', '8516', 14000.0, 16999.0, 19999.0, 18.0, 8, 2, '{"capacity":"28 Litres","type":"Convection","power":"1950W","features":"Charcoal Lighting Heater, Diet Fry, Rotisserie","auto_cook_menu":"251","warranty":"1 Year Comprehensive + 4 Years Magnetron","dimensions":"507 x 310 x 405 mm","weight":"17 kg"}'),
        ('Samsung 28L Convection Microwave Oven', 'Slim Fry, Tandoor Technology, Curd Making, Ceramic Enamel Cavity', 'Microwave Oven', 'Samsung', 'CE1041DSB2/TL', 'MW-SAM-28L-CONV-001', '8806090890123', '8516', 12000.0, 14999.0, 17999.0, 18.0, 10, 3, '{"capacity":"28 Litres","type":"Convection","power":"1400W","features":"Slim Fry, Tandoor Technology, Curd Making","auto_cook_menu":"200","warranty":"1 Year Comprehensive + 10 Years Cavity","dimensions":"517 x 310 x 474 mm","weight":"16 kg"}'),
        ('Kent Grand Plus 8L RO + UV + UF + TDS Water Purifier', 'Mineral RO Technology, UV LED in Tank, Zero Water Wastage, TDS Controller', 'Water Purifier', 'Kent', 'Grand Plus', 'WP-KEN-8L-RO-001', '8901789345678', '8421', 15000.0, 17999.0, 21999.0, 18.0, 12, 3, '{"capacity":"8 Litres","purification":"RO + UV + UF + TDS","technology":"Mineral RO, UV LED in Tank","features":"Zero Water Wastage, TDS Controller","purification_capacity":"20 L/hr","warranty":"1 Year Comprehensive + 3 Years Free Service","dimensions":"410 x 260 x 520 mm","weight":"9.4 kg"}'),
        ('Aquaguard Aura 7L RO + UV + UF + MTDS Water Purifier', 'Active Copper Technology, Mineral Guard, UV E-Boiling, Smart LED Indicator', 'Water Purifier', 'Aquaguard', 'Aura', 'WP-AQU-7L-RO-001', '8901790567890', '8421', 13000.0, 15499.0, 18999.0, 18.0, 15, 4, '{"capacity":"7 Litres","purification":"RO + UV + UF + MTDS","technology":"Active Copper, Mineral Guard","features":"UV E-Boiling, Smart LED Indicator","purification_capacity":"15 L/hr","warranty":"1 Year Comprehensive","dimensions":"316 x 251 x 462 mm","weight":"7.5 kg"}'),
        ('Crompton Energion HS 1200mm BLDC Ceiling Fan', 'BLDC Motor, 5 Star Rated, Remote Control, Underlight Option, 35W Power', 'Fan', 'Crompton', 'Energion HS', 'FAN-CRO-1200-BLDC-001', '8901789789012', '8414', 2800.0, 3499.0, 4299.0, 18.0, 25, 8, '{"sweep":"1200 mm","motor_type":"BLDC","star_rating":"5 Star","power_consumption":"35W","speed":"370 RPM","air_delivery":"230 CMM","features":"Remote Control, Underlight Option","warranty":"5 Years","dimensions":"1200 x 1200 x 300 mm","weight":"4.2 kg"}'),
        ('Orient Electric Aeroquiet 1200mm BLDC Ceiling Fan', 'Aeroquiet Series, BLDC Motor, Remote Control, 32W Power, 5 Star', 'Fan', 'Orient Electric', 'Aeroquiet', 'FAN-ORI-1200-BLDC-001', '8901790123456', '8414', 2500.0, 2999.0, 3699.0, 18.0, 20, 6, '{"sweep":"1200 mm","motor_type":"BLDC","star_rating":"5 Star","power_consumption":"32W","speed":"360 RPM","air_delivery":"220 CMM","features":"Remote Control, Silent Operation","warranty":"5 Years","dimensions":"1200 x 1200 x 280 mm","weight":"3.8 kg"}'),
        ('Preethi Zodiac MG 218 750W Mixer Grinder', 'Master Chef Plus Jar, 3-in-1 Insta Fresh Juicer Jar, Vega W5 Motor, 5 Jars', 'Mixer Grinder', 'Preethi', 'Zodiac MG 218', 'MG-PRE-750W-5J-001', '8901789123456', '8509', 6500.0, 7999.0, 9499.0, 18.0, 15, 5, '{"power":"750W","motor":"Vega W5","jars":"5 (1.5L, 1.0L, 0.5L, 0.4L, 0.3L)","features":"Master Chef Plus, Insta Fresh Juicer","speed_control":"3 Speed + Pulse","warranty":"2 Years Comprehensive + 5 Years Motor","dimensions":"380 x 230 x 290 mm","weight":"6.2 kg"}'),
        ('Bajaj Rex 500W Mixer Grinder', 'Titan Motor, 3 Stainless Steel Jars, Multi-Functional Blade System', 'Mixer Grinder', 'Bajaj', 'Rex 500', 'MG-BAJ-500W-3J-001', '8901790234567', '8509', 1800.0, 2199.0, 2699.0, 18.0, 25, 8, '{"power":"500W","motor":"Titan","jars":"3 (1.2L, 0.8L, 0.3L)","features":"Multi-Functional Blade System","speed_control":"3 Speed","warranty":"2 Years","dimensions":"310 x 200 x 260 mm","weight":"3.1 kg"}'),
        ('AO Smith HSE-SHS-015 15L Storage Water Heater', 'Blue Diamond Glass Lined Tank, BEE 5 Star Rated, Long-Lasting Anode Rod', 'Geyser', 'AO Smith', 'HSE-SHS-015', 'GEY-AOS-15L-STR-001', '8901790345678', '8516', 8000.0, 9999.0, 11999.0, 18.0, 10, 3, '{"capacity":"15 Litres","type":"Storage","star_rating":"5 Star","tank":"Blue Diamond Glass Lined","power":"2000W","pressure_rating":"8 bar","warranty":"2 Years Comprehensive + 7 Years Tank","dimensions":"350 x 350 x 380 mm","weight":"11 kg"}'),
        ('Bajaj New Shakti Neo 15L Storage Water Heater', 'Glassline Inner Tank, Swirl Flow Technology, PUF Insulation, 4 Star', 'Geyser', 'Bajaj', 'New Shakti Neo', 'GEY-BAJ-15L-STR-001', '8901790456789', '8516', 5500.0, 6499.0, 7999.0, 18.0, 15, 5, '{"capacity":"15 Litres","type":"Storage","star_rating":"4 Star","tank":"Glassline Inner Tank","power":"2000W","pressure_rating":"8 bar","warranty":"2 Years Comprehensive + 5 Years Tank","dimensions":"340 x 340 x 370 mm","weight":"9.5 kg"}'),
        ('Dyson V12 Detect Slim Cordless Vacuum Cleaner', 'Laser Dust Detection, Piezo Sensor, LCD Screen, 60 Min Run Time, HEPA Filtration', 'Vacuum Cleaner', 'Dyson', 'V12 Detect Slim', 'VC-DYS-V12-SLIM-001', '5025155123456', '8508', 45000.0, 52999.0, 61999.0, 18.0, 5, 2, '{"type":"Cordless Stick","suction_power":"150 AW","run_time":"60 minutes","features":"Laser Dust Detection, Piezo Sensor, LCD Screen","filtration":"HEPA","bin_capacity":"0.35 L","warranty":"2 Years","dimensions":"252 x 250 x 1100 mm","weight":"2.2 kg"}'),
        ('Eureka Forbes Quick Clean DX 1200W Vacuum Cleaner', 'Bagless, HEPA Filter, Multiple Accessories, 1.5L Dust Cup', 'Vacuum Cleaner', 'Eureka Forbes', 'Quick Clean DX', 'VC-EF-1200W-BG-001', '8901790567890', '8508', 3500.0, 4299.0, 5299.0, 18.0, 12, 4, '{"type":"Canister","power":"1200W","features":"Bagless, HEPA Filter","dust_capacity":"1.5 L","cord_length":"5 m","warranty":"1 Year","dimensions":"380 x 280 x 260 mm","weight":"3.5 kg"}'),
        ('Philips HD4928/01 2100W Induction Cooktop', 'Auto-Off Program, 6 Preset Cooking Menus, Touch Start, 0 to 3 Hours Time Setting', 'Induction Cooktop', 'Philips', 'HD4928/01', 'IC-PHI-2100W-001', '8710103123456', '8516', 2800.0, 3499.0, 4299.0, 18.0, 15, 5, '{"power":"2100W","cooking_menus":"6 Preset","features":"Auto-Off, Touch Start, Timer","timer":"0 to 3 Hours","warranty":"1 Year","dimensions":"281 x 356 x 65 mm","weight":"2.5 kg"}'),
        ('Prestige PIC 20.0 1200W Induction Cooktop', 'Indian Menu Options, Automatic Voltage Regulator, Anti-Magnetic Wall', 'Induction Cooktop', 'Prestige', 'PIC 20.0', 'IC-PRE-1200W-001', '8901790678901', '8516', 1800.0, 2199.0, 2699.0, 18.0, 20, 6, '{"power":"1200W","cooking_menus":"Indian Menu Options","features":"Automatic Voltage Regulator, Anti-Magnetic Wall","warranty":"1 Year","dimensions":"270 x 340 x 60 mm","weight":"2.1 kg"}'),
        ('Samsung Galaxy S24 Ultra 5G (12GB + 256GB)', 'Snapdragon 8 Gen 3, 200MP Camera, S Pen, 6.8 inch QHD+ AMOLED, 5000mAh', 'Mobile Phone', 'Samsung', 'SM-S928BZKCINS', 'MP-SAM-S24U-12GB-001', '8806090901234', '8517', 105000.0, 119999.0, 134999.0, 18.0, 8, 2, '{"display":"6.8 inch QHD+ Dynamic AMOLED 2X","processor":"Snapdragon 8 Gen 3","ram":"12 GB","storage":"256 GB","rear_camera":"200MP + 50MP + 12MP + 10MP","front_camera":"12MP","battery":"5000 mAh","os":"Android 14","connectivity":"5G, Wi-Fi 7, Bluetooth 5.3","warranty":"1 Year","dimensions":"162.3 x 79.0 x 8.6 mm","weight":"233 g"}'),
        ('iPhone 15 Pro Max (256GB) - Natural Titanium', 'A17 Pro Chip, 48MP Camera System, Titanium Design, Action Button', 'Mobile Phone', 'Apple', 'MU793HN/A', 'MP-APP-15PM-256GB-001', '1959490123456', '8517', 140000.0, 159900.0, 179900.0, 18.0, 6, 2, '{"display":"6.7 inch Super Retina XDR OLED","processor":"A17 Pro","ram":"8 GB","storage":"256 GB","rear_camera":"48MP + 12MP + 12MP","front_camera":"12MP","battery":"4422 mAh","os":"iOS 17","connectivity":"5G, Wi-Fi 6E, Bluetooth 5.3","warranty":"1 Year","dimensions":"159.9 x 76.7 x 8.25 mm","weight":"221 g"}'),
        ('Redmi Note 13 Pro+ 5G (8GB + 256GB)', 'MediaTek Dimensity 7200-Ultra, 200MP Camera, 120W HyperCharge, 1.5K AMOLED', 'Mobile Phone', 'Xiaomi', '23090RA98I', 'MP-XIA-N13P-8GB-001', '6971408901234', '8517', 26000.0, 29999.0, 34999.0, 18.0, 15, 5, '{"display":"6.67 inch 1.5K AMOLED","processor":"Dimensity 7200-Ultra","ram":"8 GB","storage":"256 GB","rear_camera":"200MP + 8MP + 2MP","front_camera":"16MP","battery":"5000 mAh","charging":"120W HyperCharge","os":"MIUI 14 (Android 13)","connectivity":"5G, Wi-Fi 6, Bluetooth 5.3","warranty":"1 Year","dimensions":"161.4 x 74.2 x 8.9 mm","weight":"199 g"}'),
        ('OnePlus 12 5G (12GB + 256GB) - Flowy Emerald', 'Snapdragon 8 Gen 3, Hasselblad Camera, 5400mAh, 100W SUPERVOOC', 'Mobile Phone', 'OnePlus', 'CPH2581', 'MP-ONE-12-12GB-001', '6973315901234', '8517', 58000.0, 64999.0, 74999.0, 18.0, 10, 3, '{"display":"6.82 inch 2K AMOLED ProXDR","processor":"Snapdragon 8 Gen 3","ram":"12 GB","storage":"256 GB","rear_camera":"50MP + 48MP + 64MP Hasselblad","front_camera":"32MP","battery":"5400 mAh","charging":"100W SUPERVOOC, 50W Wireless","os":"OxygenOS 14 (Android 14)","connectivity":"5G, Wi-Fi 7, Bluetooth 5.4","warranty":"1 Year","dimensions":"163.3 x 75.8 x 9.15 mm","weight":"220 g"}'),
        ('HP Pavilion 15 13th Gen Intel Core i5 Laptop', 'i5-1340P, 16GB RAM, 512GB SSD, 15.6 inch FHD, Intel Iris Xe, Backlit Keyboard', 'Laptop', 'HP', '15-eg3039TU', 'LP-HP-15-I5-16GB-001', '1951220123456', '8471', 52000.0, 59999.0, 69999.0, 18.0, 8, 2, '{"display":"15.6 inch FHD (1920 x 1080)","processor":"Intel Core i5-1340P","ram":"16 GB DDR4","storage":"512 GB SSD","graphics":"Intel Iris Xe","os":"Windows 11 Home","features":"Backlit Keyboard, Fingerprint Reader","connectivity":"Wi-Fi 6, Bluetooth 5.3","warranty":"1 Year","dimensions":"360 x 234 x 17.9 mm","weight":"1.75 kg"}'),
        ('Dell Inspiron 15 Intel Core i5 12th Gen Laptop', 'i5-1235U, 16GB RAM, 512GB SSD, 15.6 inch FHD, Intel UHD, FHD Webcam', 'Laptop', 'Dell', 'Inspiron 3520', 'LP-DEL-15-I5-16GB-001', '8841163123456', '8471', 48000.0, 54999.0, 63999.0, 18.0, 10, 3, '{"display":"15.6 inch FHD (1920 x 1080)","processor":"Intel Core i5-1235U","ram":"16 GB DDR4","storage":"512 GB SSD","graphics":"Intel UHD","os":"Windows 11 Home","features":"FHD Webcam, ExpressCharge","connectivity":"Wi-Fi 6, Bluetooth 5.2","warranty":"1 Year","dimensions":"358 x 235 x 18.9 mm","weight":"1.65 kg"}'),
        ('Lenovo IdeaPad Slim 3 Intel Core i3 12th Gen Laptop', 'i3-1215U, 8GB RAM, 512GB SSD, 15.6 inch FHD, Intel UHD, Dolby Audio', 'Laptop', 'Lenovo', '82RK00VVIN', 'LP-LEN-15-I3-8GB-001', '1953487123456', '8471', 32000.0, 36999.0, 42999.0, 18.0, 15, 5, '{"display":"15.6 inch FHD (1920 x 1080)","processor":"Intel Core i3-1215U","ram":"8 GB DDR4","storage":"512 GB SSD","graphics":"Intel UHD","os":"Windows 11 Home","features":"Dolby Audio, Rapid Charge","connectivity":"Wi-Fi 5, Bluetooth 5.1","warranty":"1 Year","dimensions":"359 x 236 x 19.9 mm","weight":"1.63 kg"}'),
        ('MacBook Air M3 (13-inch, 8GB + 256GB)', 'Apple M3 Chip, 13.6 inch Liquid Retina, 18 Hours Battery, MagSafe 3', 'Laptop', 'Apple', 'MRXN3HN/A', 'LP-APP-MBA-M3-8GB-001', '1959490234567', '8471', 95000.0, 109900.0, 124900.0, 18.0, 6, 2, '{"display":"13.6 inch Liquid Retina (2560 x 1664)","processor":"Apple M3","ram":"8 GB Unified Memory","storage":"256 GB SSD","graphics":"10-core GPU","os":"macOS Sonoma","features":"MagSafe 3, Touch ID","connectivity":"Wi-Fi 6E, Bluetooth 5.3","warranty":"1 Year","dimensions":"304.1 x 215 x 11.3 mm","weight":"1.24 kg"}'),
        ('Sony WH-1000XM5 Wireless Noise Cancelling Headphones', 'Industry-Leading Noise Cancellation, 30hr Battery, Quick Charge, Speak-to-Chat', 'Headphone & Speaker', 'Sony', 'WH-1000XM5', 'HS-SON-WH1000XM5-001', '4548736234567', '8518', 26000.0, 29999.0, 34999.0, 18.0, 10, 3, '{"type":"Over-Ear Wireless","connectivity":"Bluetooth 5.2, NFC","features":"Industry-Leading ANC, Speak-to-Chat","battery":"30 hours","quick_charge":"3 min = 3 hours","warranty":"1 Year","dimensions":"254 x 195 x 80 mm","weight":"250 g"}'),
        ('JBL Tune 760NC Wireless Over-Ear ANC Headphones', 'Active Noise Cancellation, 50hr Battery, Multi-Point Connection, Voice Assistant', 'Headphone & Speaker', 'JBL', 'Tune 760NC', 'HS-JBL-T760NC-001', '0500363123456', '8518', 5500.0, 6499.0, 7999.0, 18.0, 15, 5, '{"type":"Over-Ear Wireless","connectivity":"Bluetooth 5.0","features":"ANC, Multi-Point Connection","battery":"50 hours","quick_charge":"5 min = 2 hours","warranty":"1 Year","dimensions":"195 x 175 x 75 mm","weight":"220 g"}'),
        ('boAt Stone 1200 14W Portable Bluetooth Speaker', '14W Output, IPX7 Waterproof, 9hr Battery, RGB LEDs, TWS Mode', 'Headphone & Speaker', 'boAt', 'Stone 1200', 'SP-BOA-STONE1200-001', '8904134123457', '8518', 2800.0, 3499.0, 4299.0, 18.0, 20, 6, '{"type":"Portable Bluetooth","output":"14W","features":"IPX7 Waterproof, RGB LEDs, TWS Mode","battery":"9 hours","connectivity":"Bluetooth 5.0, AUX","warranty":"1 Year","dimensions":"175 x 80 x 80 mm","weight":"650 g"}'),
        ('Canon EOS R50 Mirrorless Camera with RF-S 18-45mm Lens', '24.2MP APS-C CMOS, 4K Video, Dual Pixel CMOS AF II, Vari-Angle Touch Screen', 'Camera', 'Canon', 'EOS R50', 'CAM-CAN-R50-KIT-001', '4549292123456', '9006', 52000.0, 59999.0, 69999.0, 18.0, 5, 2, '{"sensor":"24.2MP APS-C CMOS","video":"4K UHD at 30p","autofocus":"Dual Pixel CMOS AF II","screen":"3.0 inch Vari-Angle Touch","connectivity":"Wi-Fi, Bluetooth","battery":"LP-E17 (approx 370 shots)","warranty":"2 Years","dimensions":"116.3 x 85.5 x 68.8 mm","weight":"375 g (body only)"}'),
        ('Sony Alpha ZV-E10 Mirrorless Camera Body', '24.2MP APS-C, 4K Video, Real-time Eye AF, Product Showcase Setting, Directional Mic', 'Camera', 'Sony', 'ZV-E10', 'CAM-SON-ZVE10-BDY-001', '4548736345678', '9006', 48000.0, 54999.0, 62999.0, 18.0, 6, 2, '{"sensor":"24.2MP APS-C Exmor CMOS","video":"4K UHD at 30p","autofocus":"Real-time Eye AF","screen":"3.0 inch Vari-Angle Touch","connectivity":"Wi-Fi, Bluetooth","battery":"NP-FW50 (approx 440 shots)","warranty":"2 Years","dimensions":"115.2 x 64.2 x 44.8 mm","weight":"343 g (body only)"}'),
        ('Faber 90cm 1200 m3/hr Auto Clean Chimney', 'Filterless Technology, Touch Control, LED Lamps, Oil Collector, 12 Years Warranty', 'Kitchen Chimney', 'Faber', 'HOOD PRIMUS PLUS TC BK 90', 'CH-FAB-90CM-1200-001', '8901790789012', '8414', 18000.0, 21999.0, 25999.0, 18.0, 8, 2, '{"size":"90 cm","suction_capacity":"1200 m3/hr","technology":"Filterless Auto Clean","control":"Touch Control","features":"LED Lamps, Oil Collector","noise_level":"58 dB","warranty":"1 Year Comprehensive + 12 Years Motor","dimensions":"900 x 520 x 600 mm","weight":"12 kg"}'),
        ('Elica 60cm 1100 m3/hr Filterless Auto Clean Chimney', 'Motion Sensor, Touch Control, LED Lamps, Oil Collector, 5 Years Motor Warranty', 'Kitchen Chimney', 'Elica', 'WD HAC TOUCH BF 60 MS', 'CH-ELI-60CM-1100-001', '8901790890123', '8414', 12000.0, 14999.0, 17999.0, 18.0, 10, 3, '{"size":"60 cm","suction_capacity":"1100 m3/hr","technology":"Filterless Auto Clean","control":"Touch + Motion Sensor","features":"LED Lamps, Oil Collector","noise_level":"58 dB","warranty":"1 Year Comprehensive + 5 Years Motor","dimensions":"600 x 480 x 520 mm","weight":"10 kg"}'),
        ('Philips 10W B22 LED Bulb (Cool Day Light, Pack of 4)', 'EyeComfort Technology, 25000 Hours Life, Flicker-Free, No UV/IR Radiation', 'LED Bulb & Tube', 'Philips', 'Stellar Bright', 'LED-PHI-10W-B22-4PK-001', '8718696123456', '9405', 350.0, 449.0, 599.0, 5.0, 50, 15, '{"wattage":"10W","base_type":"B22","color_temperature":"6500K Cool Day Light","lifespan":"25000 hours","features":"EyeComfort, Flicker-Free","lumen_output":"1000 lm","warranty":"2 Years","pack_size":"4 bulbs"}'),
        ('Havells 20W LED Tube Light (Cool Day Light, Pack of 2)', 'Energy Efficient, 25000 Hours Life, Instant Start, No Mercury', 'LED Bulb & Tube', 'Havells', 'Adore', 'LED-HAV-20W-TUBE-2PK-001', '8901790901234', '9405', 450.0, 549.0, 699.0, 5.0, 40, 12, '{"wattage":"20W","type":"T5 Tube Light","color_temperature":"6500K Cool Day Light","lifespan":"25000 hours","features":"Energy Efficient, Instant Start","lumen_output":"2000 lm","warranty":"2 Years","pack_size":"2 tubes"}'),
        ('Samsung Galaxy Tab S9 FE+ 12.4 inch (8GB + 128GB)', 'Exynos 1380, S Pen Included, IP68, 10090mAh Battery, Dolby Atmos', 'Tablet', 'Samsung', 'SM-X610NZSAINS', 'TAB-SAM-S9FE-8GB-001', '8806090123457', '8471', 38000.0, 43999.0, 49999.0, 18.0, 8, 2, '{"display":"12.4 inch WQXGA (2560 x 1600)","processor":"Exynos 1380","ram":"8 GB","storage":"128 GB","features":"S Pen Included, IP68","battery":"10090 mAh","os":"Android 13","connectivity":"Wi-Fi, Bluetooth 5.3","warranty":"1 Year","dimensions":"285 x 185 x 6.5 mm","weight":"627 g"}'),
        ('Apple iPad Air 5th Gen 10.9 inch (64GB) - Space Grey', 'M1 Chip, Liquid Retina, Apple Pencil 2 Support, Touch ID, 12MP Ultra Wide Front', 'Tablet', 'Apple', 'MM9C3HN/A', 'TAB-APP-IPADA-64GB-001', '1959490345678', '8471', 48000.0, 54900.0, 59900.0, 18.0, 10, 3, '{"display":"10.9 inch Liquid Retina (2360 x 1640)","processor":"Apple M1","ram":"8 GB","storage":"64 GB","features":"Apple Pencil 2, Touch ID","battery":"Up to 10 hours","os":"iPadOS 16","connectivity":"Wi-Fi 6, Bluetooth 5.0","warranty":"1 Year","dimensions":"247.6 x 178.5 x 6.1 mm","weight":"461 g"}'),
        ('Luminous Zelio+ 1100 Pure Sine Wave Inverter with RC18000 Battery', 'Pure Sine Wave, 900VA Capacity, 150Ah Battery, Low Maintenance', 'Inverter & Battery', 'Luminous', 'Zelio+ 1100 + RC18000', 'INV-LUM-Z1100-RC18-001', '8901791012345', '8504', 18000.0, 21999.0, 25999.0, 18.0, 8, 2, '{"inverter_capacity":"900VA / 720W","battery_capacity":"150Ah","waveform":"Pure Sine Wave","backup_time":"4-6 hours (typical load)","features":"LCD Display, MCB Protection","battery_type":"Tubular Lead Acid","warranty":"2 Years Inverter + 3 Years Battery","dimensions":"300 x 250 x 180 mm (inverter)","weight":"12 kg (inverter)"}'),
        ('Microtek UPS SEBz 1100VA Pure Sine Wave Inverter', 'Pure Sine Wave, 1100VA, Intelli Pure Sinewave Technology, LCD Display', 'Inverter & Battery', 'Microtek', 'UPS SEBz 1100', 'INV-MIC-SEBz1100-001', '8901791123456', '8504', 6500.0, 7999.0, 9499.0, 18.0, 12, 4, '{"inverter_capacity":"1100VA","waveform":"Pure Sine Wave","features":"Intelli Pure Sinewave, LCD Display","protection":"Overload, Short Circuit","battery_compatibility":"12V","warranty":"2 Years","dimensions":"280 x 220 x 160 mm","weight":"8.5 kg"}'),
        ('Philips GC1905 1440W Steam Iron', 'American Heritage Soleplate, 15g/min Continuous Steam, 90g Steam Boost, Spray', 'Iron', 'Philips', 'GC1905', 'IRN-PHI-GC1905-001', '8710103234567', '8516', 1200.0, 1499.0, 1799.0, 18.0, 20, 6, '{"power":"1440W","soleplate":"American Heritage","steam_output":"15g/min continuous, 90g boost","features":"Spray, Drip Stop","water_tank":"180 ml","warranty":"2 Years","dimensions":"290 x 120 x 140 mm","weight":"1.1 kg"}'),
        ('Bajaj MX-35N 2000W Steam Iron', 'Non-Stick Coated Soleplate, 22g/min Steam, Vertical Steam, Self-Cleaning', 'Iron', 'Bajaj', 'MX-35N', 'IRN-BAJ-MX35N-001', '8901791234567', '8516', 800.0, 999.0, 1199.0, 18.0, 25, 8, '{"power":"2000W","soleplate":"Non-Stick Coated","steam_output":"22g/min","features":"Vertical Steam, Self-Cleaning","water_tank":"220 ml","warranty":"2 Years","dimensions":"280 x 115 x 135 mm","weight":"1.2 kg"}'),
        ('Bajaj Majesty RX11 2000W Room Heater', '2 Heat Settings, Adjustable Thermostat, Safety Thermal Cut-Out, Cool Touch Body', 'Heater', 'Bajaj', 'Majesty RX11', 'HT-BAJ-RX11-2000W-001', '8901791345678', '8516', 2200.0, 2699.0, 3299.0, 18.0, 15, 5, '{"power":"2000W","heat_settings":"2 (1000W / 2000W)","features":"Adjustable Thermostat, Thermal Cut-Out","safety":"Cool Touch Body, Tip-Over Switch","warranty":"2 Years","dimensions":"380 x 140 x 300 mm","weight":"2.5 kg"}'),
        ('Havells Calido PTC 2000W Room Heater', 'PTC Heating Element, 2 Heat Settings, Oscillation, Remote Control, LED Display', 'Heater', 'Havells', 'Calido PTC', 'HT-HAV-CALIDO-2000W-001', '8901791456789', '8516', 4500.0, 5499.0, 6499.0, 18.0, 10, 3, '{"power":"2000W","heating_element":"PTC","heat_settings":"2","features":"Oscillation, Remote Control, LED Display","safety":"Overheat Protection, Tip-Over Switch","warranty":"2 Years","dimensions":"300 x 180 x 550 mm","weight":"3.8 kg"}')
    ];

    let inserted = 0;
    for (const p of products) {
        try {
            const cgst = p[10] / 2;
            const sgst = p[10] / 2;
            const igst = p[10];
            await db.execute(
                `INSERT INTO products (name, description, category_id, brand, model, sku, barcode, hsn_code,
                 purchase_price, selling_price, mrp, gst_rate, cgst_rate, sgst_rate, igst_rate,
                 quantity, min_stock, unit, specifications)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [p[0], p[1], catMap[p[2]], p[3], p[4], p[5], p[6], p[7],
                 p[8], p[9], p[10], p[11], cgst, sgst, igst,
                 p[12], p[13], 'piece', p[14]]
            );
            inserted++;
        } catch (e) {
            console.error(`Error inserting product ${p[5]}:`, e.message);
        }
    }

    console.log(`✅ Seeded ${inserted} products successfully`);
}

module.exports = initializeDatabase;
