const puppeteer = require('puppeteer');
const fs = require('fs');
(async () => {
    try {
        const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent('<html><body><h1>Test PDF</h1><p>This is a test PDF.</p></body></html>', { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({ format: 'A4', printBackground: true });
        fs.writeFileSync('test.pdf', pdf);
        console.log('WROTE', pdf.length);
        await browser.close();
    } catch (err) {
        console.error('Test failed:', err);
        process.exit(1);
    }
})();
