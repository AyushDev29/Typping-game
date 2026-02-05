const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    url: 'https://blind-typing-1.firebaseapp.com',
    roomCode: '7R4P48',
    password: '123456',
    // Customized behavior: Accuracy 20-90% (Error Rate 0.1 - 0.8)
    users: [
        {
            email: 'a@gmail.com', delay: 0, name: 'User 1',
            minTypingDelay: 80, maxTypingDelay: 150, errorRate: 0.1 // 90% Acc
        },
        {
            email: 'ayush@gmail.com', delay: 5000, name: 'User 2',
            minTypingDelay: 90, maxTypingDelay: 160, errorRate: 0.8 // 20% Acc
        },
        {
            email: 'test@test.com', delay: 10000, name: 'User 3',
            minTypingDelay: 100, maxTypingDelay: 180, errorRate: 0.5 // 50% Acc
        },
        {
            email: 'test2@test.com', delay: 15000, name: 'User 4',
            minTypingDelay: 110, maxTypingDelay: 200, errorRate: 0.3 // 70% Acc
        },
        {
            email: 'newtesting@gmail.com', delay: 20000, name: 'User 5',
            minTypingDelay: 120, maxTypingDelay: 250, errorRate: 0.65 // 35% Acc
        }
    ]
};

const RESULTS_DIR = path.join(__dirname, 'results');
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

async function runUserTest(userConfig, browser) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const result = { user: userConfig.email, status: 'Failed', details: '' };

    try {
        console.log(`[${userConfig.name}] Starting...`);

        // 1. Go directly to Join Room
        const joinRoomUrl = CONFIG.url.endsWith('/') ? CONFIG.url + 'join-room.html' : CONFIG.url + '/join-room.html';
        console.log(`[${userConfig.name}] Navigating to ${joinRoomUrl}...`);
        await page.goto(joinRoomUrl);
        await page.waitForTimeout(3000);

        // Check if we were redirected to Login
        if (await page.locator('#email').isVisible()) {
            console.log(`[${userConfig.name}] Redirected to Login. Logging in...`);
            await page.fill('#email', userConfig.email);
            await page.fill('#password', CONFIG.password);
            await page.click('button[type="submit"]');

            await page.waitForTimeout(3000);

            if (!page.url().includes('join-room.html')) {
                console.log(`[${userConfig.name}] Re-navigating to Join Room...`);
                await page.goto(joinRoomUrl);
            }
        } else {
            console.log(`[${userConfig.name}] No login form found. Assuming logged in.`);
        }

        // 2. Join Room
        console.log(`[${userConfig.name}] Waiting for Room Code input...`);
        await page.waitForSelector('#roomCode', { timeout: 15000 });

        console.log(`[${userConfig.name}] Filling Join Room details...`);
        await page.fill('#userName', userConfig.name);
        await page.fill('#roomCode', CONFIG.roomCode);
        await page.click('#joinRoomForm button[type="submit"]');

        // 3. Wait for game start
        console.log(`[${userConfig.name}] Joined. Waiting for game start...`);

        // Wait for typing screen
        await page.waitForSelector('#typingScreen.active', { timeout: 300000 }); // 5 mins max wait

        // Use innerText to get the visible text and TRIM it to avoid whitespace shifting
        let textToType = await page.locator('#paragraph-display').innerText();
        textToType = textToType.trim(); // Critical accuracy fix
        console.log(`[${userConfig.name}] Game started! Text: "${textToType.substring(0, 15)}..." (Len: ${textToType.length})`);

        // 4. Handle Start Delay
        if (userConfig.delay > 0) {
            console.log(`[${userConfig.name}] Sleeping for ${userConfig.delay}ms...`);
            await page.waitForTimeout(userConfig.delay);
        }

        // 5. Type with variable speed and errors
        console.log(`[${userConfig.name}] Typing (Rate: ${userConfig.minTypingDelay}-${userConfig.maxTypingDelay}ms, Err: ${userConfig.errorRate})...`);

        await page.click('body'); // Focus

        const possibleChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ ";

        for (let i = 0; i < textToType.length; i++) {
            let charToType = textToType[i];

            // SIMULATE ERROR
            if (Math.random() < userConfig.errorRate) {
                const randomChar = possibleChars.charAt(Math.floor(Math.random() * possibleChars.length));
                charToType = (randomChar === charToType) ? 'x' : randomChar;
            }

            await page.keyboard.type(charToType);

            // Random delay
            const speedRange = userConfig.maxTypingDelay - userConfig.minTypingDelay;
            const delay = Math.floor(Math.random() * speedRange) + userConfig.minTypingDelay;
            await page.waitForTimeout(delay);
        }

        console.log(`[${userConfig.name}] Finished typing.`);

        // 6. Verify Results
        console.log(`[${userConfig.name}] Waiting for results...`);

        await Promise.race([
            page.waitForSelector('#resultScreen.active', { timeout: 120000 }),
            page.waitForSelector('#leaderboardScreen.active', { timeout: 120000 })
        ]);

        await page.waitForTimeout(2000);

        // Capture screenshot
        const screenshotPath = path.join(RESULTS_DIR, `${userConfig.email}_result.png`);
        await page.screenshot({ path: screenshotPath });

        let wpm = 'N/A', accuracy = 'N/A';
        if (await page.locator('#resultScreen.active').isVisible()) {
            wpm = await page.innerText('#resultWPM');
            accuracy = await page.innerText('#resultAccuracy');
        } else {
            wpm = "See Leaderboard";
            accuracy = "See Leaderboard";
        }

        result.status = 'Completed';
        result.wpm = wpm;
        result.accuracy = accuracy;
        result.screenshot = screenshotPath;

    } catch (error) {
        console.error(`[${userConfig.name}] Error: ${error.message}`);
        result.details = error.message;
        const errorShot = path.join(RESULTS_DIR, `${userConfig.email}_error.png`);
        await page.screenshot({ path: errorShot }).catch(() => { });
    } finally {
        await context.close();
    }

    return result;
}

(async () => {
    const browser = await chromium.launch({ headless: false });
    console.log("Starting Stress Test (Run 6: Errors & Variable Speed, 5s Stagger)...");

    const promises = CONFIG.users.map(user => runUserTest(user, browser));
    const results = await Promise.all(promises);

    console.log("\n=== FINAL RESULTS ===");
    console.table(results);

    fs.writeFileSync(path.join(RESULTS_DIR, 'summary.json'), JSON.stringify(results, null, 2));

    await browser.close();
})();
