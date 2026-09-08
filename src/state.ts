import { Actor } from 'apify';

// A NAMED key-value store (not the run's default one, which is isolated per
// run and would not survive between scheduled runs) - this is what makes
// "only new/changed since last run" possible across a recurring schedule
// (e.g. re-running the same day to catch late-added entries, or day over
// day if this actor is ever extended to accept a historical date).
const STATE_STORE_NAME = 'diario-oficial-cl-monitor-delta-state';
const MAX_SEEN_IDS = 20_000;

/** Content fingerprint per record_id - the only thing that can meaningfully "change" about a
 *  gazette entry once published is a correction re-publishing the same cve with amended text.
 *  There is no status/lifecycle concept in this domain (a published legal notice is never
 *  "closed" or "awarded"), so unlike the fleet's tender-monitor actors, this state has no
 *  separate estado/vistaOrigen field to track - see src/delta.ts. */
export interface SeenEntry {
    hash: string;
}

export interface DeltaState {
    entries: Record<string, SeenEntry>;
    lastRunAt: string;
}

function emptyState(): DeltaState {
    return { entries: {}, lastRunAt: '' };
}

function isValidState(value: unknown): value is DeltaState {
    if (!value || typeof value !== 'object') return false;
    const v = value as Partial<DeltaState>;
    return typeof v.entries === 'object' && v.entries !== null;
}

export async function loadState(): Promise<DeltaState> {
    const store = await Actor.openKeyValueStore(STATE_STORE_NAME);
    const state = await store.getValue<unknown>('state');
    return isValidState(state) ? state : emptyState();
}

/** Pure and exported on its own so the cap/ordering logic is testable without touching Actor's
 *  key-value store. This run's ids go first, then whatever from the previous state wasn't
 *  re-seen, capped so the store doesn't grow unbounded across months/years of daily editions. */
export function mergeEntries(
    previousEntries: Record<string, SeenEntry>,
    observedThisRun: readonly { id: string; entry: SeenEntry }[],
    cap = MAX_SEEN_IDS,
): Record<string, SeenEntry> {
    const observedIds = new Set(observedThisRun.map((o) => o.id));
    const order = [...observedThisRun.map((o) => o.id), ...Object.keys(previousEntries).filter((id) => !observedIds.has(id))];
    const cappedIds = order.slice(0, cap);

    const merged: Record<string, SeenEntry> = { ...previousEntries };
    for (const { id, entry } of observedThisRun) merged[id] = entry;

    const result: Record<string, SeenEntry> = {};
    for (const id of cappedIds) {
        const entry = merged[id];
        if (entry) result[id] = entry;
    }
    return result;
}

export async function saveState(entries: Record<string, SeenEntry>, runAt: string): Promise<void> {
    const store = await Actor.openKeyValueStore(STATE_STORE_NAME);
    await store.setValue('state', { entries, lastRunAt: runAt });
}
