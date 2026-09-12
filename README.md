# Chile Official Gazette Monitor - Diario Oficial Laws & Decrees Tracker (Regulatory Intelligence)

## Executive Value Proposition

Reading Chile's Diario Oficial by hand means opening today's edition, scrolling one long hierarchical table with no filtering or search, and manually tracking which branch, ministry or agency each entry belongs to - repeated every single publishing day. This Actor resolves today's edition automatically, extracts every entry from the sections you select with its full branch/ministry/agency hierarchy and a direct PDF link, and classifies each one against a persisted history of what was already seen. Point it at a recurring schedule with delta mode (`onlyNew`) turned on, and each run returns only publications that are genuinely new or corrected since the last check - not the whole table re-read from scratch.

## Use Cases

- **Legal and compliance teams** watching for new regulations, decrees or resolutions in their sector can filter on `ministerio`, `organismo` and `descripcion`, and route anything tagged `event_type: NEW_LISTING` to the right internal owner for review.
- **Law firms and consultancies** tracking specific ministries or agencies on behalf of clients can catch a *fe de erratas* - a correction re-published under the same CVE with amended text - the moment it appears, via `event_type: UPDATED` and the corrected `pdfUrl`, and re-check the amended text before advising anyone.
- **Market and regulatory intelligence teams** can trend regulatory activity by government branch, ministry and section (`rama`, `ministerio`, `seccion`) across recurring runs, without re-reading the same edition by eye.

## Input

```json
{ "sections": ["normas_generales", "marcas_patentes"], "maxItems": 100 }
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `sections` | array | `["normas_generales"]` | Which sections of the edition to fetch. Not every section publishes content every day - one with nothing that day returns 404 from the source and is skipped, not treated as an error. |
| `maxItems` | integer | `300` | Hard cap on the number of publications returned this run, across all selected sections. |
| `onlyNew` | boolean | `false` | Delta mode: return only publications that are `NEW_LISTING` (never seen) or `UPDATED` (a correction to a known entry, same CVE, amended content) since a prior run today. |
| `eventTypes` | array | both | Which of `NEW_LISTING`/`UPDATED` to deliver when `onlyNew` is on. |

Only today's edition is supported - no reliable way to resolve an arbitrary past date's edition number was found, so there is no historical-date input. Seven sections are selectable; at audit time only `normas_generales` had confirmed real content, so the other six are wired up against the same parser but have not each been verified end to end with live data.

## Output

```json
{
  "rama": "PODER EJECUTIVO",
  "ministerio": "MINISTERIO DE ECONOMIA, FOMENTO Y TURISMO",
  "organismo": "Subsecretaria de Pesca y Acuicultura",
  "descripcion": "Extracto de resolucion exenta numero 2.092, de 2026.- Modifica resolucion N 159 exenta, de 2026",
  "pdfUrl": "https://www.diariooficial.interior.gob.cl/publicaciones/2026/09/04/44542/01/2865015.pdf",
  "cve": "2865015",
  "seccion": "normas_generales",
  "edicion": "44542",
  "fecha": "04-09-2026",
  "scrapedAt": "2026-09-04T16:16:42.538Z",
  "record_id": "2865015",
  "event_type": "NEW_LISTING",
  "is_new": true,
  "source_url": "https://www.diariooficial.interior.gob.cl/publicaciones/2026/09/04/44542/01/2865015.pdf",
  "contentHash": "a1b2c3..."
}
```

`rama` / `ministerio` / `organismo` carry the full government hierarchy each entry is filed under, inherited from the last heading seen while walking the edition's table top to bottom. `pdfUrl` and `source_url` point at the official per-publication PDF when the source provides one - not a shared section page. `record_id` is the CVE (Codigo de Verificacion Electronica, the source's own per-publication id) when present, falling back to a content hash on the rare, disclosed occasion the link text doesn't match the expected CVE pattern.

## Reliability

The site's default HTTP fingerprint check blocks Crawlee's own `CheerioCrawler` client (`got-scraping`) with a JS bot-check stub in place of the real page, verified live against the identical URL at the identical moment where a plain Node `fetch()` call received the real ~22KB edition table. For that reason this Actor has no `crawlee` dependency at all: `src/fetchSection.ts` fetches every section with native `fetch()` plus its own exponential-backoff retry loop, and `src/resolve.ts` resolves today's edition through the site's own redirect before checking each requested section's availability - a 404 there means nothing was published in that section today, and is skipped rather than logged as a failure. Cross-run identity for delta mode is persisted in a named Apify key-value store (capped at the 20,000 most recently seen entries), so `onlyNew` keeps working across a recurring schedule rather than resetting every run. This domain has no status-change or closure concept - a published legal notice is a permanent public record - so the only change an already-seen entry can undergo is a correction, detected by comparing a content fingerprint of its hierarchy, description and PDF link against what was stored last time.

## Pricing

This Actor uses Apify's pay-per-event pricing: **$0.003 per record** delivered to the dataset, plus a flat **$0.00005 per run start**. There is no separate detail/summary tier - every entry is already fully parsed inline from the section table, so every record costs the same regardless of section or event type.

## Support & Enterprise SLA

This Actor is built and maintained by an independent developer, not a staffed vendor team - there is no dedicated support desk or contractual uptime SLA on offer. Questions, bugs, or coverage requests (for example, a section that starts publishing content the parser doesn't handle as expected) are handled through the Apify Store's Issues tab and are typically addressed within 48 hours.
