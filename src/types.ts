export type SectionName =
    | 'normas_generales'
    | 'avisos_destacados'
    | 'marcas_patentes'
    | 'normas_particulares'
    | 'publicaciones_judiciales'
    | 'empresas_cooperativas'
    | 'bom';

/**
 * NEW_LISTING: record_id never seen before. UPDATED: record_id seen before, but its content
 * fingerprint differs - a correction re-published under the same cve (or, when cve is absent,
 * the same content-hash identity). UNCHANGED: seen before, nothing differs - only produced on
 * a full (onlyNew=false) run. There is deliberately no STATUS_CHANGE or CLOSED here: a
 * published gazette entry (a law, decree or resolution) has no lifecycle status and is never
 * "closed" or withdrawn the way a tender is - once published, it is a permanent public record.
 * See AGENTS.md "Delta engine v2".
 */
export type EventType = 'NEW_LISTING' | 'UPDATED' | 'UNCHANGED';

export interface ActorInput {
    sections: SectionName[];
    maxItems: number;
    /** Delta mode: return only entries that are new or amended (a correction) since a prior
     *  run of this actor today (state persisted in a named key-value store scoped to this
     *  actor). Most useful when re-running the same day's edition on a schedule to catch
     *  late additions/corrections - see README/AGENTS.md. */
    onlyNew?: boolean;
    /** Which event types to deliver when onlyNew=true. Ignored (everything delivered) when onlyNew=false. */
    eventTypes?: Exclude<EventType, 'UNCHANGED'>[];
}

export interface GazetteEntry {
    rama: string | null;
    ministerio: string | null;
    organismo: string | null;
    descripcion: string;
    pdfUrl: string | null;
    cve: string | null;
    seccion: SectionName;
    edicion: string;
    fecha: string;
    scrapedAt: string;
}

// The standardized B2B integration envelope shared across this portfolio's fleet, layered on
// top of the raw domain fields above - see src/delta.ts.
export interface GazetteRecord extends GazetteEntry {
    record_id: string;
    event_type: EventType;
    is_new: boolean;
    source_url: string;
    /** sha1 content fingerprint as of this run - see src/fingerprint.ts. */
    contentHash: string;
}
