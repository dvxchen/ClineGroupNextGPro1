const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

/**
 * This script reads qianwen.csv and executes the listed steps:
 * 1) Open Chrome to the specified URL and maximize the window
 * 2) Type the provided prompt into the input area
 * 3) Press Enter
 * 4) Extract the next .token value following a ":" token and save as JSON data.json
 *
 * Notes:
 * - Optionally set CHROME_PATH env var to force using a specific Chrome executable. Otherwise, Puppeteer&#39;s default Chromium will be used.
 * - data.json and log.json are written to the same directory as this script.
 */

(async () => {
    const runLog = {
        startTime: new Date().toISOString(),
        steps: [],
    };

    function logStep(name, status, detail) {
        runLog.steps.push({
            time: new Date().toISOString(),
            name,
            status,
            detail,
        });
        console.log(`[${status}] ${name}`, detail ? JSON.stringify(detail) : '');
    }

    const csvPath = path.resolve(__dirname, 'qianwen.csv');
    if (!fs.existsSync(csvPath)) {
        console.error('qianwen.csv not found.');
        process.exit(1);
    }

    const rawCsv = fs.readFileSync(csvPath, 'utf8');
    // Split and trim lines, keep non-empty
    const lines = rawCsv
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    // Expect a header: Action,Data,Expected Result
    const instructions = lines.slice(1); // Skip header line

    const chromePath = process.env.CHROME_PATH || undefined;

    // Read HEADLESS/HARDLESS from Settings.json and convert to boolean (do not modify the file)
    const settingsPath = path.resolve(__dirname, 'Settings.json');
    let headlessMode = false; // default behavior remains non-headless if no valid provided
    try {
        const settingsRaw = fs.readFileSync(settingsPath, 'utf8');
        const settings = JSON.parse(settingsRaw);
        const raw = (settings && (settings.HARDLESS ?? settings.HEADLESS ?? settings.hardless ?? settings.headless));
        const toBool = (v) => {
            if (typeof v === 'boolean') return v;
            if (typeof v === 'number') return v !== 0;
            if (typeof v === 'string') {
                const s = v.trim().toLowerCase();
                if (s === '') return headlessMode; // empty treated as "use default"
                if (['true', '1', 'yes', 'y', 'on'].includes(s)) return true;
                if (['false', '0', 'no', 'n', 'off'].includes(s)) return false;
            }
            return headlessMode;
        };
        headlessMode = toBool(raw);
        logStep('Headless setting', 'ok', { value: raw, headless: headlessMode });
    } catch (_) {
        // If Settings.json missing or invalid JSON, keep default and continue
        logStep('Headless setting', 'skip', { reason: 'Settings.json missing/invalid', headless: headlessMode });
    }

    const browser = await puppeteer.launch({
        headless: headlessMode,
        executablePath: chromePath,
        defaultViewport: null, // allow window to be maximized
        args: ['--start-maximized'],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    async function waitForAnySelector(page, selectors, options = {}) {
        const timeout = options.timeout ?? 30000;
        for (const sel of selectors) {
            try {
                const handle = await page.waitForSelector(sel, { ...options, timeout });
                if (handle) return { selector: sel, handle };
            } catch (e) {
                // try next selector
            }
        }
        throw new Error('None of selectors found: ' + selectors.join(', '));
    }

    // Additional helpers to improve robustness on pages with modals/iframes
    async function tryAutoClicks(page) {
        const labels = ['同意', '接受', '我同意', '继续', '进入', '开始', '开始体验', '立即使用', '立即体验', '继续访问', '同意并继续', '我知道了'];
        for (const frame of page.frames()) {
            try {
                const clicked = await frame.evaluate((labels) => {
                    const btns = Array.from(document.querySelectorAll('button, a, [role="button"], .btn, .Button'));
                    for (const el of btns) {
                        const txt = (el.textContent || '').trim();
                        if (labels.some((l) => txt.includes(l))) {
                            el.click();
                            return txt;
                        }
                    }
                    return null;
                }, labels);
                if (clicked) {
                    return clicked;
                }
            } catch (_) { }
        }
        return null;
    }

    async function waitForEditableHandle(page, options = {}) {
        const timeout = options.timeout ?? 30000;
        const selectors = [
            'textarea:not([disabled])',
            'input[type="text"]:not([disabled])',
            'input:not([type]):not([disabled])',
            '[role="textbox"]',
            '[contenteditable="true"]',
            '[contenteditable]',
            'div[aria-label*="输入"]',
            'textarea[placeholder*="输入"]',
            'textarea[placeholder*="提问"]',
            'input[placeholder*="输入"]',
            'input[placeholder*="提问"]',
        ];
        const start = Date.now();
        while (Date.now() - start < timeout) {
            for (const frame of page.frames()) {
                for (const sel of selectors) {
                    try {
                        const handle = await frame.$(sel);
                        if (handle) {
                            const visible = await frame.evaluate((el) => {
                                const r = el.getBoundingClientRect();
                                const s = getComputedStyle(el);
                                return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
                            }, handle);
                            if (visible) {
                                return { selector: sel, handle, frame };
                            }
                        }
                    } catch (_) { }
                }
            }
            await new Promise(r => setTimeout(r, 300));
        }
        throw new Error('Editable element not found within timeout');
    }

    try {
        for (const line of instructions) {
            if (!line) continue;

            if (line.startsWith('用Chrome打开')) {
                // Extract URL
                const urlMatch = line.match(/https?:\/\/\S+/i);
                const url = (urlMatch ? urlMatch[0] : 'http://www.qianwen.com').replace(/[，。,\u3002]+$/g, '');

                await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
                await page.bringToFront();
                await new Promise(r => setTimeout(r, 500));
                await tryAutoClicks(page).catch(() => null);
                logStep('Open URL and maximize window', 'ok', { url });

            } else if (line.startsWith('在输入区输入')) {
                // Get the text after the leading instruction
                let text = line.replace(/^在输入区输入\s*/, '').trim();
                // If someone put trailing CSV commas into the same cell, strip them
                text = text.replace(/,+\s*$/, '');

                // Try to dismiss any consent/start modals if present
                await tryAutoClicks(page).catch(() => null);

                const { selector, handle } = await waitForEditableHandle(page, { timeout: 60000 });

                // Focus and type into the element (works across iframes)
                await handle.click({ clickCount: 1 });
                try { await handle.focus(); } catch (_) { }
                try {
                    await handle.type(text, { delay: 20 });
                } catch (e) {
                    await handle.evaluate((el, value) => {
                        const tag = (el.tagName || '').toLowerCase();
                        if ('value' in el) {
                            el.value = value;
                        } else {
                            el.textContent = value;
                        }
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }, text);
                }

                logStep('Type prompt into input area', 'ok', { selector, text });

            } else if (line.trim() === '回车') {
                await page.keyboard.press('Enter');
                logStep('Press Enter', 'ok');

            } else if (line.startsWith("读取 class='token'")) {
                // Wait until tokens appear and either:
                //  - exact ":" token followed by another token, or
                //  - any token containing ":"
                await page.waitForFunction(() => {
                    const nodes = Array.from(document.querySelectorAll('.token'));
                    if (!nodes.length) return false;
                    const texts = nodes.map((n) => (n.textContent || '').trim());
                    const exactIdx = texts.findIndex((t) => t === ':');
                    if (exactIdx >= 0 && exactIdx + 1 < texts.length && texts[exactIdx + 1]) return true;
                    const containIdx = texts.findIndex((t) => t.includes(':'));
                    if (containIdx >= 0) return true;
                    return false;
                }, { timeout: 120000 });

                const extracted = await page.evaluate(() => {
                    const texts = Array.from(document.querySelectorAll('.token'))
                        .map((n) => (n.textContent || '').trim())
                        .filter((t) => t.length);

                    let value = null;
                    const idxExact = texts.findIndex((t) => t === ':');
                    if (idxExact >= 0 && idxExact + 1 < texts.length) {
                        value = texts[idxExact + 1];
                    } else {
                        const idxContain = texts.findIndex((t) => t.includes(':'));
                        if (idxContain >= 0) {
                            const after = texts[idxContain].split(':').slice(1).join(':').trim();
                            value = after || (texts[idxContain + 1] || '').trim();
                        }
                    }
                    return value;
                });

                const result = { value: extracted ?? null, timestamp: new Date().toISOString() };
                const dataPath = path.resolve(__dirname, 'data.json');
                fs.writeFileSync(dataPath, JSON.stringify(result, null, 2), 'utf8');
                logStep('Extract .token value after ":" and save to data.json', 'ok', { extracted });

            } else {
                logStep('Unknown instruction', 'skip', { line });
            }
        }
    } catch (err) {
        logStep('Error', 'fail', { message: err.message, stack: err.stack });
    } finally {
        try {
            await browser.close();
        } catch (_) {
            // ignore
        }
        const logPath = path.resolve(__dirname, 'log.json');
        fs.writeFileSync(logPath, JSON.stringify(runLog, null, 2), 'utf8');
    }
})();