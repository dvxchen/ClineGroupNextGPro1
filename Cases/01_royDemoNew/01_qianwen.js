// test.js
// Description:
// - Reads qianwen.csv test steps (Action, Data, Expected Result)
// - Drives Chrome to execute the steps
// - Extracts the required .token value and saves it to data.json as JSON { "value": ... }
//
// Prerequisites to run:
//   1) npm i -D playwright
//   2) npx playwright install chrome
//   3) node test.js
Notes:
// - This script attempts to launch the system Chrome (channel: 'chrome'); if unavailable it falls back to bundled Chromium.
// - The input area on qianwen.com is detected heuristically (textarea/contenteditable/text input). Adjust selectors if needed.

'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const LOG_PATH = path.resolve(__dirname, 'log.json');
function resetLogFile() {
    try {
        fs.writeFileSync(LOG_PATH, '[]', 'utf-8');
    } catch (e) {
        console.error('Failed to reset log.json:', e);
    }
}
function appendLog(entry) {
    const enriched = { ts: new Date().toISOString(), ...entry };
    try {
        const prev = fs.existsSync(LOG_PATH) ? JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8') || '[]') : [];
        prev.push(enriched);
        fs.writeFileSync(LOG_PATH, JSON.stringify(prev, null, 2), 'utf-8');
    } catch (e) {
        console.error('Failed to write log.json:', e);
    }
}

/**
 * Parse qianwen.csv into steps.
 * CSV format (3 columns): Action,Data,Expected Result
 * Lines are simple and unquoted in the provided sample, so a basic split is sufficient.
 */
function readSettings() {
    const settingsPath = path.resolve(__dirname, 'Settings.json');
    try {
        const raw = fs.readFileSync(settingsPath, 'utf-8');
        const cfg = JSON.parse(raw);
        let h = cfg.HEADLESS;
        if (typeof h === 'string') {
            const s = h.trim().toLowerCase();
            if (['true', '1', 'yes', 'y', 'on'].includes(s)) return { HEADLESS: true };
            if (['false', '0', 'no', 'n', 'off'].includes(s)) return { HEADLESS: false };
        }
        return { HEADLESS: Boolean(h) };
    } catch (e) {
        // Default to non-headless if Headless.json is missing or invalid
        return { HEADLESS: false };
    }
}

function parseCsv(filePath) {
    const raw = fs.readFileSync(filePath, 'utf-8')
        .split(/\r?\n/)
        .filter(l => l.trim().length > 0);

    // remove header
    const header = raw.shift();

    return raw.map((line) => {
        // split into columns; support commas inside Data by treating last field as Expected
        const parts = line.split(',');
        const Action = (parts[0] || '').trim();
        const Expected = (parts.length > 1 ? (parts[parts.length - 1] || '').trim() : '');
        const Data = (parts.length > 2 ? parts.slice(1, -1).join(',').trim() : (parts[1] || '').trim());
        return { Action, Data, Expected };
    });
}

/**
 * Heuristically find the primary text input area on the page.
 */
async function findPrimaryInput(page) {
    const selectors = [
        'textarea:not([disabled])',
        '[contenteditable="true"]',
        'input[type="text"]:not([disabled])',
        '[role="textbox"]'
    ];
    for (const sel of selectors) {
        const el = await page.$(sel);
        if (el) return el;
    }
    return null;
}

/**
 * Extract the next .token value following a .token that contains ":".
 * Returns the raw text content of that token or null.
 */
async function extractTokenValue(page) {
    return await page.evaluate(() => {
        const tokens = Array.from(document.querySelectorAll('.token'));
        if (!tokens.length) return null;

        // find the first token that includes ":" (exact ":" or contains ":")
        let idx = tokens.findIndex(el => (el.textContent || '').trim().includes(':'));
        if (idx === -1) return null;

        // find the next meaningful token after ":"
        for (let j = idx + 1; j < tokens.length; j++) {
            const t = (tokens[j].textContent || '').trim();
            if (!t) continue;
            if (t === ':' || t === ',' || t === '{' || t === '}' || t === '[' || t === ']') continue;
            return t;
        }
        return null;
    });
}

/**
 * Coerce a raw string value into a suitable JSON value.
 * - Try to parse numeric where possible (stripping %, spaces, commas)
 * - Try JSON.parse if it looks like JSON
 * - Fallback to string
 */
function coerceValue(val) {
    if (val == null) return null;
    const trimmed = String(val).trim().replace(/^"|"$/g, '');

    // try number (strip common non-numeric characters like % and commas)
    const numericCandidate = trimmed.replace(/[% ,]/g, '');
    const num = Number(numericCandidate);
    if (!Number.isNaN(num) && numericCandidate !== '') {
        return num;
    }

    // try JSON literal (e.g., true, false, null, numbers in string form, arrays/objects)
    try {
        return JSON.parse(trimmed);
    } catch (e) {
        // ignore
    }

    // fallback to string
    return trimmed;
}

/**
 * Execute steps read from qianwen.csv
 */
async function run() {
    const csvPath = path.resolve(__dirname, 'qianwen.csv');
    if (!fs.existsSync(csvPath)) {
        throw new Error('qianwen.csv not found in current directory.');
    }
    const steps = parseCsv(csvPath);
    // Reset log.json on every run and record start
    resetLogFile();
    appendLog({ type: 'run', event: 'start', steps: steps.length });
    const { HEADLESS } = readSettings();

    let browser;
    try {
        // Try launching Chrome channel; fallback to default Chromium if not available
        try {
            browser = await chromium.launch({ channel: 'chrome', headless: HEADLESS, args: ['--start-maximized'] });
        } catch (e) {
            console.warn('Chrome channel not available, falling back to bundled Chromium.');
            browser = await chromium.launch({ headless: HEADLESS, args: ['--start-maximized'] });
        }

        const context = await browser.newContext(HEADLESS ? {} : { viewport: null });
        const page = await context.newPage();

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const action = step.Action;
            appendLog({ type: 'step', step: i + 1, action, data: step.Data || '', expected: step.Expected || '', event: 'start' });

            // 1) 用Chrome打开<url>
            if (/^用Chrome打开/.test(action)) {
                const m = action.match(/^用Chrome打开(.+)$/);
                const url = (m && m[1] ? m[1] : step.Data).trim();
                if (!url) {
                    throw new Error('打开页面步骤未提供URL。');
                }
                console.log('Navigating to:', url);
                await page.goto(url, { waitUntil: 'load' });
                // small settle time
                await page.waitForTimeout(500);
                appendLog({ type: 'step', step: i + 1, action, data: step.Data || '', expected: step.Expected || '', event: 'success', message: 'Navigated to URL' });

                // 2) 在输入区输入 <text>
            } else if (/^在输入区输入/.test(action)) {
                const m = action.match(/^在输入区输入\s*(.*)$/);
                const text = (m && m[1] ? m[1] : step.Data).trim();
                if (!text) {
                    throw new Error('输入步骤未提供文本。');
                }
                const input = await findPrimaryInput(page);
                if (!input) {
                    throw new Error('未找到输入区（textarea/contenteditable/text input）。');
                }
                console.log('Typing prompt text into input area...');
                await input.click();
                // Clear any existing text where possible
                try { await input.fill(''); } catch (_) { }
                await input.type(text, { delay: 10 });
                appendLog({ type: 'step', step: i + 1, action, data: text, expected: step.Expected || '', event: 'success', message: 'Typed into input area' });

                // 3) 回车
            } else if (action === '回车') {
                console.log('Pressing Enter...');
                await page.keyboard.press('Enter');
                // give page some time to respond
                await page.waitForTimeout(1500);
                appendLog({ type: 'step', step: i + 1, action, data: step.Data || '', expected: step.Expected || '', event: 'success', message: 'Pressed Enter' });

                // 4) 读取 class='token' ... 存盘到 data.json
            } else if (action.includes("class='token'") && action.includes('存盘到 data.json')) {
                console.log('Waiting for .token elements and extracting value after ":" ...');
                try {
                    await page.waitForSelector('.token', { timeout: 30000 });
                } catch (e) {
                    console.warn('No .token elements appeared within timeout.');
                }
                // small settle time
                await page.waitForTimeout(1000);

                const rawVal = await extractTokenValue(page);
                if (rawVal == null) {
                    throw new Error('未找到目标 token 值（紧跟 ":" 的下一个 .token）。');
                }
                const coerced = coerceValue(rawVal);
                const result = { value: coerced };

                const outPath = path.resolve(__dirname, 'data.json');
                fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
                console.log('Saved to data.json:', result);
                appendLog({ type: 'step', step: i + 1, action, data: step.Data || '', expected: step.Expected || '', event: 'success', message: 'Saved result to data.json', result });

            } else {
                console.warn('未识别的步骤，跳过:', action);
                appendLog({ type: 'step', step: i + 1, action, data: step.Data || '', expected: step.Expected || '', event: 'skip', message: 'Unrecognized step' });
            }
        }
        appendLog({ type: 'run', event: 'end' });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * Run only if executed directly (prevents execution when required for syntax checks)
 */
if (require.main === module) {
    run().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
