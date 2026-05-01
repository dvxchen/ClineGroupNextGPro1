/**
 * test.js
 * Executes browser automation steps defined in qianwen.csv.
 *
 * Expected CSV (qianwen.csv) format (3 columns): Action,Data,Expected Result
 * The provided sample includes these steps:
 * 1) 用Chrome打开http://www.qianwen.com 让窗口最大化
 * 2) 在输入区输入 <some text>
 * 3) 回车
 * 4) 读取 class='token' 含有":"值的下一个class='token' 的值转换成Json格式 存盘到 操作系统临时目录 的 data.json
 *
 * Runtime requirements:
 * - Node.js
 * - Playwright installed in this project:  npm i -D playwright
 * - Chrome browser for Playwright:        npx playwright install chrome
 *
 * Run:
 *   node test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// JSON logging helpers
const LOG_PATH = path.resolve(__dirname, 'log.json');
function initLog() {
    try {
        fs.writeFileSync(LOG_PATH, '', 'utf-8');
    } catch (e) {
        console.warn('[WARN] Failed to initialize log.json:', e && e.message ? e.message : String(e));
    }
}
function writeLog(entry) {
    try {
        const rec = { ts: new Date().toISOString(), ...entry };
        fs.appendFileSync(LOG_PATH, JSON.stringify(rec) + os.EOL, 'utf-8');
    } catch (e) {
        console.warn('[WARN] Failed to write log.json:', e && e.message ? e.message : String(e));
    }
}

// Load HEADLESS setting from Settings.json and convert to boolean
function getHeadlessFlag() {
    const settingsPath = path.resolve(__dirname, 'Settings.json');
    try {
        if (!fs.existsSync(settingsPath)) {
            console.warn('[WARN] Settings.json not found, defaulting headless=false');
            return false;
        }
        const raw = fs.readFileSync(settingsPath, 'utf-8');
        const json = JSON.parse(raw);
        // Support both HEADLESS (correct) and HARDLESS (possible typo) keys
        let v = json.HEADLESS;
        if (v === undefined) v = json.HARDLESS;
        if (typeof v === 'boolean') return v;
        if (typeof v === 'string') {
            const s = v.trim().toLowerCase();
            if (s === 'true' || s === '1' || s === 'yes' || s === 'y') return true;
            if (s === 'false' || s === '0' || s === 'no' || s === 'n') return false;
        }
        if (typeof v === 'number') return v !== 0;
        return false;
    } catch (e) {
        console.warn('[WARN] Failed to read/parse Settings.json, defaulting headless=false:', e && e.message ? e.message : String(e));
        return false;
    }
}

function parseCSV(filePath) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length <= 1) return [];
    // Header: Action,Data,Expected Result
    const rows = lines.slice(1).map(line => {
        // naive split for simple cases; adequate for current sample
        const parts = line.split(',');
        return {
            action: (parts[0] || '').trim(),
            data: (parts[1] || '').trim(),
            expected: (parts[2] || '').trim(),
        };
    });
    return rows;
}

async function locateInput(page) {
    // Try a series of selectors commonly used for chat/input areas
    const selectors = [
        'textarea',
        'div[role="textbox"]',
        '[contenteditable="true"]',
        'input[type="text"]',
        'input:not([type]), input[type="search"]',
    ];
    for (const sel of selectors) {
        const el = await page.$(sel);
        if (el) return el;
    }
    // Fallback: choose a larger visible candidate
    const candidates = await page.$$(
        'input, textarea, [contenteditable="true"], div[role="textbox"]'
    );
    for (const c of candidates) {
        try {
            const box = await c.boundingBox();
            if (box && box.width > 200 && box.height > 20) return c;
        } catch {
            // ignore
        }
    }
    return null;
}

// Robust typing helpers to support input, textarea, and contenteditable across main page and iframes
async function tryTypeInContext(ctx, text) {
    // Try ARIA role textbox first
    const roleTextbox = ctx.getByRole ? ctx.getByRole('textbox') : ctx.locator('div[role="textbox"]:visible, [contenteditable="true"]:visible');
    if (roleTextbox && roleTextbox.count && await roleTextbox.count()) {
        const el = roleTextbox.first();
        await el.click();
        try {
            await el.fill(text);
        } catch {
            try {
                await ctx.keyboard.insertText(text);
            } catch {
                // ignore, will try other strategies
            }
        }
        return true;
    }

    // Prefer standard inputs/textareas (including placeholders)
    const inputLike = ctx.locator('textarea:visible, input[type="text"]:visible, input:not([type]):visible, input[type="search"]:visible, input[placeholder]:visible, textarea[placeholder]:visible');
    if (await inputLike.count()) {
        const el = inputLike.first();
        await el.click();
        try {
            await el.fill(text);
        } catch {
            try {
                await ctx.keyboard.insertText(text);
            } catch {
                // ignore
            }
        }
        return true;
    }

    // Placeholder-based heuristics
    const placeholders = ['输入', 'input', 'message', 'prompt', '问题', '提问', '搜索', 'search'];
    for (const ph of placeholders) {
        const byPh = ctx.getByPlaceholder ? ctx.getByPlaceholder(new RegExp(ph, 'i')) : ctx.locator(`[placeholder*="${ph}"]:visible`);
        if (byPh && byPh.count && await byPh.count()) {
            const el = byPh.first();
            await el.click();
            try {
                await el.fill(text);
            } catch {
                try {
                    await ctx.keyboard.insertText(text);
                } catch { }
            }
            return true;
        }
    }

    // Then contenteditable and ARIA textboxes
    const editable = ctx.locator('[contenteditable="true"]:visible, div[role="textbox"]:visible');
    if (await editable.count()) {
        const el = editable.first();
        await el.click();
        try {
            await ctx.keyboard.insertText(text);
        } catch {
            const handle = await el.elementHandle();
            if (handle) {
                await handle.evaluate((node, t) => {
                    node.focus();
                    // place caret at end
                    const sel = window.getSelection && window.getSelection();
                    if (sel && node.firstChild) {
                        sel.selectAllChildren(node);
                        sel.collapseToEnd();
                    }
                    node.textContent = t || '';
                    node.dispatchEvent(new InputEvent('input', { bubbles: true }));
                }, text);
            }
        }
        return true;
    }

    // Fallback: type into active element if it's editable
    const handled = await ctx.evaluate((t) => {
        const el = document.activeElement;
        if (!el) return false;
        const tag = el.tagName || '';
        const type = el.type || '';
        const isInput = tag === 'TEXTAREA' || (tag === 'INPUT' && (!type || type === 'text' || type === 'search'));
        const isEditable = (el.getAttribute && el.getAttribute('contenteditable') === 'true') || (el.getAttribute && el.getAttribute('role') === 'textbox');
        if (isInput) {
            el.value = t;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
        }
        if (isEditable) {
            el.textContent = t;
            el.dispatchEvent(new InputEvent('input', { bubbles: true }));
            return true;
        }
        return false;
    }, text);
    if (handled) return true;

    return false;
}

async function typeIntoInput(page, text) {
    // Retry loop to allow lazy-loaded UIs to render
    for (let attempt = 0; attempt < 15; attempt++) {
        // Try on main page first
        try {
            if (await tryTypeInContext(page, text)) return;
        } catch { }

        // Try in child frames
        const frames = page.frames();
        for (const frame of frames) {
            if (frame === page.mainFrame()) continue;
            try {
                if (await tryTypeInContext(frame, text)) return;
            } catch {
                // ignore frame errors
            }
        }
        await page.waitForTimeout(1000);
    }
    throw new Error('Could not find an input area to type into after multiple attempts.');
}

async function main() {
    initLog();
    writeLog({ level: 'info', event: 'start' });
    const csvPath = path.resolve(__dirname, 'qianwen.csv');
    if (!fs.existsSync(csvPath)) {
        console.error('qianwen.csv not found in current directory:', csvPath);
        process.exit(1);
    }

    const steps = parseCSV(csvPath);
    if (!steps.length) {
        console.error('No executable steps found in qianwen.csv.');
        process.exit(1);
    }

    let playwright;
    try {
        playwright = require('playwright');
    } catch (e) {
        console.error(
            'Missing dependency: playwright. Install and prepare Chrome with:\n' +
            '  npm i -D playwright\n' +
            '  npx playwright install chrome'
        );
        process.exit(1);
    }

    const { chromium } = playwright;

    const headless = getHeadlessFlag();
    console.log('[INFO] Launch headless:', headless);
    writeLog({ level: 'info', event: 'headless_config', headless });

    let browser;
    try {
        browser = await chromium.launch({
            channel: 'chrome',          // try installed Chrome
            headless: headless,         // from Settings.json
            args: ['--start-maximized'] // maximize window
        });
    } catch (e) {
        console.warn('[WARN] Chrome channel launch failed, falling back to bundled Chromium.');
        browser = await chromium.launch({
            headless: headless,
            args: ['--start-maximized']
        });
    }

    const context = await browser.newContext({
        viewport: null // honor window size (start-maximized)
    });

    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    try {
        for (const step of steps) {
            const a = step.action || '';
            // 1) 用Chrome打开http://... 让窗口最大化
            if (/用Chrome打开/i.test(a)) {
                const urlMatch = a.match(/https?:\/\/\S+/i);
                const url = urlMatch ? urlMatch[0] : null;
                if (!url) throw new Error('URL not found in step: ' + a);
                console.log('[ACTION] Navigating to:', url);
                writeLog({ level: 'action', event: 'navigate', url });
                let target = url;
                try {
                    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
                } catch (err) {
                    if (/^http:\/\//i.test(target)) {
                        const httpsUrl = target.replace(/^http:\/\//i, 'https://');
                        console.warn('[WARN] Navigation timeout. Retrying with HTTPS:', httpsUrl);
                        target = httpsUrl;
                        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
                    } else {
                        console.warn('[WARN] Navigation timeout:', err && err.message ? err.message : String(err));
                    }
                }
                await page.waitForTimeout(2000);
                writeLog({ level: 'info', event: 'navigate_done', url: target });
                // Window already maximized via args/viewport
            }
            // 2) 在输入区输入 <text>
            else if (/在输入区输入/.test(a)) {
                const textMatch = a.match(/在输入区输入\s*(.*)$/);
                const text = textMatch ? textMatch[1].trim() : '';
                if (!text) throw new Error('No input text found in step: ' + a);

                console.log('[ACTION] Typing into input area...');
                writeLog({ level: 'action', event: 'type', text });
                await typeIntoInput(page, text);
                writeLog({ level: 'info', event: 'type_done' });
            }
            // 3) 回车
            else if (/回车/.test(a)) {
                console.log('[ACTION] Press Enter and wait for response...');
                writeLog({ level: 'action', event: 'press_enter' });
                await page.keyboard.press('Enter');
                // Wait for response content to appear; adjust selector or timeout as needed
                try {
                    await page.waitForSelector('.token', { timeout: 60000 });
                    await page.waitForTimeout(1500);
                } catch {
                    console.warn('[WARN] Timed out waiting for .token elements to appear.');
                }
                writeLog({ level: 'info', event: 'press_enter_done' });
            }
            // 4) 读取 class='token' 含有":"值的下一个class='token' 的值... 保存到 OS 临时目录 data.json
            else if (/读取\s*class='token'/.test(a)) {
                console.log('[ACTION] Extracting value from tokenized response and saving JSON (2-decimal formatting + "% (Mar)")...');
                writeLog({ level: 'action', event: 'extract_begin' });
                const rawVal = await page.evaluate(() => {
                    const tokens = Array.from(document.querySelectorAll('.token'));
                    if (!tokens.length) return null;
                    for (let i = 0; i < tokens.length - 1; i++) {
                        const t = tokens[i];
                        const txt = (t.textContent || '').trim();
                        if (txt.includes(':')) {
                            const next = tokens[i + 1];
                            const val = (next.textContent || '').trim();
                            return val.replace(/^["'\s]+|["'\s]+$/g, '');
                        }
                    }
                    return null;
                });

                if (!rawVal) {
                    writeLog({ level: 'error', event: 'extract_failed', reason: 'no_token_value_found' });
                    throw new Error('Could not extract value from .token elements.');
                }

                let cleaned = String(rawVal).replace(/,/g, '');
                const match = cleaned.match(/-?\d+(\.\d+)?/);
                if (!match) {
                    writeLog({ level: 'error', event: 'extract_failed', reason: 'no_numeric_value_found', raw: rawVal });
                    throw new Error('Extracted token value does not contain a numeric value: ' + rawVal);
                }
                const num = Number(match[0]);
                if (!Number.isFinite(num)) {
                    writeLog({ level: 'error', event: 'extract_failed', reason: 'not_a_number', parsed: match[0], raw: rawVal });
                    throw new Error('Parsed numeric value is not finite: ' + match[0]);
                }
                const formatted = num.toFixed(2);
                const result = { value: formatted + '% (Mar)' };

                const tmpDir = os.tmpdir();
                const outPath = path.join(tmpDir, 'data.json');
                fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
                console.log('[OK] Saved JSON to (OS temp):', outPath);
                writeLog({ level: 'info', event: 'extract_saved', path: outPath, data: result });
            }
            // Unrecognized step
            else {
                console.log('[INFO] Skipping unrecognized step:', a);
            }
        }
    } catch (err) {
        console.error('[ERROR]', err && err.stack ? err.stack : String(err));
        writeLog({ level: 'error', event: 'exception', message: err && err.message ? err.message : String(err) });
        process.exitCode = 1;
    } finally {
        // keep a short pause, then close
        try { await page.waitForTimeout(1000); } catch { }
        await browser.close();
        writeLog({ level: 'info', event: 'finish' });
    }
}

main().catch(err => {
    console.error('[FATAL]', err && err.stack ? err.stack : String(err));
    process.exit(1);
});