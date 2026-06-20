const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

/**
 * Product Search Scraper for Indian E-commerce Sites
 * Searches Khosla Online, Flipkart, Amazon for home appliance products
 */

class ProductSearchScraper {
    constructor() {
        this.browser = null;
        this.results = [];
    }

    async initBrowser() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });
        }
    }

    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    /**
     * Search all platforms
     */
    async searchAll(query, limit = 10) {
        const results = {
            khosla: [],
            flipkart: [],
            amazon: [],
            errors: []
        };

        try {
            await this.initBrowser();

            // Search Khosla Online
            try {
                results.khosla = await this.searchKhosla(query, limit);
            } catch (err) {
                results.errors.push({ platform: 'khosla', error: err.message });
            }

            // Search Flipkart
            try {
                results.flipkart = await this.searchFlipkart(query, limit);
            } catch (err) {
                results.errors.push({ platform: 'flipkart', error: err.message });
            }

            // Search Amazon India
            try {
                results.amazon = await this.searchAmazon(query, limit);
            } catch (err) {
                results.errors.push({ platform: 'amazon', error: err.message });
            }

        } finally {
            await this.closeBrowser();
        }

        return results;
    }

    /**
     * Search Khosla Online (https://www.khoslaonline.com)
     */
    async searchKhosla(query, limit = 10) {
        const page = await this.browser.newPage();
        const products = [];

        try {
            // Set user agent to avoid detection
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Navigate to search page
            const searchUrl = `https://www.khoslaonline.com/catalogsearch/result/?q=${encodeURIComponent(query)}`;
            await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

            // Wait for product grid to load
            await page.waitForSelector('.product-item-info, .product-item', { timeout: 10000 }).catch(() => {});

            // Extract product data
            products.push(...await page.evaluate((limit) => {
                const items = document.querySelectorAll('.product-item-info, .product-item');
                const results = [];

                items.forEach((item, index) => {
                    if (index >= limit) return;

                    const nameEl = item.querySelector('.product-item-link, .product-name a');
                    const priceEl = item.querySelector('.price, .product-price');
                    const imageEl = item.querySelector('.product-image-photo, img');
                    const linkEl = item.querySelector('a.product-item-photo, a.product-image');

                    const name = nameEl ? nameEl.textContent.trim() : '';
                    const priceText = priceEl ? priceEl.textContent.trim() : '';
                    const price = this.extractPrice(priceText);
                    const image = imageEl ? imageEl.src : '';
                    const link = linkEl ? linkEl.href : '';

                    // Try to extract brand from name
                    const brand = name.split(' ')[0] || '';

                    if (name) {
                        results.push({
                            name,
                            brand,
                            price,
                            mrp: price,
                            image,
                            link,
                            source: 'khosla',
                            platform: 'Khosla Online',
                            barcode: null // Will need to visit product page
                        });
                    }
                });

                return results;
            }, limit));

            // If no products found with JS, try cheerio fallback
            if (products.length === 0) {
                const html = await page.content();
                const $ = cheerio.load(html);

                $('.product-item-info, .product-item').each((i, el) => {
                    if (i >= limit) return;

                    const name = $(el).find('.product-item-link, .product-name a').text().trim();
                    const priceText = $(el).find('.price, .product-price').text().trim();
                    const price = this.extractPrice(priceText);
                    const image = $(el).find('.product-image-photo, img').attr('src') || '';
                    const link = $(el).find('a.product-item-photo, a.product-image').attr('href') || '';

                    if (name) {
                        products.push({
                            name,
                            brand: name.split(' ')[0],
                            price,
                            mrp: price,
                            image,
                            link: link.startsWith('http') ? link : 'https://www.khoslaonline.com' + link,
                            source: 'khosla',
                            platform: 'Khosla Online',
                            barcode: null
                        });
                    }
                });
            }

        } catch (error) {
            console.error('Khosla search error:', error);
        } finally {
            await page.close();
        }

        return products;
    }

    /**
     * Search Flipkart
     */
    async searchFlipkart(query, limit = 10) {
        const page = await this.browser.newPage();
        const products = [];

        try {
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            const searchUrl = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
            await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

            // Wait for product listings
            await page.waitForSelector('._1AtVbE, ._4ddWXP, .CXW8mj', { timeout: 10000 }).catch(() => {});

            products.push(...await page.evaluate((limit) => {
                const items = document.querySelectorAll('._1AtVbE, ._4ddWXP');
                const results = [];

                items.forEach((item, index) => {
                    if (index >= limit) return;

                    const nameEl = item.querySelector('._4rR01T, .s1Q9rs, ._2WkVRV');
                    const priceEl = item.querySelector('._30jeq3, ._1_WHN1');
                    const mrpEl = item.querySelector('._3I9_wc, ._3Ay6Sb');
                    const imageEl = item.querySelector('._396cs4, ._2r_T1I');
                    const linkEl = item.querySelector('a._1fQZEK, a._2rpwqI');

                    const name = nameEl ? nameEl.textContent.trim() : '';
                    const priceText = priceEl ? priceEl.textContent.trim() : '';
                    const price = this.extractPrice(priceText);
                    const mrpText = mrpEl ? mrpEl.textContent.trim() : '';
                    const mrp = this.extractPrice(mrpText) || price;
                    const image = imageEl ? imageEl.src : '';
                    const link = linkEl ? 'https://www.flipkart.com' + linkEl.getAttribute('href') : '';

                    // Extract brand from name
                    const brandMatch = name.match(/^([A-Za-z]+)/);
                    const brand = brandMatch ? brandMatch[1] : '';

                    if (name && price > 0) {
                        results.push({
                            name,
                            brand,
                            price,
                            mrp,
                            image,
                            link,
                            source: 'flipkart',
                            platform: 'Flipkart',
                            barcode: null
                        });
                    }
                });

                return results;
            }, limit));

        } catch (error) {
            console.error('Flipkart search error:', error);
        } finally {
            await page.close();
        }

        return products;
    }

    /**
     * Search Amazon India
     */
    async searchAmazon(query, limit = 10) {
        const page = await this.browser.newPage();
        const products = [];

        try {
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            const searchUrl = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
            await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

            // Wait for search results
            await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 10000 }).catch(() => {});

            products.push(...await page.evaluate((limit) => {
                const items = document.querySelectorAll('[data-component-type="s-search-result"]');
                const results = [];

                items.forEach((item, index) => {
                    if (index >= limit) return;

                    const nameEl = item.querySelector('h2 a span, .a-size-mini span');
                    const priceEl = item.querySelector('.a-price-whole, .a-price .a-offscreen');
                    const mrpEl = item.querySelector('.a-text-price .a-offscreen');
                    const imageEl = item.querySelector('.s-image');
                    const linkEl = item.querySelector('h2 a');

                    const name = nameEl ? nameEl.textContent.trim() : '';
                    const priceText = priceEl ? priceEl.textContent.trim() : '';
                    const price = this.extractPrice(priceText);
                    const mrpText = mrpEl ? mrpEl.textContent.trim() : '';
                    const mrp = this.extractPrice(mrpText) || price;
                    const image = imageEl ? imageEl.src : '';
                    const link = linkEl ? 'https://www.amazon.in' + linkEl.getAttribute('href') : '';

                    // Extract brand
                    const brandMatch = name.match(/^([A-Za-z]+)/);
                    const brand = brandMatch ? brandMatch[1] : '';

                    if (name) {
                        results.push({
                            name,
                            brand,
                            price,
                            mrp,
                            image,
                            link,
                            source: 'amazon',
                            platform: 'Amazon',
                            barcode: null
                        });
                    }
                });

                return results;
            }, limit));

        } catch (error) {
            console.error('Amazon search error:', error);
        } finally {
            await page.close();
        }

        return products;
    }

    /**
     * Extract numeric price from text
     */
    extractPrice(priceText) {
        if (!priceText) return 0;
        const match = priceText.replace(/,/g, '').match(/[\d,]+\.?\d*/);
        return match ? parseFloat(match[0].replace(/,/g, '')) : 0;
    }

    /**
     * Get product details (for barcode extraction)
     */
    async getProductDetails(url, source) {
        const page = await this.browser.newPage();
        let details = { barcode: null, description: '', specifications: {} };

        try {
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

            // Wait for page to load
            await page.waitForTimeout(3000);

            const html = await page.content();
            const $ = cheerio.load(html);

            // Try to find barcode/ISBN/ASIN
            const barcodePatterns = [
                /ISBN[\s-]*([\d-]+)/i,
                /ASIN[\s:]*([A-Z0-9]+)/i,
                /Barcode[\s:]*([\d]+)/i,
                /EAN[\s:]*([\d]+)/i,
                /UPC[\s:]*([\d]+)/i
            ];

            const pageText = $('body').text();
            for (const pattern of barcodePatterns) {
                const match = pageText.match(pattern);
                if (match) {
                    details.barcode = match[1].replace(/-/g, '');
                    break;
                }
            }

            // Extract description
            details.description = $('.product-description, #productDescription, .a-unordered-list').first().text().trim().substring(0, 500);

        } catch (error) {
            console.error('Product details error:', error);
        } finally {
            await page.close();
        }

        return details;
    }
}

module.exports = new ProductSearchScraper();
