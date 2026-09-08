import { describe, expect, it } from 'vitest';

import { mergeEntries } from '../src/state.js';
import type { SeenEntry } from '../src/state.js';

function entry(hash = 'h'): SeenEntry {
    return { hash };
}

describe('mergeEntries', () => {
    it('puts this run ids first, then unseen previous ids', () => {
        const merged = mergeEntries(
            { old1: entry(), old2: entry() },
            [
                { id: 'new1', entry: entry() },
                { id: 'new2', entry: entry() },
            ],
        );
        expect(Object.keys(merged)).toEqual(['new1', 'new2', 'old1', 'old2']);
    });

    it('overwrites an existing id with its new hash (a real correction) when re-seen this run', () => {
        const merged = mergeEntries({ a: entry('old-hash') }, [{ id: 'a', entry: entry('new-hash') }]);
        expect(merged.a).toEqual(entry('new-hash'));
    });

    it('caps the result at the given size so the store does not grow unbounded', () => {
        const previous: Record<string, SeenEntry> = {};
        for (let i = 0; i < 10; i++) previous[`old${i}`] = entry();
        const merged = mergeEntries(previous, [{ id: 'new1', entry: entry() }], 5);
        expect(Object.keys(merged)).toHaveLength(5);
        expect(Object.keys(merged)).toEqual(['new1', 'old0', 'old1', 'old2', 'old3']);
    });

    it('handles an empty previous state (cold start)', () => {
        expect(Object.keys(mergeEntries({}, [{ id: 'a', entry: entry() }]))).toEqual(['a']);
    });

    it('handles an empty run (nothing observed) by leaving previous state untouched', () => {
        const previous = { a: entry(), b: entry() };
        expect(mergeEntries(previous, [])).toEqual(previous);
    });
});
