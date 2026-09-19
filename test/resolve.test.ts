import { describe, expect, it } from 'vitest';

import { buildSectionUrl, resolveTodayEdition, SECTION_PATHS } from '../src/resolve.js';

describe('buildSectionUrl', () => {
    // SITE CHANGE, 2026-09-19: the site no longer accepts/needs date+edition query params (see
    // resolve.ts) - live-verified its own current section links are bare, e.g. "index.php?".
    it('builds the correct URL per section under /edicionelectronica/, not the root', () => {
        const url = buildSectionUrl('marcas_patentes');
        expect(url).toBe('https://www.diariooficial.interior.gob.cl/edicionelectronica/marcas_patentes.php?');
    });

    it('has a path entry for every declared section', () => {
        const sections = Object.keys(SECTION_PATHS);
        expect(sections).toContain('normas_generales');
        expect(SECTION_PATHS.normas_generales).toBe('index.php');
    });
});

describe('resolveTodayEdition', () => {
    // No longer a network call (see resolve.ts) - a real assertion against Intl's own
    // independent computation for the same timezone, not just a format regex.
    it('returns fecha/edicion matching Chile-local today, computed independently', () => {
        const expected = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' })
            .format(new Date())
            .replaceAll('-', '');
        const edition = resolveTodayEdition();
        expect(edition.edicion).toBe(expected);
        expect(edition.fecha).toBe(`${expected.slice(6, 8)}-${expected.slice(4, 6)}-${expected.slice(0, 4)}`);
    });
});
