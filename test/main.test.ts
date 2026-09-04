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
    it('parses real publications from todays normas_generales edition', async () => {
        const edition = await resolveTodayEdition();
        const url = buildSectionUrl('normas_generales', edition);

        const entries = await fetchSection({
            url,
            seccion: 'normas_generales',
            edicion: edition.edicion,
            fecha: edition.fecha,
        });

        expect(entries.length).toBeGreaterThan(0);

        const first = entries[0];
        expect(typeof first.descripcion).toBe('string');
        expect(first.descripcion.length).toBeGreaterThan(0);
        expect(first.seccion).toBe('normas_generales');
        expect(first.edicion).toBe(edition.edicion);
        expect(typeof first.scrapedAt).toBe('string');
    }, 30_000);
});
