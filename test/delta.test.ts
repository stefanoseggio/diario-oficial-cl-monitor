import { describe, expect, it } from 'vitest';

import { buildRecord, classifyEntries, passesEventTypes, passesOnlyNew } from '../src/delta.js';
import { fingerprintOf, recordIdOf } from '../src/fingerprint.js';
import type { DeltaState, SeenEntry } from '../src/state.js';
import type { GazetteEntry } from '../src/types.js';

const SECTION_URL = 'https://www.diariooficial.interior.gob.cl/edicionelectronica/index.php?date=04-09-2026&edition=44605';

function entry(overrides: Partial<GazetteEntry> = {}): GazetteEntry {
    return {
        rama: 'PODER EJECUTIVO',
        ministerio: 'MINISTERIO DE SALUD',
        organismo: null,
        descripcion: 'Aprueba reglamento sanitario',
        pdfUrl: 'https://www.diariooficial.interior.gob.cl/publicaciones/2026/09/04/44605/01/12345.pdf',
        cve: '2604321',
        seccion: 'normas_generales',
        edicion: '44605',
        fecha: '04-09-2026',
        scrapedAt: '2026-09-04T12:00:00.000Z',
        ...overrides,
    };
}

const EMPTY_STATE: DeltaState = { entries: {}, lastRunAt: '' };

function stateWith(entries: Record<string, SeenEntry>): DeltaState {
    return { entries, lastRunAt: '' };
}

describe('recordIdOf', () => {
    it('uses cve verbatim when present', () => {
        expect(recordIdOf(entry({ cve: '2604321' }))).toBe('2604321');
    });

    it('falls back to a content hash when cve is null, deterministically', () => {
        const e = entry({ cve: null });
        const id1 = recordIdOf(e);
        const id2 = recordIdOf(e);
        expect(id1).toBe(id2);
        expect(id1).not.toBe('');
        expect(id1).toMatch(/^[0-9a-f]{40}$/);
    });

    it('the fallback hash differs for genuinely different entries', () => {
        const a = recordIdOf(entry({ cve: null, descripcion: 'Uno' }));
        const b = recordIdOf(entry({ cve: null, descripcion: 'Dos' }));
        expect(a).not.toBe(b);
    });
});

describe('classifyEntries', () => {
    it('classifies an unseen entry as NEW_LISTING', () => {
        const [c] = classifyEntries([entry()], EMPTY_STATE);
        expect(c.eventType).toBe('NEW_LISTING');
        expect(c.isNew).toBe(true);
    });

    it('classifies a known id with a different fingerprint as UPDATED (a correction)', () => {
        const e = entry();
        const state = stateWith({ [recordIdOf(e)]: { hash: 'a-hash-that-will-never-match' } });
        const [c] = classifyEntries([e], state);
        expect(c.eventType).toBe('UPDATED');
        expect(c.isNew).toBe(false);
    });

    it('classifies a known id, unchanged fingerprint, as UNCHANGED', () => {
        const e = entry();
        const state = stateWith({ [recordIdOf(e)]: { hash: fingerprintOf(e) } });
        const [c] = classifyEntries([e], state);
        expect(c.eventType).toBe('UNCHANGED');
    });
});

describe('passesOnlyNew / passesEventTypes', () => {
    it('passesOnlyNew excludes UNCHANGED only when onlyNew is true', () => {
        expect(passesOnlyNew('UNCHANGED', true)).toBe(false);
        expect(passesOnlyNew('UNCHANGED', false)).toBe(true);
        expect(passesOnlyNew('NEW_LISTING', true)).toBe(true);
    });

    it('passesEventTypes restricts to the requested subset but always keeps UNCHANGED (onlyNew decides that one)', () => {
        expect(passesEventTypes('UPDATED', ['UPDATED'])).toBe(true);
        expect(passesEventTypes('NEW_LISTING', ['UPDATED'])).toBe(false);
        expect(passesEventTypes('UNCHANGED', ['UPDATED'])).toBe(true);
        expect(passesEventTypes('NEW_LISTING', undefined)).toBe(true);
    });
});

describe('buildRecord', () => {
    it('prefers pdfUrl as source_url when present', () => {
        const e = entry({ pdfUrl: 'https://example.cl/doc.pdf' });
        const [c] = classifyEntries([e], EMPTY_STATE);
        const record = buildRecord(c, SECTION_URL);
        expect(record.source_url).toBe('https://example.cl/doc.pdf');
    });

    it('falls back to the section URL when pdfUrl is null', () => {
        const e = entry({ pdfUrl: null });
        const [c] = classifyEntries([e], EMPTY_STATE);
        const record = buildRecord(c, SECTION_URL);
        expect(record.source_url).toBe(SECTION_URL);
    });

    it('carries the envelope fields through correctly', () => {
        const e = entry();
        const [c] = classifyEntries([e], EMPTY_STATE);
        const record = buildRecord(c, SECTION_URL);
        expect(record.record_id).toBe(e.cve);
        expect(record.event_type).toBe('NEW_LISTING');
        expect(record.is_new).toBe(true);
        expect(record.contentHash).toBe(fingerprintOf(e));
        expect(record.descripcion).toBe(e.descripcion); // original fields still present
    });
});
