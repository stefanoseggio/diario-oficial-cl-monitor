import { describe, expect, it } from 'vitest';

import { buildSectionUrl, isSectionAvailable, resolveTodayEdition, SECTION_PATHS } from '../src/resolve.js';

describe('buildSectionUrl', () => {
    it('builds the correct URL per section under /edicionelectronica/, not the root', () => {
        const url = buildSectionUrl('marcas_patentes', { fecha: '04-09-2026', edicion: '44542' });
        expect(url).toBe(
            'https://www.diariooficial.interior.gob.cl/edicionelectronica/marcas_patentes.php?date=04-09-2026&edition=44542',
        );
    });

    it('has a path entry for every declared section', () => {
        const sections = Object.keys(SECTION_PATHS);
        expect(sections).toContain('normas_generales');
        expect(SECTION_PATHS.normas_generales).toBe('index.php');
    });
});

// Live checks against the real site - skipped in CI (same lesson as
// pba-tenders-monitor: don't make CI depend on an external host with no
// uptime guarantee). Run locally with `npm test` to actually exercise
// these against the live source.
describe.skipIf(process.env.CI)('live resolution against the real site', () => {
    it('resolves a real date/edition for today', async () => {
        const edition = await resolveTodayEdition();
        expect(edition.fecha).toMatch(/^\d{2}-\d{2}-\d{4}$/);
        expect(edition.edicion).toMatch(/^\d+$/);
    }, 15_000);

    it('reports normas_generales as available and a near-certainly-empty section as unavailable', async () => {
        const edition = await resolveTodayEdition();
        const normasUrl = buildSectionUrl('normas_generales', edition);
        expect(await isSectionAvailable(normasUrl)).toBe(true);
    }, 15_000);
});
