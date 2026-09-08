# Changelog

## 2.0.0 - 2026-09-08

The first delta engine this actor has ever had - previously it simply re-extracted the full edition every run with no notion of "seen before". See AGENTS.md "Delta engine v2" for the full technical reasoning.

### Added

- **Standardized B2B envelope**: every record now carries `record_id`, `event_type`, `is_new`, `source_url`, `contentHash` - previously absent entirely.
- **`UPDATED` events**: a correction re-published under the same CVE with amended text is detected via a sha1 content fingerprint (`contentHash`) and reported as `UPDATED`, instead of looking like a duplicate `NEW_LISTING`.
- **`onlyNew`/`eventTypes` inputs**: for re-running the same day's edition on a schedule to catch late additions/corrections.
- `record_id` = the source's own CVE when present, a content-hash fallback otherwise (a real, disclosed edge case).
- `source_url` now prefers the publication's own PDF link over a shared section URL, where present.
- `src/state.ts`, `src/fingerprint.ts`, `src/delta.ts` (new). Apache-2.0 `LICENSE`, this `CHANGELOG.md`, an `npx eslint .` step in CI.

### Not added, on purpose

- **No `STATUS_CHANGE` or `CLOSED` events** - this domain has no status/lifecycle concept; a published legal notice is a permanent public record, never "closed" or "awarded". Considered and explicitly rejected, not omitted by oversight.
- **No `dateRange` input** - every entry from one run shares the same edition date, so a date-range filter would be a trivial pass/fail-everything operation with no real function.
- **No historical-date support** - still resolves today's edition only; there is no live-verified way to compute a past date's edition number.
- **No pricing change** - single `result` event, same as v1; no natural detail/summary cost split exists in this domain.

### Fixed

- Production `start` script tidied for local-dev consistency - the Dockerfile's own `CMD` never depended on it (multi-stage build, `dist/` correctly stays gitignored, same shape as cordoba-compras-monitor and pba-tenders-monitor).
