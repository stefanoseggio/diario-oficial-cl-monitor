import { describe, expect, it } from 'vitest';

import { fetchSection } from '../src/fetchSection.js';
import { buildSectionUrl, resolveTodayEdition } from '../src/resolve.js';

// Live integration test against the real Diario Oficial - same tradeoff
// documented in pba-tenders-monitor's tests. Skipped in CI. This is the
// path that actually matters end to end: main.ts calls fetchSection()
// directly, not a CheerioCrawler router - a JS bot-check verified live
// to intercept CheerioCrawler's default HTTP client on this exact URL,
// but not fetch(), is why there is no crawler here at all (see
// fetchSection.ts).
describe.skipIf(process.env.CI)('fetchSection against the live Diario Oficial', () => {
    // Not every day has a normas_generales publication (verified live, 2026-09-19: a Saturday
    // with zero content rows across all 7 sections - see resolve.ts). This asserts the real,
    // current shape either way rather than assuming today happens to have content: an empty
    // array is a legitimate, non-throwing result, and every entry that IS present must be
    // real and correctly stamped.
    it('parses todays normas_generales edition without throwing, and any entries present are real', async () => {
        const edition = resolveTodayEdition();
        const url = buildSectionUrl('normas_generales');

        const { entries, headingsEncountered, noPublicationsNoticeFound } = await fetchSection({
            url,
            seccion: 'normas_generales',
            edicion: edition.edicion,
            fecha: edition.fecha,
        });

        expect(Array.isArray(entries)).toBe(true);
        expect(typeof headingsEncountered).toBe('boolean');
        expect(typeof noPublicationsNoticeFound).toBe('boolean');
        // On a genuine quiet day the live page has NO table/headings at all - just the site's own
        // "nothing published" notice (verified live, 2026-09-19: true of all 7 sections that day).
        // So at least one of the two signals must be true whenever there are zero entries; only
        // when BOTH are false (neither ever observed live) would main.ts treat it as a possible
        // structural break instead of a quiet day.
        if (entries.length === 0) {
            expect(headingsEncountered || noPublicationsNoticeFound).toBe(true);
        }
        for (const entry of entries) {
            expect(typeof entry.descripcion).toBe('string');
            expect(entry.descripcion.length).toBeGreaterThan(0);
            expect(entry.seccion).toBe('normas_generales');
            expect(entry.edicion).toBe(edition.edicion);
            expect(typeof entry.scrapedAt).toBe('string');
        }
    }, 30_000);
});
