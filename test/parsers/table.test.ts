import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';

import { parseTable } from '../../src/parsers/table.js';

// Reconstructed from a real fetch of index.php?date=04-09-2026&edition=44542
// on 2026-09-04 - same class names, same nesting, same link/CVE format.
const EDITION_HTML = [
    '<table cellmargin="10">',
    '<tr><td class="title1">Sumario</td><td></td></tr>',
    '<tr><td class="title2">Normas Generales</td><td></td></tr>',
    '<tr><td class="title3">PODER EJECUTIVO</td><td></td></tr>',
    '<tr><td class="title4">MINISTERIO DE ECONOMIA, FOMENTO Y TURISMO</td><td></td></tr>',
    '<tr><td class="title5">Subsecretaria de Pesca y Acuicultura</td><td></td></tr>',
    '<tr class="content">',
    '<td>Extracto de resolucion exenta numero 2.092, de 2026.- Modifica resolucion N 159 exenta, de 2026</td>',
    '<td><a target="_blank" href="https://www.diariooficial.interior.gob.cl/publicaciones/2026/09/04/44542/01/2865015.pdf" title="">Ver PDF (CVE-2865015)</a></td>',
    '</tr>',
    '<tr><td class="title4">MINISTERIO DE TRANSPORTES Y TELECOMUNICACIONES</td><td></td></tr>',
    '<tr><td class="title5">Subsecretaria de Telecomunicaciones</td><td></td></tr>',
    '<tr class="content">',
    '<td>Resolucion exenta numero 1.545, de 2026.- Aprueba norma tecnica</td>',
    '<td><a target="_blank" href="https://www.diariooficial.interior.gob.cl/publicaciones/2026/09/04/44542/01/2863871.pdf" title="">Ver PDF (CVE-2863871)</a></td>',
    '</tr>',
    '</table>',
].join('\n');

describe('parseTable', () => {
    it('tracks the rama/ministerio/organismo hierarchy per content row', () => {
        const $ = cheerio.load(EDITION_HTML);
        const entries = parseTable($, { seccion: 'normas_generales', edicion: '44542', fecha: '04-09-2026' });

        expect(entries).toHaveLength(2);
        expect(entries[0]).toEqual({
            rama: 'PODER EJECUTIVO',
            ministerio: 'MINISTERIO DE ECONOMIA, FOMENTO Y TURISMO',
            organismo: 'Subsecretaria de Pesca y Acuicultura',
            descripcion: 'Extracto de resolucion exenta numero 2.092, de 2026.- Modifica resolucion N 159 exenta, de 2026',
            pdfUrl: 'https://www.diariooficial.interior.gob.cl/publicaciones/2026/09/04/44542/01/2865015.pdf',
            cve: '2865015',
            seccion: 'normas_generales',
            edicion: '44542',
            fecha: '04-09-2026',
            scrapedAt: entries[0].scrapedAt,
        });
    });

    it('resets organismo (but not ministerio) when a new title5 appears under the same ministry', () => {
        const $ = cheerio.load(EDITION_HTML);
        const entries = parseTable($, { seccion: 'normas_generales', edicion: '44542', fecha: '04-09-2026' });

        expect(entries[1].rama).toBe('PODER EJECUTIVO');
        expect(entries[1].ministerio).toBe('MINISTERIO DE TRANSPORTES Y TELECOMUNICACIONES');
        expect(entries[1].organismo).toBe('Subsecretaria de Telecomunicaciones');
    });

    it('returns an empty array for a table with no content rows', () => {
        const $ = cheerio.load('<table><tr><td class="title3">PODER EJECUTIVO</td></tr></table>');
        expect(parseTable($, { seccion: 'normas_generales', edicion: '1', fecha: '01-01-2026' })).toEqual([]);
    });
});
