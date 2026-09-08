import { createHash } from 'node:crypto';

import type { GazetteEntry } from './types.js';

/**
 * A stable identity for one publication. `cve` (Codigo de Verificacion Electronica) is the
 * source's own real per-publication id when present - the common case. When it's absent (the
 * link text didn't match the `CVE-(\d+)` pattern - see src/parsers/table.ts), falls back to a
 * content hash of the fields that make this entry unique within one edition/section, mirroring
 * entrerios-compras-monitor's approach for a source with no reliable native id at all.
 */
export function recordIdOf(entry: GazetteEntry): string {
    if (entry.cve) return entry.cve;
    return createHash('sha1').update(`${entry.seccion}|${entry.edicion}|${entry.descripcion}|${entry.pdfUrl ?? ''}`).digest('hex');
}

/**
 * A stable content fingerprint of everything about a publication that could change if the same
 * cve is re-published with a correction - excludes cve/seccion/edicion/fecha/scrapedAt
 * (identity/context, not content). Free to compute: every field is already parsed from the one
 * section fetch this actor always makes.
 */
export function fingerprintOf(entry: GazetteEntry): string {
    const stable = {
        rama: entry.rama,
        ministerio: entry.ministerio,
        organismo: entry.organismo,
        descripcion: entry.descripcion,
        pdfUrl: entry.pdfUrl,
    };
    return createHash('sha1').update(JSON.stringify(stable)).digest('hex');
}
