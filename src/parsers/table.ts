import type { CheerioAPI } from 'cheerio';

import type { GazetteEntry, SectionName } from '../types.js';

interface ParseTableOptions {
    seccion: SectionName;
    edicion: string;
    fecha: string;
}

export interface ParseTableResult {
    entries: GazetteEntry[];
    /** Whether any title3/title4/title5 heading cell was seen anywhere in the table, regardless
     *  of whether entries ended up empty. */
    headingsEncountered: boolean;
    /** Whether the page's own explicit "nothing published" notice (`p.nofound`) was present.
     *  Verified live, 2026-09-19: on a genuine quiet day the page has no `<table>` at all - not
     *  even empty title3/4/5 headings - and shows this notice instead ("No existen publicaciones
     *  en esta edicion en la fecha seleccionada"), confirmed identical across all 7 sections on a
     *  day with no edition. So headingsEncountered alone is NOT enough to tell a genuine quiet
     *  day apart from a structural break: both currently show headingsEncountered=false. This
     *  flag is the actual distinguishing signal - see main.ts's zero-entries handling, which
     *  treats "neither headings nor this notice appeared" (not just "no headings") as the real
     *  structural-break case. */
    noPublicationsNoticeFound: boolean;
}

// The edition page is one hierarchical table: title3 = branch of
// government (PODER EJECUTIVO...), title4 = ministry, title5 = agency,
// then one or more class="content" rows are the actual publications
// under whichever heading last appeared. Verified against a live fetch
// of index.php on 2026-09-04 - not every level is always present, so
// context resets to null (not stale) whenever a shallower heading
// reappears, rather than carrying over from an unrelated ministry.
export function parseTable($: CheerioAPI, options: ParseTableOptions): ParseTableResult {
    const entries: GazetteEntry[] = [];
    const scrapedAt = new Date().toISOString();
    let headingsEncountered = false;

    let rama: string | null = null;
    let ministerio: string | null = null;
    let organismo: string | null = null;

    $('table tr').each((_i, el) => {
        const row = $(el);
        const cell = row.find('td').first();

        if (cell.hasClass('title3')) {
            headingsEncountered = true;
            rama = cell.text().trim();
            ministerio = null;
            organismo = null;
            return;
        }
        if (cell.hasClass('title4')) {
            headingsEncountered = true;
            ministerio = cell.text().trim();
            organismo = null;
            return;
        }
        if (cell.hasClass('title5')) {
            headingsEncountered = true;
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

    const noPublicationsNoticeFound = $('.nofound').length > 0;

    return { entries, headingsEncountered, noPublicationsNoticeFound };
}
