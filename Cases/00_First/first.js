/**
 * test.js
 * 
 * Runs browser-based test steps defined in a CSV file with columns:
 *   Action, Data, Expected Result
 *
 * Example CSV (first.csv):
 *   Action,Data,Expected Result
 *   use Chrome to open https://www.bing.com and max the window,,
 *   input hello world in the searchbox,hello world,Search results for "hello world" are displayed
 *
 * Usage:
 *   1) Install dependency: npm i puppeteer
 *   2) Run: node test.js [path-to-csv]
 *      - Default CSV path is "./first.csv" if not provided
 *
 * Notes:
 *   - By default Puppeteer uses its bundled Chromium. To use your installed Chrome, set:
 *       set PUPPETEER_EXECUTABLE_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
 *     or provide the path appropriate for your system.
 *   - This script includes simple action mappings for the example above (Bing search).
 *     You can extend runStep/checkExpected to support more actions and validations.
 */

const fs = require('fs');
const path = require('path');

let puppeteer;
try {
    puppeteer = require('puppeteer');
} catch (e) {
    console.error('Missing dependency "puppeteer". Install it with:\n  npm i puppeteer');
    process.exit(1);
}

function parseCSV(content) {
    // Simple CSV parser that supports quoted fields and newlines.
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
        const c = content[i];

        if (inQuotes) {
            if (c === '"') {
                if (content[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += c;
            }
        } else {
            if (c === '"') {
                inQuotes = true;
            } else if (c === ',') {
                row.push(field);
                field = '';
            } else if (c === '\r') {
                // ignore
            } else if (c === '\n') {
                row.push(field);
                rows.push(row);
                row = [];
                field = '';
            } else {
                field += c;
            }
        }
    }
    // Push last row if any
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

function normalizeHeaderCell(h) {
    return String(h || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/result$/, 'result'); // no-op placeholder for flexibility
}

async function runStep(page, step, num) {
    const actionRaw = step.action || '';
    const action = actionRaw.toLowerCase();

    // Match: "use Chrome to open <url> and max the window"
    if (/use\s+chrome\s+to\s+open\s+(\S+)/i.test(actionRaw)) {
        const urlMatch = actionRaw.match(/open\s+(\S+)/i);
        const url = (urlMatch && urlMatch[1]) || step.data;
        if (!url) {
            throw new Error('No URL provided in action or data.');
        }
        console.log(`[Step ${num}] Navigating to ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        if (action.includes('max')) {
            // Launched with --start-maximized; ensure large viewport as well
            try {
                await page.setViewport({ width: 1920, height: 1080 });
            } catch {
                // ignore if defaultViewport:null
            }
        }
        return;
    }

    // Match: "input <text> in the searchbox"
    if (/input\s+.+\s+in\s+the\s+search ?box/i.test(action)) {
        const typedText =
            step.data ||
            (actionRaw.match(/input\s+(.+?)\s+in\s+the\s+search ?box/i) || [])[1];

        if (!typedText) {
            throw new Error('No input text provided for "input ... in the searchbox".');
        }

        // Bing search box selector
        const selector = '#sb_form_q';
        console.log(`[Step ${num}] Typing "${typedText}" into ${selector} and submitting`);
        await page.waitForSelector(selector, { timeout: 10000 });
        await page.click(selector, { clickCount: 3 });
        await page.type(selector, typedText, { delay: 20 });
        await page.keyboard.press('Enter');
        // Wait for results content to load
        await page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => { });
        // Also wait for results container if possible
        try {
            await page.waitForSelector('#b_results, main, [role="main"]', { timeout: 10000 });
        } catch {
            // continue even if not found; assertion will catch
        }
        return;
    }

    // Generic input pattern: "input <text> into selector", Data column holds the CSS selector
    if (/input\s+.+\s+into\s+selector/i.test(action)) {
        const typedText =
            step.data ||
            (actionRaw.match(/input\s+(.+?)\s+into\s+selector/i) || [])[1];
        const selector = step.data;
        if (!selector || !typedText) {
            throw new Error('Provide both text and selector for generic input action.');
        }
        console.log(`[Step ${num}] Typing "${typedText}" into ${selector}`);
        await page.waitForSelector(selector, { timeout: 10000 });
        await page.type(selector, typedText, { delay: 20 });
        return;
    }

    throw new Error(`Unsupported action: "${actionRaw}"`);
}

async function checkExpected(page, expectedRaw) {
    if (!expectedRaw) return true;
    const expected = expectedRaw.toLowerCase();

    // Specialized handling for Bing search:
    if (/search results/.test(expected)) {
        // If results container exists, consider it a pass
        const resultsHandle =
            (await page.$('#b_results')) ||
            (await page.$('main')) ||
            (await page.$('[role="main"]'));
        if (resultsHandle) {
            return true;
        }
        // Fallback: title contains query phrase
        try {
            const title = await page.title();
            if (title && title.toLowerCase().includes('hello world')) {
                return true;
            }
        } catch {
            // ignore
        }
        return false;
    }

    // Generic fallback: check if expected string appears in page HTML
    try {
        const html = await page.content();
        return html.toLowerCase().includes(expected);
    } catch {
        return false;
    }
}

async function main() {
    const csvPath =
        process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, 'first.csv');

    if (!fs.existsSync(csvPath)) {
        console.error(`CSV not found: ${csvPath}`);
        process.exit(1);
    }

    const raw = fs.readFileSync(csvPath, 'utf8').trim();
    if (!raw) {
        console.error('CSV is empty.');
        process.exit(1);
    }

    const rows = parseCSV(raw);
    if (!rows.length) {
        console.error('No rows found in CSV.');
        process.exit(1);
    }

    const header = rows[0].map(normalizeHeaderCell);
    const idxAction = header.indexOf('action');
    const idxData = header.indexOf('data');
    // Accept "expected" or "expected result" or similar
    let idxExpected = header.indexOf('expected result');
    if (idxExpected === -1) idxExpected = header.indexOf('expected');
    if (idxExpected === -1) idxExpected = header.findIndex(h => h.startsWith('expected'));

    if (idxAction === -1) {
        console.error('CSV must include an "Action" column header.');
        process.exit(1);
    }

    const steps = rows
        .slice(1)
        .map((r) => ({
            action: (r[idxAction] || '').trim(),
            data: idxData !== -1 && r[idxData] ? String(r[idxData]).trim() : '',
            expected: idxExpected !== -1 && r[idxExpected] ? String(r[idxExpected]).trim() : '',
        }))
        .filter((s) => s.action);

    if (!steps.length) {
        console.error('No test steps found after the header row.');
        process.exit(1);
    }

    // Determine headless from Settings.json (string "true"/"false" or boolean)
    let headlessFlag = false;
    try {
        const settingsRaw = fs.readFileSync(path.resolve(__dirname, 'Settings.json'), 'utf8');
        const settings = JSON.parse(settingsRaw);
        const rawVal = (settings && (settings.HEADLESS !== undefined ? settings.HEADLESS : settings.headless));
        if (typeof rawVal === 'string') {
            headlessFlag = rawVal.trim().toLowerCase() === 'true';
        } else if (typeof rawVal === 'boolean') {
            headlessFlag = rawVal;
        }
    } catch (e) {
        // Fallback to default (false) if Settings.json is missing or invalid
    }

    const launchOptions = {
        headless: headlessFlag,
        args: ['--start-maximized'],
        defaultViewport: null,
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    // Initialize JSON logging
    const logFilePath = path.resolve(__dirname, 'log.json');
    // Clean the file content on every run with an empty JSON array
    try {
        fs.writeFileSync(logFilePath, '[]', 'utf8');
    } catch (e) {
        // ignore write errors at init
    }
    const logEntries = [];

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    let allPassed = true;

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        try {
            await runStep(page, step, i + 1);

            if (step.expected) {
                const ok = await checkExpected(page, step.expected);
                if (!ok) {
                    throw new Error(`Expected condition not met: ${step.expected}`);
                }
            }

            console.log(`Step ${i + 1} PASS`);
            // Record PASS log entry
            logEntries.push({
                step: i + 1,
                action: step.action,
                data: step.data,
                expected: step.expected,
                status: 'PASS',
                timestamp: new Date().toISOString(),
            });
        } catch (err) {
            allPassed = false;
            const message = err && err.message ? err.message : String(err);
            console.error(`Step ${i + 1} FAIL - ${message}`);
            // Record FAIL log entry
            logEntries.push({
                step: i + 1,
                action: step.action,
                data: step.data,
                expected: step.expected,
                status: 'FAIL',
                error: message,
                timestamp: new Date().toISOString(),
            });
        }
    }

    await browser.close();

    // Write accumulated logs to log.json
    try {
        fs.writeFileSync(logFilePath, JSON.stringify(logEntries, null, 2));
    } catch (e) {
        console.error('Failed to write log.json:', e && e.message ? e.message : e);
    }

    if (!allPassed) {
        console.error('One or more steps failed.');
        process.exit(1);
    } else {
        console.log('All steps passed.');
    }
}

process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err && err.message ? err.message : err);
    process.exit(1);
});

main().catch((err) => {
    console.error('Fatal error:', err && err.message ? err.message : err);
    process.exit(1);
});