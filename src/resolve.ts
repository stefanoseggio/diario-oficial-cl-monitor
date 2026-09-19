import type { SectionName } from './types.js';

const BASE_URL = 'https://www.diariooficial.interior.gob.cl';

export const SECTION_PATHS: Record<SectionName, string> = {
    normas_generales: 'index.php',
    avisos_destacados: 'avisos_destacados.php',
    marcas_patentes: 'marcas_patentes.php',
    normas_particulares: 'normas_particulares.php',
    publicaciones_judiciales: 'publicaciones_judiciales.php',
    empresas_cooperativas: 'empresas_cooperativas.php',
    bom: 'bom.php',
};

export interface ResolvedEdition {
    fecha: string;
    edicion: string;
}

// SITE CHANGE, caught by the live test on 2026-09-19, not by inspection: this used to resolve
// via a 302 redirect from /edicionelectronica/ to index.php?date=DD-MM-YYYY&edition=NNNNN, which
// is where fecha/edicion came from. The site no longer redirects at all - fetch() now gets a
// direct 200 at /edicionelectronica/ (redirected: false) showing today's edition inline, and its
// own section links are now bare (e.g. "index.php?" with an empty query string, verified live in
// a real browser). There is no edition number exposed anywhere on the page anymore (checked the
// raw HTML for meta tags, JS variables and visible text - none). So: fecha is now computed
// locally from the actual date in Chile's own timezone (this source publishes on Chile time,
// not wherever this actor happens to run), and edicion - which only ever mattered as a
// same-day-uniqueness key for the no-cve fallback id in fingerprint.ts, never as the official
// government sequence number - is derived from that same date rather than left unresolved.
function todayInSantiago(): { day: string; month: string; year: string } {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Santiago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return { day: get('day'), month: get('month'), year: get('year') };
}

export function resolveTodayEdition(): ResolvedEdition {
    const { day, month, year } = todayInSantiago();
    return { fecha: `${day}-${month}-${year}`, edicion: `${year}${month}${day}` };
}

// Real bug, caught by the live test, not by inspection: the root-level
// /index.php is a completely different, unrelated page (29KB, no table
// at all) - only /edicionelectronica/index.php is the actual edition
// page. An earlier manual check against the root path returned a 200
// with real-looking word count and was wrongly taken as confirmation;
// only the automated live test against the real parser caught that it
// wasn't the same content. Verified directly: the two response bodies
// are different lengths and only one contains a "title3" cell.
//
// date=/edition= query params removed here (SITE CHANGE, 2026-09-19, see resolveTodayEdition):
// live-verified that the site's own current links are bare ("index.php?", no query values) and
// that fetching that exact bare URL returns today's real content - passing stale/synthetic
// date+edition values instead risked the server either ignoring them (harmless) or, worse,
// trying to honor a real-looking but wrong edition number and silently serving the wrong day.
export function buildSectionUrl(section: SectionName): string {
    const path = SECTION_PATHS[section];
    return `${BASE_URL}/edicionelectronica/${path}?`;
}
