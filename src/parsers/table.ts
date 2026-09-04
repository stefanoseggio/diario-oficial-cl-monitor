import type { CheerioAPI } from 'cheerio';

import type { GazetteEntry, SectionName } from '../types.js';

interface ParseTableOptions {
    seccion: SectionName;
    edicion: string;
    fecha: string;
}

// The edition page is one hierarchical table: title3 = branch of
// government (PODER EJECUTIVO...), title4 = ministry, title5 = agency,
// then one or more class="content" rows are the actual publications
// under whichever heading last appeared. Verified against a live fetch
// of index.php on 2026-09-04 - not every level is always present, so
// context resets to null (not stale) whenever a shallower heading
// reappears, rather than carrying over from an unrelated ministry.
export function parseTable($: CheerioAPI, options: ParseTableOptions): GazetteEntry[] {
    const entries: GazetteEntry[] = [];
    const scrapedAt = new Date().toISOString();

    let rama: string | null = null;
    let ministerio: string | null = null;
    let organismo: string | null = null;

    $('table tr').each((_i, el) => {
        const row = $(el);
        const cell = row.find('td').first();

        if (cell.hasClass('title3')) {
            rama = cell.text().trim();
            ministerio = null;
            organismo = null;
            return;
        }
        if (cell.hasClass('title4')) {
            ministerio = cell.text().trim();
            organismo = null;
            return;
        }
        if (cell.hasClass('title5')) {
            organismo = cell.text().trim();
            return;
        }
        if (!row.hasClass('content')) {
            return;
        }

        const cells = row.find('td');
        const descripcion = cells.eq(0).text().trim();
        if (!descripcion) return;

        const link = cells.eq(1).find('a').first();
        const pdfUrl = link.attr('href')?.trim() ?? null;
        const cveMatch = link.text().match(/CVE-(\d+)/);
        const cve = cveMatch ? cveMatch[1] : null;

        entries.push({
            rama,
            ministerio,
            organismo,
            descripcion,
            pdfUrl,
            cve,
            seccion: options.seccion,
            edicion: options.edicion,
            fecha: options.fecha,
            scrapedAt,
        });
    });

    return entries;
}
