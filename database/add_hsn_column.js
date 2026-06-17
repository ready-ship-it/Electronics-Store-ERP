const db = require('../utils/database');

async function addHsnColumn() {
    try {
        console.log('Checking for HSN column...');
        const [columns] = await db.execute('SHOW COLUMNS FROM products LIKE "hsn_code"');
        
        if (columns.length === 0) {
            console.log('Adding hsn_code column to products table...');
            await db.execute('ALTER TABLE products ADD COLUMN hsn_code VARCHAR(20) AFTER model');
            console.log('✅ HSN column added successfully');
        } else {
            console.log('✅ HSN column already exists');
        }
    } catch (error) {
        console.error('❌ Error adding HSN column:', error);
        throw error;
    }
}

if (require.main === module) {
    addHsnColumn().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = addHsnColumn;
