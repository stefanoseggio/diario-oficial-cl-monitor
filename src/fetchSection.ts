import * as cheerio from 'cheerio';

import { parseTable, type ParseTableResult } from './parsers/table.js';
import type { SectionName } from './types.js';

interface FetchSectionOptions {
    url: string;
    seccion: SectionName;
    edicion: string;
    fecha: string;
    maxRetries?: number;
    baseDelayMs?: number;
}

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

// Uses native fetch(), not Crawlee's got-scraping-based CheerioCrawler.
// Verified live, 2026-09-04: this exact URL returns a ~6KB JS bot-check
// stub ("window['bobcmn'] = ...", no <table>, no title3) to
// CheerioCrawler's default HTTP client, but a full ~22KB real page with
// the actual gazette table to a plain fetch() call - same network,
// same machine, same moment. Whatever fingerprint the check keys on,
// fetch() passes it and got-scraping doesn't. Retries here are for
// transient network failures, not for beating that check - if this
// stops working, the fix is a different client fingerprint, not more
// retries.
export async function fetchSection(options: FetchSectionOptions): Promise<ParseTableResult> {
    const { url, seccion, edicion, fecha, maxRetries = 4, baseDelayMs = 1000 } = options;

    let lastError: Error = new Error('unreachable');

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, { redirect: 'follow' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const html = await response.text();
            const $ = cheerio.load(html);
            return parseTable($, { seccion, edicion, fecha });
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < maxRetries) {
                const delayMs = baseDelayMs * 2 ** attempt;
                await sleep(delayMs);
            }
        }
    }

    throw lastError;
}
