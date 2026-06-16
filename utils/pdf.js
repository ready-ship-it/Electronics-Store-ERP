const puppeteer = require('puppeteer');
const path = require('path');

class PDFService {
    async generatePDF(htmlContent, options = {}) {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();

            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20px',
                    right: '20px',
                    bottom: '20px',
                    left: '20px'
                },
                ...options
            });

            return pdfBuffer;
        } finally {
            await browser.close();
        }
    }

    async generateInvoicePDF(invoiceData) {
        const html = this.getInvoiceTemplate(invoiceData);
        return this.generatePDF(html, { format: 'A4' });
    }

    async generateReportPDF(reportData, title) {
        const html = this.getReportTemplate(reportData, title);
        return this.generatePDF(html, { format: 'A4', landscape: reportData.landscape || false });
    }

    getInvoiceTemplate(data) {
        const { sale, items, settings } = data;
        const itemsRows = items.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${item.product_name}</td>
                <td>${item.quantity}</td>
                <td>₹${item.unit_price.toFixed(2)}</td>
                <td>${item.gst_rate}%</td>
                <td>₹${item.total_price.toFixed(2)}</td>
            </tr>
        `).join('');

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #333; }
                .invoice-container { max-width: 800px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
                .header h1 { color: #2563eb; font-size: 24px; margin-bottom: 5px; }
                .header p { color: #666; font-size: 11px; }
                .invoice-details { display: flex; justify-content: space-between; margin-bottom: 20px; }
                .section { width: 48%; }
                .section h3 { color: #2563eb; font-size: 13px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
                .section p { margin-bottom: 3px; font-size: 11px; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                th { background: #2563eb; color: white; padding: 8px; text-align: left; font-size: 11px; }
                td { padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
                tr:nth-child(even) { background: #f9fafb; }
                .totals { margin-top: 15px; text-align: right; }
                .totals table { width: 300px; margin-left: auto; }
                .totals td { border: none; padding: 5px 8px; }
                .totals .grand-total { font-size: 14px; font-weight: bold; color: #2563eb; border-top: 2px solid #2563eb; }
                .footer { margin-top: 30px; text-align: center; color: #666; font-size: 10px; border-top: 1px solid #e5e7eb; padding-top: 15px; }
                .gst-info { background: #f0f9ff; padding: 10px; margin: 10px 0; border-left: 3px solid #2563eb; font-size: 10px; }
                .badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: bold; }
                .badge-paid { background: #dcfce7; color: #166534; }
                .badge-pending { background: #fef3c7; color: #92400e; }
            </style>
        </head>
        <body>
            <div class="invoice-container">
                <div class="header">
                    <h1>${settings.store_name || 'Electronics Store'}</h1>
                    <p>${settings.store_address || ''}</p>
                    <p>Phone: ${settings.store_phone || ''} | Email: ${settings.store_email || ''}</p>
                    <p>GSTIN: ${settings.store_gstin || 'N/A'} | PAN: ${settings.store_pan || 'N/A'}</p>
                </div>

                <div class="invoice-details">
                    <div class="section">
                        <h3>Bill To:</h3>
                        <p><strong>${sale.customer_name}</strong></p>
                        <p>${sale.customer_phone || ''}</p>
                        <p>${sale.customer_email || ''}</p>
                        <p>${sale.customer_address || ''}</p>
                    </div>
                    <div class="section">
                        <h3>Invoice Details:</h3>
                        <p><strong>Invoice #:</strong> ${sale.invoice_number}</p>
                        <p><strong>Date:</strong> ${new Date(sale.created_at).toLocaleDateString('en-IN')}</p>
                        <p><strong>Payment:</strong> <span class="badge badge-${sale.payment_status === 'paid' ? 'paid' : 'pending'}">${sale.payment_status.toUpperCase()}</span></p>
                        <p><strong>Method:</strong> ${sale.payment_method.toUpperCase()}</p>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Product</th>
                            <th>Qty</th>
                            <th>Unit Price</th>
                            <th>GST</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                    </tbody>
                </table>

                <div class="totals">
                    <table>
                        <tr><td>Subtotal:</td><td>₹${sale.subtotal.toFixed(2)}</td></tr>
                        <tr><td>GST Amount:</td><td>₹${sale.gst_amount.toFixed(2)}</td></tr>
                        ${sale.discount > 0 ? `<tr><td>Discount:</td><td>-₹${sale.discount.toFixed(2)}</td></tr>` : ''}
                        <tr class="grand-total"><td>Grand Total:</td><td>₹${sale.total_amount.toFixed(2)}</td></tr>
                    </table>
                </div>

                <div class="gst-info">
                    <strong>GST Summary:</strong> All prices are inclusive of applicable GST. 
                    This is a computer-generated invoice and does not require a signature.
                </div>

                <div class="footer">
                    <p>Thank you for your business!</p>
                    <p>${settings.store_name || 'Electronics Store'} | ${settings.store_address || ''}</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    getReportTemplate(data, title) {
        const { headers, rows, summary, dateRange } = data;

        const headerRow = headers.map(h => `<th>${h}</th>`).join('');
        const dataRows = rows.map(row => {
            const cells = row.map(cell => `<td>${cell}</td>`).join('');
            return `<tr>${cells}</tr>`;
        }).join('');

        const summaryHtml = summary ? `
            <div class="summary">
                ${summary.map(s => `<div class="summary-item"><strong>${s.label}:</strong> ${s.value}</div>`).join('')}
            </div>
        ` : '';

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #333; }
                .report-container { padding: 20px; }
                .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
                .header h1 { color: #2563eb; font-size: 20px; }
                .header p { color: #666; margin-top: 5px; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                th { background: #2563eb; color: white; padding: 8px; text-align: left; font-size: 10px; }
                td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
                tr:nth-child(even) { background: #f9fafb; }
                .summary { display: flex; gap: 20px; margin: 15px 0; padding: 15px; background: #f0f9ff; border-radius: 5px; }
                .summary-item { font-size: 12px; }
                .footer { margin-top: 20px; text-align: center; color: #666; font-size: 9px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
            </style>
        </head>
        <body>
            <div class="report-container">
                <div class="header">
                    <h1>${title}</h1>
                    <p>${dateRange || ''}</p>
                </div>
                ${summaryHtml}
                <table>
                    <thead><tr>${headerRow}</tr></thead>
                    <tbody>${dataRows}</tbody>
                </table>
                <div class="footer">
                    <p>Generated on ${new Date().toLocaleString('en-IN')} | Electronics Store ERP</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }
}

module.exports = new PDFService();
