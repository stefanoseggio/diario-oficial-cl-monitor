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

// The site resolves "today's edition" via a 302 redirect from
// /edicionelectronica/ to index.php?date=DD-MM-YYYY&edition=NNNNN - there
// is no other way found to compute the edition number for a given date
// (it is not a simple offset from the calendar date). Verified live,
// 2026-09-04: a plain, standards-compliant fetch() follows this redirect
// correctly and reports the resolved URL - deliberately not done through
// CheerioCrawler's own request/session machinery, which returned an
// empty body for this same URL in an earlier test and was never fully
// explained. This isolated resolution step sidesteps that uncertainty
// rather than building on top of it.
export async function resolveTodayEdition(): Promise<ResolvedEdition> {
    const response = await fetch(`${BASE_URL}/edicionelectronica/`, { redirect: 'follow' });
    if (!response.ok) {
        throw new Error(`No se pudo resolver la edicion de hoy: HTTP ${response.status}`);
    }

    const finalUrl = new URL(response.url);
    const fecha = finalUrl.searchParams.get('date');
    const edicion = finalUrl.searchParams.get('edition');
    if (!fecha || !edicion) {
        throw new Error(`No se pudo extraer date/edition de la URL resuelta: ${response.url}`);
    }

    return { fecha, edicion };
}

// Real bug, caught by the live test, not by inspection: the root-level
// /index.php is a completely different, unrelated page (29KB, no table
// at all) - only /edicionelectronica/index.php is the actual edition
// page. An earlier manual check against the root path returned a 200
// with real-looking word count and was wrongly taken as confirmation;
// only the automated live test against the real parser caught that it
// wasn't the same content. Verified directly: the two response bodies
// are different lengths and only one contains a "title3" cell.
export function buildSectionUrl(section: SectionName, edition: ResolvedEdition): string {
    const path = SECTION_PATHS[section];
    return `${BASE_URL}/edicionelectronica/${path}?date=${edition.fecha}&edition=${edition.edicion}`;
}

// Not every section publishes content every day - the source returns a
// genuine 404 for an empty section rather than a page with zero rows
// (verified live: 5 of 6 non-default sections 404'd on 2026-09-04, only
// normas_generales had content). Checked with a plain fetch before
// handing anything to CheerioCrawler, so an empty section is logged and
// skipped, never treated as a crawl failure.
export async function isSectionAvailable(url: string): Promise<boolean> {
    const response = await fetch(url, { method: 'GET', redirect: 'follow' });
    return response.ok;
}
