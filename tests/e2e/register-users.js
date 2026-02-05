const { chromium } = require('playwright');
const CONFIG = {
    url: 'https://blind-typing-1.firebaseapp.com/login.html',
    start: 6,
    end: 15,
    password: '123456'
};

async function registerUser(i, browser) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const email = `user${i}_test@gmail.com`;
    const name = `User ${i}`; // Note: Login page doesn't ask for name during registration, might be set later or default. 
    // The current auth.js registerUser implementation might just create auth user. 
    // If name is needed, it might be a separate step, but for now we follow the UI.

    try {
        console.log(`[${name}] Registering ${email}...`);
        await page.goto(CONFIG.url);

        // Handle dialogs (alerts)
        page.on('dialog', async dialog => {
            console.log(`[${name}] Dialog: ${dialog.message()}`);
            await dialog.accept();
        });

        // Fill email and password (required for registration flow in this app)
        await page.fill('#email', email);
        await page.fill('#password', CONFIG.password);

        // Click "Create one" link
        await page.click('#registerLink');

        // Wait a bit for the alert/remote operation
        await page.waitForTimeout(5000);

        console.log(`[${name}] Registration attempt finished.`);

    } catch (e) {
        console.error(`[${name}] Error: ${e.message}`);
    } finally {
        await context.close();
    }
}

(async () => {
    const browser = await chromium.launch({ headless: false });
    console.log("Starting Registration for users 6-15...");

    // Run sequentially or in small batches to avoid rate limits or race conditions if any
    for (let i = CONFIG.start; i <= CONFIG.end; i++) {
        await registerUser(i, browser);
        await new Promise(r => setTimeout(r, 1000)); // Slight delay between registrations
    }

    console.log("Registration process complete.");
    await browser.close();
})();
