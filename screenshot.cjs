const puppeteer = require('puppeteer');
const path = require('path');
const express = require('express');

// Start a simple server
const app = express();
app.use(express.static(__dirname));
const server = app.listen(0, async () => {
    const port = server.address().port;
    
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    
    await page.goto(`http://localhost:${port}/index.html`);
    
    // Wait for the game to initialize
    await new Promise(r => setTimeout(r, 2000));
    
    // Navigate to characters menu by pressing down then enter
    await page.keyboard.press('ArrowDown');
    await new Promise(r => setTimeout(r, 100));
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 500));
    
    // Take screenshot
    await page.screenshot({ path: 'characters.png' });
    
    console.log("Screenshot saved to characters.png");
    
    await browser.close();
    server.close();
    process.exit(0);
});
