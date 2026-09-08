# Diario Oficial Chile Scraper & Monitor

**The regulatory alert feed Chile's official gazette never shipped.** Extracts today's edition of Chile's Diario Oficial: laws, decrees and resolutions, with full hierarchy (branch of government, ministry, agency) and a direct PDF link per publication. No Apify actor covered Chile's Diario Oficial at audit time (2026-09-04); Mexico's DOF and Colombia/Paraguay's procurement systems are covered by other developers, Chile's gazette was not. Keeps it fresh with a delta mode that reports what is genuinely **new or corrected**.

[![Diario Oficial Chile Scraper & Monitor](https://apify.com/actor-badge?actor=stefano_seggio/diario-oficial-cl-monitor)](https://apify.com/stefano_seggio/diario-oficial-cl-monitor)

- **Corrections detected, free.** A fe de erratas re-published under the same CVE with amended text is fingerprinted from the same already-parsed entry and reported as `UPDATED`, instead of looking like a duplicate listing.
- **A real per-publication link, not a shared page.** `source_url` is the official PDF when the source publishes one - unlike most of this fleet's actors, which have no per-record deep link at all.
- **Honest about domain shape.** No fake "closed" or "status change" events - a published legal notice is a permanent public record, and this actor doesn't pretend otherwise.

## Who uses Diario Oficial data

| Team | Question they ask | Fields that answer it | Decision |
| --- | --- | --- | --- |
| Legal and compliance teams | New regulations, decrees or resolutions affecting our sector | `ministerio`, `organismo`, `descripcion`, `event_type=NEW_LISTING` | Route to the right internal owner for review |
| Law firms and consultancies | Did a tracked publication get corrected since we first saw it? | `event_type=UPDATED`, `pdfUrl` | Re-check the amended text before advising a client |
| Market research | Regulatory activity patterns across government branches | `rama`, `ministerio`, `seccion` | Trend analysis by agency and section |

## Delta mode

Set `onlyNew: true` for recurring runs and each run returns only publications that are `NEW_LISTING` (never seen) or `UPDATED` (a correction to a known entry - same CVE, amended content). `eventTypes` narrows which of the two you want. Most useful re-running the same day's edition on a schedule to catch late additions or corrections.

**Honest scope note**: this domain has no status-change or closure concept - a published legal notice is never "adjudicated" or "withdrawn" the way a tender is, so unlike this fleet's procurement-monitor actors there is no `STATUS_CHANGE`/`CLOSED` event here. Considered and deliberately left out - see `AGENTS.md`.

```python
from apify_client import ApifyClient

client = ApifyClient("YOUR_TOKEN")
run = client.actor("stefano_seggio/diario-oficial-cl-monitor").call(run_input={"onlyNew": True})
for item in client.dataset(run["defaultDatasetId"]).iterate_items():
    print(f"[{item['event_type']}] {item['ministerio']} - {item['descripcion']}")
```

```javascript
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: 'YOUR_TOKEN' });
const run = await client.actor('stefano_seggio/diario-oficial-cl-monitor').call({ onlyNew: true });
const { items } = await client.dataset(run.defaultDatasetId).listItems();
```

## Input

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `sections` | array | `["normas_generales"]` | Which sections to fetch. Not every section publishes every day - one with nothing that day returns 404 from the source and is skipped, not treated as an error. |
| `maxItems` | integer | `300` | Hard cap on publications returned this run, across all selected sections. |
| `onlyNew` | boolean | `false` | Delta mode - see Delta mode above |
| `eventTypes` | array | both | Which of `NEW_LISTING`/`UPDATED` to deliver when `onlyNew` is on |

Only today's edition is supported - there is no known way to resolve an arbitrary past date's edition number (see Known limitations).

```json
{ "sections": ["normas_generales", "marcas_patentes"], "maxItems": 100 }
```

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

## How it works

No CheerioCrawler here, deliberately - see Known limitations for why. `src/resolve.ts` resolves today's edition number via the site's own redirect (`/edicionelectronica/` -> `index.php?date=...&edition=...`), checks each requested section for content (a 404 means nothing published there today, not a failure), and `src/fetchSection.ts` fetches available sections with exponential-backoff retries. `src/parsers/table.ts` walks the edition's single hierarchical table top to bottom, tracking which branch/ministry/agency heading was last seen so each publication row inherits the right context.

## How much does it cost to monitor Chile's Diario Oficial?

Pay per event, platform usage included: **$0.003 per record** (`result`) + $0.00005 per run start. No detail/summary split - every entry is already fully parsed inline, at identical cost.

## Known limitations

- **Only today's edition.** No date-lookup mechanism was found during the technical audit; building historical access would need reverse-engineering the site's search/archive feature, not yet done.
- **This actor does not use Crawlee's `CheerioCrawler`.** Verified live (2026-09-04): the exact same URL, same machine, same moment, returns a real ~22KB page with the full table to a plain `fetch()` call, but a ~6KB JS bot-check stub (no table at all) to CheerioCrawler's default HTTP client (`got-scraping`). Whatever fingerprint that check keys on, `fetch()` passes it and `got-scraping` doesn't. The whole actor is built on native `fetch()` instead, with its own retry logic, rather than fighting that mismatch.
- Only `normas_generales` was confirmed to have real content on the audit date; the other six sections all returned 404 that day. They're wired up and should work identically once something is actually published there, but were not verified with real data end to end.
- **`record_id` falls back to a content hash when `cve` is null** - a real, disclosed edge case (the link text didn't match the `CVE-(\d+)` pattern). Frequency not independently verified live.
- No `dateRange` filter - every entry from one run shares the same edition date, so a date-window filter would have no real function here.

Full technical detail is in `AGENTS.md`.

## Resources

- [Diario Oficial de Chile](https://www.diariooficial.interior.gob.cl/)
- [Apify SDK for JavaScript](https://docs.apify.com/sdk/js)
