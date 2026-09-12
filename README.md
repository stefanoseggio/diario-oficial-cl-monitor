<h1 align="center">Diario Oficial Chile - Laws & Decrees Delta Feed</h1>

<p align="center">
  <strong>A pay-per-event monitor for Chile's official gazette — laws, decrees and resolutions, extracted the day they publish.</strong>
</p>

<p align="center">
  <a href="https://apify.com"><img src="https://img.shields.io/badge/Built%20for-Apify-FF9012?logo=apify&logoColor=white" alt="Built for Apify"></a>
  <img src="https://img.shields.io/badge/pricing-%240.003%20%2F%20result-1f883d" alt="Pay-Per-Event pricing: $0.003 per result">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License: Apache 2.0">
</p>

<p align="center">
  <a href="https://apify.com/stefano_seggio/diario-oficial-cl-monitor">
    <img src="https://img.shields.io/badge/Run%20on-Apify-FF9012?style=for-the-badge&logo=apify&logoColor=white" alt="Run on Apify">
  </a>
</p>

<p align="center">
  <sub>Owner console reference: <a href="https://console.apify.com/actors/qfBeEKuLfYUw9UOuW">console.apify.com/actors/qfBeEKuLfYUw9UOuW</a></sub>
</p>

---

## What it does

Chile's Diario Oficial (official gazette) is the country's system of record for new laws, decrees, resolutions and regulatory notices — but the source itself, `diariooficial.interior.gob.cl`, exposes no public API and no filtering: just today's edition rendered as one long hierarchical table, re-published fresh every business day. Reading it by hand means opening the page, scrolling the whole table, and manually tracking which branch of government, ministry or agency each entry belongs to, every single publishing day.

**diario-oficial-cl-monitor** resolves today's edition automatically, extracts every entry from the sections you select with its full `rama` / `ministerio` / `organismo` government hierarchy and a direct per-publication PDF link, and classifies each entry against a persisted history of what this Actor has already seen. Point it at a recurring Apify schedule with delta mode (`onlyNew`) enabled, and each run returns only the publications that are genuinely new or corrected since the last check — not the whole table re-read from scratch. In effect, it's the API alternative diariooficial.interior.gob.cl never shipped: structured JSON in, official gazette monitoring out.

Legal and compliance teams use it to catch new regulations in their sector the day they appear; law firms use it to catch a *fe de erratas* (a correction re-published under the same CVE with amended text) before advising a client on stale wording; regulatory intelligence teams use it to trend publishing activity by ministry and section across recurring runs, without re-reading the same edition by eye.

## Architecture

```mermaid
flowchart LR
    A["diariooficial.interior.gob.cl"] --> B["Resolve today's edition<br/>via the site's own redirect"]
    B --> C["Fetch each selected section<br/>native fetch + backoff retry<br/>no Crawlee/CheerioCrawler"]
    C --> D["Parse table rows:<br/>rama / ministerio / organismo hierarchy"]
    D --> E["Derive record_id:<br/>CVE, or content-hash fallback"]
    E --> F["Diff against persisted seen-set<br/>Apify key-value store, 20,000-entry cap"]
    F --> G["Classify: NEW_LISTING / UPDATED / UNCHANGED"]
    G --> H{"onlyNew enabled?"}
    H -->|yes| I["Keep NEW_LISTING + UPDATED only"]
    H -->|no| J["Keep every classified record"]
    I --> K["Push to dataset"]
    J --> K
    K --> L["Charge: result event — $0.003 per record"]
```

A section with nothing published that day returns a 404 from the source and is skipped as expected, not logged as a failure — this domain has no "closed" or status-change concept, since a published legal notice is a permanent public record. The only thing an already-seen entry can do is get corrected, which is why `UPDATED` exists alongside `NEW_LISTING`.

## Features

| Feature | Grounded in |
| --- | --- |
| Full government hierarchy per entry (`rama`, `ministerio`, `organismo`) | Inherited from the last heading seen while walking the edition's table top to bottom |
| Direct per-publication PDF link (`pdfUrl` / `source_url`) | Points at the official PDF when the source provides one, not a shared section page |
| Section selection (`sections`) | 7 selectable sections; `normas_generales` is confirmed live, the rest share the same parser |
| Delta mode (`onlyNew`) | Persisted key-value store tracks up to 20,000 recently seen entries across runs |
| Correction detection (`event_type: UPDATED`) | sha1 content fingerprint over hierarchy + description + PDF link, compared run to run |
| Event-type filter (`eventTypes`) | Deliver `NEW_LISTING`, `UPDATED`, or both, when `onlyNew` is on |
| Hard result cap (`maxItems`) | Caps total publications returned per run across all selected sections |
| No Crawlee dependency | The source blocks Crawlee's `CheerioCrawler` (`got-scraping`) fingerprint outright; this Actor fetches with plain `fetch()` instead |

## Input

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `sections` | array | `["normas_generales"]` | Which of the 7 edition sections to fetch: `normas_generales`, `avisos_destacados`, `marcas_patentes`, `normas_particulares`, `publicaciones_judiciales`, `empresas_cooperativas`, `bom`. A section with nothing published that day returns 404 and is skipped, not treated as an error. |
| `maxItems` | integer | `300` | Hard cap on the number of publications returned this run, across all selected sections. |
| `onlyNew` | boolean | `false` | Delta mode: return only `NEW_LISTING` (never seen) or `UPDATED` (a correction to a known entry, same CVE, amended content) since a prior run today, tracked in a named key-value store. |
| `eventTypes` | array | `["NEW_LISTING", "UPDATED"]` | Which of those two event kinds to deliver when `onlyNew` is on; ignored (everything delivered) when it's off. |

Only today's edition is retrievable — the Actor has no historical-date input, for reasons covered under Known limitations below.

## Quick start

Run it directly with the Apify CLI — this pulls today's Normas Generales edition, capped at 100 entries, in delta mode:

```bash
apify call diario-oficial-cl-monitor --input '{
  "sections": ["normas_generales", "marcas_patentes"],
  "maxItems": 100,
  "onlyNew": true,
  "eventTypes": ["NEW_LISTING", "UPDATED"]
}'
```

Each dataset record looks like this:

```json
{
  "rama": "PODER EJECUTIVO",
  "ministerio": "MINISTERIO DE ECONOMIA, FOMENTO Y TURISMO",
  "organismo": "Subsecretaria de Pesca y Acuicultura",
  "descripcion": "Extracto de resolucion exenta numero 2.092, de 2026.- Modifica resolucion N 159 exenta, de 2026",
  "pdfUrl": "https://www.diariooficial.interior.gob.cl/publicaciones/2026/09/04/44542/01/2865015.pdf",
  "cve": "2865015",
  "seccion": "normas_generales",
  "fecha": "04-09-2026",
  "event_type": "NEW_LISTING",
  "record_id": "2865015"
}
```

## Output fields

| Field | Description |
| --- | --- |
| `rama` / `ministerio` / `organismo` | Branch of government, ministry, and sub-agency the entry is filed under, inherited from the last heading walked in the edition table. |
| `descripcion` | The publication entry text itself. |
| `pdfUrl` / `source_url` | Direct link to the official per-publication PDF, when the source provides one. |
| `cve` / `record_id` | The Codigo de Verificacion Electronica (the source's own per-publication id); `record_id` falls back to a content hash on the rare occasion the link text doesn't match the expected CVE pattern. |
| `seccion` / `edicion` / `fecha` | Which section, edition number, and edition date (`DD-MM-YYYY`) the entry belongs to. |
| `event_type` / `is_new` | `NEW_LISTING`, `UPDATED`, or `UNCHANGED` (only surfaced when `onlyNew` is off), plus a boolean flag for whether this id was already in the persisted seen-set. |
| `contentHash` / `scrapedAt` | The sha1 fingerprint used to detect `UPDATED` corrections between runs, and the ISO timestamp of extraction. |

## Pricing (Pay-Per-Event)

| Event | Price | Triggered when |
| --- | --- | --- |
| `result` (gazette publication) | $0.003 | Once per publication record pushed to the dataset |

There's only one metered event, and it's a flat rate: every entry is already fully parsed inline from the section table on the way in, so a record from `normas_generales` costs the same as one from `bom`, and `NEW_LISTING` costs the same as `UPDATED` — no separate detail/summary tier to upsell, no hidden per-section markup.

## Why not just scrape it yourself

- **Zero infrastructure.** No server, cron box, or headless browser to provision and patch — Apify runs the schedule and stores the runs.
- **The bot-check is already solved.** The source's default HTTP fingerprint check blocks a standard `CheerioCrawler` client outright (verified live against the identical URL); this Actor already works around that with a hand-tuned `fetch()` plus exponential-backoff retry loop, so you don't have to reverse-engineer it yourself.
- **No proxy or session babysitting.** There's no login wall or rotating proxy pool to maintain here — just a resolver that follows the site's own redirect to today's edition and a retry loop tuned to its real behavior.
- **Delta/change detection comes built in.** A persisted key-value store carries CVE identity and content fingerprints across runs, so `onlyNew` gives you new-and-corrected entries only, instead of you designing and maintaining that state store yourself.

## Known limitations

- Only today's edition is supported — no reliable way to resolve an arbitrary past date's edition number was found, so there is no historical-date input.
- Of the seven selectable sections, only `normas_generales` had confirmed real content at audit time; the other six are wired against the same parser but have not each been verified end-to-end with live data.
- This Actor is maintained by an independent developer, not a staffed vendor team — there is no contractual uptime SLA. Bugs and coverage requests are handled through the Apify Store's Issues tab, typically within 48 hours.

## Programmatic usage

`run-monitor.js` (Node.js, `apify-client`) and `run_monitor.py` (Python, `apify-client`) are minimal, runnable examples that call this Actor by ID (`qfBeEKuLfYUw9UOuW`), wait for the run, and read back the resulting dataset items.

---

<p align="center">
  <sub>
    Part of <strong>Delta Registry</strong> — pay-per-event regulatory &amp; compliance data infrastructure, monitoring official gazettes and public registries so teams don't have to read them by hand.
    <br>
    Professional inquiries / enterprise licensing: <a href="https://www.linkedin.com/in/stefanoseggio-deltaregistry">LinkedIn</a> ·
    Rest of the fleet: <a href="https://github.com/stefanoseggio">github.com/stefanoseggio</a>
  </sub>
</p>
