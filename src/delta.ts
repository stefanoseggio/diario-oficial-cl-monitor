import { fingerprintOf, recordIdOf } from './fingerprint.js';
import type { DeltaState, SeenEntry } from './state.js';
import type { EventType, GazetteEntry, GazetteRecord } from './types.js';

export interface Classified {
    entry: GazetteEntry;
    recordId: string;
    eventType: EventType;
    isNew: boolean;
    hash: string;
}

function classify(previous: SeenEntry | undefined, hash: string): { eventType: EventType; isNew: boolean } {
    if (!previous) return { eventType: 'NEW_LISTING', isNew: true };
    if (previous.hash !== hash) return { eventType: 'UPDATED', isNew: false };
    return { eventType: 'UNCHANGED', isNew: false };
}

/** Classifies every fetched entry against the persisted state - pure, no side effects, so
 *  it's directly unit-testable. Does not filter anything; the caller (src/main.ts) applies
 *  onlyNew/eventTypes afterward. */
export function classifyEntries(entries: readonly GazetteEntry[], state: DeltaState): Classified[] {
    return entries.map((entry) => {
        const recordId = recordIdOf(entry);
        const hash = fingerprintOf(entry);
        const { eventType, isNew } = classify(state.entries[recordId], hash);
        return { entry, recordId, eventType, isNew, hash };
    });
}

export function passesOnlyNew(eventType: EventType, onlyNew: boolean): boolean {
    return !onlyNew || eventType !== 'UNCHANGED';
}

export function passesEventTypes(eventType: EventType, eventTypes: readonly EventType[] | undefined): boolean {
    return !eventTypes || eventType === 'UNCHANGED' || eventTypes.includes(eventType);
}

// pdfUrl is a genuine per-publication deep link when present (unlike most of this fleet's
// sibling actors, which have no per-record URL at all) - preferred over the shared section
// URL fallback, which only applies on the rare occasion pdfUrl itself is null.
export function buildRecord(c: Classified, sectionUrl: string): GazetteRecord {
    return {
        ...c.entry,
        record_id: c.recordId,
        event_type: c.eventType,
        is_new: c.isNew,
        source_url: c.entry.pdfUrl ?? sectionUrl,
        contentHash: c.hash,
    };
}
