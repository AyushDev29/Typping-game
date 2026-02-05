const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    url: 'https://blind-typing-1.firebaseapp.com',
    roomCode: 'WIVLTG', // To be updated
    password: '123456',

    // 15 Users with diverse behaviors but High Accuracy & Slower Speed
    users: [
        // Existing Users (5)
        { email: 'a@gmail.com', name: 'User A', delay: 0, minDelay: 80, maxDelay: 150, errorRate: 0.0001 },
        { email: 'ayush@gmail.com', name: 'User Ayush', delay: 2000, minDelay: 90, maxDelay: 160, errorRate: 0.0001 },
        { email: 'test@test.com', name: 'User Test', delay: 5000, minDelay: 100, maxDelay: 180, errorRate: 0.0001 },
        { email: 'test2@test.com', name: 'User Test2', delay: 8000, minDelay: 110, maxDelay: 200, errorRate: 0.0001 },
        { email: 'newtesting@gmail.com', name: 'User New', delay: 10000, minDelay: 120, maxDelay: 220, errorRate: 0.0001 },

        // New Dummy Users (10) - Normalized to safer speeds
        { email: 'user6_test@gmail.com', name: 'User 6', delay: 1000, minDelay: 70, maxDelay: 140, errorRate: 0.0001 },
        { email: 'user7_test@gmail.com', name: 'User 7', delay: 12000, minDelay: 130, maxDelay: 250, errorRate: 0.0001 },
        { email: 'user8_test@gmail.com', name: 'User 8', delay: 3000, minDelay: 85, maxDelay: 155, errorRate: 0.0001 },
        { email: 'user9_test@gmail.com', name: 'User 9', delay: 15000, minDelay: 75, maxDelay: 145, errorRate: 0.0001 },
        { email: 'user10_test@gmail.com', name: 'User 10', delay: 4000, minDelay: 150, maxDelay: 300, errorRate: 0.0001 },
        { email: 'user11_test@gmail.com', name: 'User 11', delay: 6000, minDelay: 95, maxDelay: 175, errorRate: 0.0001 },
        { email: 'user12_test@gmail.com', name: 'User 12', delay: 7000, minDelay: 105, maxDelay: 195, errorRate: 0.0001 },
        { email: 'user13_test@gmail.com', name: 'User 13', delay: 9000, minDelay: 80, maxDelay: 160, errorRate: 0.0001 },
        { email: 'user14_test@gmail.com', name: 'User 14', delay: 11000, minDelay: 140, maxDelay: 280, errorRate: 0.0001 },
        { email: 'user15_test@gmail.com', name: 'User 15', delay: 100, minDelay: 80, maxDelay: 150, errorRate: 0.0001 }
    ]
};

const RESULTS_DIR = path.join(__dirname, 'results_15_users');
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

async function runUserTest(userConfig, browser) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const result = { user: userConfig.email, status: 'Failed', details: '' };

    try {
        console.log(`[${userConfig.name}] Starting...`);

        // 1. Navigation & Login Check
        const joinRoomUrl = CONFIG.url.endsWith('/') ? CONFIG.url + 'join-room.html' : CONFIG.url + '/join-room.html';
        await page.goto(joinRoomUrl);
        await page.waitForTimeout(2000);

        if (await page.locator('#email').isVisible()) {
            console.log(`[${userConfig.name}] Logging in...`);
            await page.fill('#email', userConfig.email);
            await page.fill('#password', CONFIG.password);
            await page.click('button[type="submit"]');
            await page.waitForTimeout(3000);

            // Double check redirect
            if (page.url().includes('login.html')) {
                console.log(`[${userConfig.name}] checking login again...`);
                await page.waitForTimeout(2000);
            }

            if (!page.url().includes('join-room.html')) {
                await page.goto(joinRoomUrl);
            }
        }

        // 2. Join Room
        console.log(`[${userConfig.name}] Joining Room ${CONFIG.roomCode}...`);
        await page.waitForSelector('#roomCode', { timeout: 30000 });
        await page.fill('#userName', userConfig.name);
        await page.fill('#roomCode', CONFIG.roomCode);
        await page.click('#joinRoomForm button[type="submit"]');

        // 3. Wait for Game Start
        console.log(`[${userConfig.name}] Waiting for start...`);
        // Increased timeout significantly as 15 users join
        await page.waitForSelector('#typingScreen.active', { timeout: 300000 });

        // Get text
        const textToType = await page.locator('#paragraph-display').textContent();
        console.log(`[${userConfig.name}] Game Started! Text len: ${textToType.length}`);

        // 4. Staggered Delay
        if (userConfig.delay > 0) await page.waitForTimeout(userConfig.delay);

        // 5. Typing Simulation
        console.log(`[${userConfig.name}] Typing...`);
        await page.click('body');

        const possibleChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ ";

        for (let i = 0; i < textToType.length; i++) {
            let charToType = textToType[i];

            // Error simulation
            if (Math.random() < userConfig.errorRate) {
                const randomChar = possibleChars.charAt(Math.floor(Math.random() * possibleChars.length));
                charToType = (randomChar === charToType) ? 'x' : randomChar;
            }

            await page.keyboard.type(charToType);

            const delay = Math.floor(Math.random() * (userConfig.maxDelay - userConfig.minDelay)) + userConfig.minDelay;
            await page.waitForTimeout(delay);
        }

        console.log(`[${userConfig.name}] Finished typing.`);

        // 6. Results
        await Promise.race([
            page.waitForSelector('#resultScreen.active', { timeout: 120000 }),
            page.waitForSelector('#leaderboardScreen.active', { timeout: 120000 }),
            page.waitForSelector('#completedScreen.active', { timeout: 120000 })
        ]);

        await page.waitForTimeout(2000); // Let animations settle
        const safeName = userConfig.email.replace(/[^a-z0-9]/gi, '_').toLowerCase();

        // Take screenshot of whatever screen we landed on first
        await page.screenshot({ path: path.join(RESULTS_DIR, `${safeName}_result_initial.png`) });

        // Scrape data from Result Screen if visible
        if (await page.locator('#resultScreen.active').isVisible()) {
            result.wpm = await page.innerText('#resultWPM').catch(() => 'Err');
            result.accuracy = await page.innerText('#resultAccuracy').catch(() => 'Err');
            console.log(`[${userConfig.name}] WPM: ${result.wpm}, Acc: ${result.accuracy}`);

            // 7. Click Continue to Leaderboard
            if (await page.locator('#resultContinueBtn').isVisible()) {
                console.log(`[${userConfig.name}] Clicking Continue...`);
                await page.click('#resultContinueBtn');
            }
        }

        // 8. Wait for Round Leaderboard
        try {
            await page.waitForSelector('#leaderboardScreen.active', { timeout: 10000 });
            console.log(`[${userConfig.name}] On Round Leaderboard.`);
            await page.waitForTimeout(1000);
            await page.screenshot({ path: path.join(RESULTS_DIR, `${safeName}_leaderboard_round.png`) });

            // Try to move to Completed Screen
            if (await page.locator('#leaderboardContinueBtn').isVisible()) {
                await page.click('#leaderboardContinueBtn');
            }
        } catch (e) {
            console.log(`[${userConfig.name}] Skipped round leaderboard or already passed it.`);
        }

        // 9. Wait for Completed Screen (Global Final Results)
        try {
            // Might need to wait if rounds are transitioning or if it's the final round
            await page.waitForSelector('#completedScreen.active', { timeout: 30000 });
            console.log(`[${userConfig.name}] On Completed Screen.`);

            // Click "View Final Results" button
            const finalBtn = page.getByText('View Final Results');
            if (await finalBtn.isVisible()) {
                console.log(`[${userConfig.name}] Clicking View Final Results button...`);
                await finalBtn.click();

                // 10. Wait for Final Leaderboard Page (navigation)
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(2000);

                if (page.url().includes('leaderboard.html')) {
                    console.log(`[${userConfig.name}] Reached Final Leaderboard URL.`);
                    await page.screenshot({ path: path.join(RESULTS_DIR, `${safeName}_final_leaderboard_page.png`) });
                }
            }
        } catch (e) {
            console.log(`[${userConfig.name}] Did not reach Completed Screen (might be multi-round game).`);
        }

        result.status = 'Completed';

    } catch (error) {
        console.error(`[${userConfig.name}] Error: ${error.message}`);
        result.details = error.message;
        const safeName = userConfig.email.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        await page.screenshot({ path: path.join(RESULTS_DIR, `${safeName}_error.png`) }).catch(() => { });
    } finally {
        await context.close();
    }

    return result;
}

(async () => {
    const browser = await chromium.launch({ headless: false });
    console.log(`Starting 15-User Stress Test on Room: ${CONFIG.roomCode}`);

    const promises = CONFIG.users.map(user => runUserTest(user, browser));
    const results = await Promise.all(promises);

    console.table(results);
    fs.writeFileSync(path.join(RESULTS_DIR, 'final_summary.json'), JSON.stringify(results, null, 2));

    await browser.close();
})();
