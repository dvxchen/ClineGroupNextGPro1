'use strict';

/**
 * Generated from Demo.csv (columns: Action, Data, Expected Result)
 *
 * Steps implemented:
 * 1) 用Chrome打开 https://usj-demo-dev-ui5.e17df97.stage.kyma.ondemand.com/ 并最大化窗口
 * 2) 点击 Forecast Deviation Alert: Royalty 里的 link: "View"
 * 3) 点击 TAB: "Key Drivers for Future Performance"
 * 4) 点击 第一个 .sapMLnkText 的 link
 * 5) 点击 "FX Forecast Agent"
 * 6) 点击 TAB: "Interest Rate Differentials"
 * 7) 读取 United States 行的 CPI 字段值，取 % 符号前面的部分，与 Windows AppData\Roaming\data.json 中的 value 字段比较
 *
 * Prerequisites to run:
 *   npm i -D playwright
 *   npx playwright install chrome
 * Run:
 *   node test.js
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// JSON logging to log.json (one JSON object per line)
const LOG_PATH = path.join(__dirname, 'log.json');
function logEvent(level, step, action, data) {
    try {
        const entry = {
            time: new Date().toISOString(),
            level,
            step,
            action,
            data: data === undefined ? null : data
        };
        fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n');
    } catch (_) { /* ignore logging errors */ }
}

// Clean log file at the start of every run
try { fs.writeFileSync(LOG_PATH, ''); } catch (_) { /* ignore */ }


/* Read HEADLESS/HARDLESS from Settings.json and convert to boolean */
function toBooleanLike(v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        if (['true', 'yes', 'y', '1', 'on'].includes(s)) return true;
        if (['false', 'no', 'n', '0', 'off'].includes(s)) return false;
    }
    return undefined;
}

function readHeadlessSetting(defaultValue = false) {
    try {
        const settingsPath = path.join(__dirname, 'Settings.json');
        if (!fs.existsSync(settingsPath)) {
            console.warn('[WARN] Settings.json not found at', settingsPath, '- using default headless=', defaultValue);
            return defaultValue;
        }
        const json = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));

        // Prefer HEADLESS, fallback to HARDLESS (legacy)
        const hasHeadless = Object.prototype.hasOwnProperty.call(json, 'HEADLESS');
        const hasHardless = Object.prototype.hasOwnProperty.call(json, 'HARDLESS');
        const key = hasHeadless ? 'HEADLESS' : (hasHardless ? 'HARDLESS' : null);

        if (!key) {
            console.warn('[WARN] HEADLESS/HARDLESS not found in Settings.json - using default headless=', defaultValue);
            return defaultValue;
        }

        const parsed = toBooleanLike(json[key]);
        if (parsed === undefined) {
            console.warn('[WARN] Unrecognized', key, 'value in Settings.json:', json[key], '- using default headless=', defaultValue);
            return defaultValue;
        }
        return parsed;
    } catch (e) {
        console.warn('[WARN] Failed to read/parse Settings.json - using default headless=', defaultValue, '; error:', e.message);
        return defaultValue;
    }
}

const HEADLESS = readHeadlessSetting();

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractNumber(v) {
    if (v === null || v === undefined) return;
    const s = String(v).replace(/,/g, '').trim();
    const m = s.match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
}

async function clickTab(page, tabText) {
    const exactRe = new RegExp('^' + escapeRegex(tabText) + '$', 'i');
    // Try ARIA role=tab
    try {
        const tab = page.getByRole('tab', { name: exactRe }).first();
        await tab.waitFor({ state: 'visible', timeout: 5000 });
        await tab.click();
        return;
    } catch (_) { }

    // Try button fallback (some UI5 tabs are buttons)
    try {
        const btn = page.getByRole('button', { name: exactRe }).first();
        await btn.waitFor({ state: 'visible', timeout: 5000 });
        await btn.click();
        return;
    } catch (_) { }

    // Fallback: text selector
    await page.locator(`text=${tabText}`).first().click();
}

async function clickByText(page, text) {
    const re = new RegExp('^' + escapeRegex(text) + '$', 'i');
    // Prefer ARIA buttons/links if possible
    try {
        const link = page.getByRole('link', { name: re }).first();
        await link.waitFor({ state: 'visible', timeout: 4000 });
        await link.click();
        return;
    } catch (_) { }

    try {
        const btn = page.getByRole('button', { name: re }).first();
        await btn.waitFor({ state: 'visible', timeout: 4000 });
        await btn.click();
        return;
    } catch (_) { }

    await page.locator(`text=${text}`).first().click();
}

async function clickLinkInSection(page, sectionText, linkText) {
    // Find a container element that includes the section text, then click its "View" link/button
    const section = page.locator(`text=${sectionText}`).first();
    try {
        await section.first().waitFor({ state: 'visible', timeout: 5000 });
    } catch (_) {
        // If the section itself isn't an element, fall back to global search for "View"
    }

    try {
        await section.locator(`a:has-text("${linkText}")`).first().click({ timeout: 3000 });
        return;
    } catch (_) { }

    try {
        await section.locator(`button:has-text("${linkText}")`).first().click({ timeout: 3000 });
        return;
    } catch (_) { }

    // Fallback to global "View" if scoping fails
    try {
        await page.locator(`a:has-text("${linkText}"), button:has-text("${linkText}")`).first().click({ timeout: 5000 });
    } catch (err) {
        throw new Error(`Unable to click "${linkText}" inside "${sectionText}": ${err.message}`);
    }
}

async function getTableCellValue(page, rowLabel, columnHeaderLabel) {
    // Tries HTML table first, then ARIA role="table" structures.
    return await page.evaluate(({ rowLabel, columnHeaderLabel }) => {
        function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }

        function findInHtmlTable(tableEl) {
            const headerCandidates =
                Array.from(tableEl.querySelectorAll('thead th, thead [role="columnheader"], tr th, [role="columnheader"]'));
            const headers = headerCandidates.map(th => (th.textContent || '').trim());
            let colIdx = headers.findIndex(h => norm(h) === norm(columnHeaderLabel));
            if (colIdx === -1 && headers.length > 0) {
                // If exact match not found, try contains
                colIdx = headers.findIndex(h => norm(h).includes(norm(columnHeaderLabel)));
            }
            if (colIdx === -1) return null;

            const bodyRows = tableEl.querySelectorAll('tbody tr, tr');
            for (const tr of Array.from(bodyRows)) {
                const rowText = norm(tr.textContent || '');
                if (rowText.includes(norm(rowLabel))) {
                    const cells = Array.from(tr.querySelectorAll('td, [role="cell"]'));
                    if (colIdx < cells.length) {
                        return (cells[colIdx].textContent || '').trim();
                    }
                }
            }
            return null;
        }

        //1) Plain tables
        const tables = Array.from(document.querySelectorAll('table'));
        for (const t of tables) {
            const val = findInHtmlTable(t);
            if (val !== null) return val;
        }

        // 2) ARIA table
        const ariaTables = Array.from(document.querySelectorAll('[role="table"]'));
        for (const t of ariaTables) {
            const headerCandidates =
                Array.from(t.querySelectorAll('[role="columnheader"], thead th, tr th'));
            const headers = headerCandidates.map(th => (th.textContent || '').trim());
            let colIdx = headers.findIndex(h => norm(h) === norm(columnHeaderLabel));
            if (colIdx === -1 && headers.length > 0) {
                colIdx = headers.findIndex(h => norm(h).includes(norm(columnHeaderLabel)));
            }
            if (colIdx === -1) continue;

            const rows = Array.from(t.querySelectorAll('[role="row"]'));
            for (const row of rows) {
                const rowText = norm(row.textContent || '');
                if (rowText.includes(norm(rowLabel))) {
                    const cells = Array.from(row.querySelectorAll('[role="cell"], td'));
                    if (colIdx < cells.length) {
                        return (cells[colIdx].textContent || '').trim();
                    }
                }
            }
        }

        return null;
    }, { rowLabel, columnHeaderLabel });
}

(async () => {
    // Launch Chrome and maximize window
    const browser = await chromium.launch({
        channel: 'chrome',
        headless: HEADLESS,
        args: ['--start-maximized'],
    });
    logEvent('info', 0, 'browser_launched', { channel: 'chrome', headless: HEADLESS });
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    try {
        // Step: Open URL and maximize
        await page.goto('https://usj-demo-dev-ui5.e17df97.stage.kyma.ondemand.com/', { waitUntil: 'networkidle' });
        logEvent('info', 1, 'open_url', { url: 'https://usj-demo-dev-ui5.e17df97.stage.kyma.ondemand.com/' });

        // Step: Click "View" inside "Forecast Deviation Alert: Royalty"
        await clickLinkInSection(page, 'Forecast Deviation Alert: Royalty', 'View');
        logEvent('info', 2, 'click_link_in_section', { section: 'Forecast Deviation Alert: Royalty', linkText: 'View' });

        // Step: Click TAB "Key Drivers for Future Performance"
        await clickTab(page, 'Key Drivers for Future Performance');
        logEvent('info', 3, 'click_tab', { tab: 'Key Drivers for Future Performance' });

        // Step: Click the first .sapMLnkText link
        const ui5FirstLink = page.locator('.sapMLnkText').first();
        await ui5FirstLink.waitFor({ state: 'visible' });
        await ui5FirstLink.click();
        logEvent('info', 4, 'click_first_link', { selector: '.sapMLnkText' });

        // Step: Click "FX Forecast Agent"
        await clickByText(page, 'FX Forecast Agent');
        logEvent('info', 5, 'click_text', { text: 'FX Forecast Agent' });

        // Step: Click TAB "Interest Rate Differentials"
        await clickTab(page, 'Interest Rate Differentials');
        logEvent('info', 6, 'click_tab', { tab: 'Interest Rate Differentials' });

        // Step: Read CPI for row "United States"
        const actualCpi = await getTableCellValue(page, 'United States', 'CPI');
        if (actualCpi == null) {
            throw new Error('Unable to locate CPI value for "United States"');
        }
        console.log('[INFO] CPI(United States) from page:', actualCpi);
        logEvent('info', 7, 'read_cpi', { row: 'United States', column: 'CPI', value: actualCpi });

        // Load expected value from Windows AppData Roaming\data.json
        const roamingDir = process.env.APPDATA || path.join(process.env.USERPROFILE || require('os').homedir(), 'AppData', 'Roaming');
        const appDataPath = path.join(roamingDir, 'data.json');
        if (!fs.existsSync(appDataPath)) {
            throw new Error(`Expected file not found: ${appDataPath}`);
        }
        const expectedRaw = JSON.parse(fs.readFileSync(appDataPath, 'utf-8')).value;
        console.log('[INFO] Expected value from', appDataPath, ':', expectedRaw);
        logEvent('info', 8, 'load_expected', { path: appDataPath, value: expectedRaw });

        // Compare using value before '%' (numeric if possible, otherwise strict string)
        const actualBeforePercent = String(actualCpi).split('%')[0];
        console.log('[INFO] Parsed CPI before %:', actualBeforePercent);
        const actualNum = extractNumber(actualBeforePercent);
        const expectedNum = extractNumber(expectedRaw);
        let passed = false;

        if (actualNum != null && expectedNum != null) {
            const eps = 1e-6;
            passed = Math.abs(actualNum - expectedNum) <= eps;
        } else {
            passed = String(actualCpi).trim() === String(expectedRaw).trim();
        }

        if (!passed) {
            throw new Error(`Expectation failed: actual=${actualCpi}, expected=${expectedRaw}`);
        }

        console.log('[PASS] CPI value matches expected.');
        logEvent('pass', 9, 'assertion', { actual: actualCpi, expected: expectedRaw });
        process.exitCode = 0;
    } catch (err) {
        console.error('[FAIL]', err && err.message ? err.message : err);
        logEvent('error', 'n/a', 'exception', { message: err && err.message ? err.message : String(err) });
        process.exitCode = 1;
    } finally {
        await context.close();
        await browser.close();
    }
})();