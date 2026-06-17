const db = require('../utils/database');
const fs = require('fs');
const path = require('path');

async function seedProducts() {
    try {
        console.log('Starting product seeding...');
        
        // Load products from the generated JSON
        const productsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../../products_final.json'), 'utf8'));
        
        // Get existing categories to map names to IDs
        const [categories] = await db.execute('SELECT id, name FROM categories');
        const categoryMap = {};
        categories.forEach(cat => {
            categoryMap[cat.name] = cat.id;
        });

        for (const product of productsData) {
            let categoryId = categoryMap[product.category];
            
            // If category doesn't exist, create it
            if (!categoryId) {
                const [result] = await db.execute(
                    'INSERT INTO categories (name, description) VALUES (?, ?)',
                    [product.category, `${product.category} category`]
                );
                categoryId = result.insertId;
                categoryMap[product.category] = categoryId;
                console.log(`Created new category: ${product.category}`);
            }

            // Insert product
            try {
                await db.execute(
                    `INSERT INTO products (
                        name, description, category_id, brand, model, hsn_code, sku, 
                        purchase_price, selling_price, mrp, specifications, quantity,
                        gst_rate, unit, is_active
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        product.name,
                        product.name,
                        categoryId,
                        product.brand,
                        product.model,
                        product.specifications.hsn_code,
                        product.sku,
                        product.price * 0.8, // Estimate purchase price as 80% of selling
                        product.price,
                        product.mrp,
                        JSON.stringify(product.specifications),
                        10, // Default stock
                        18.00, // Default GST rate
                        'piece',
                        true
                    ]
                );
                console.log(`Seeded product: ${product.name}`);
            } catch (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    console.log(`Skipping duplicate product: ${product.name}`);
                } else {
                    console.error(`Error seeding product ${product.name}:`, err);
                }
            }
        }

        console.log('✅ Product seeding completed successfully');
    } catch (error) {
        console.error('❌ Seeding error:', error);
        process.exit(1);
    }
}

// Run the seeder if called directly
if (require.main === module) {
    seedProducts().then(() => process.exit(0));
}

module.exports = seedProducts;
