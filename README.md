# Diario Oficial Chile Monitor

Extracts today's edition of Chile's Diario Oficial (official gazette): laws, decrees and resolutions, with full hierarchy (branch of government, ministry, agency) and a direct PDF link per publication. No Apify actor found covering Chile's Diario Oficial at audit time (2026-09-04); Mexico's DOF and Colombia/Paraguay's procurement systems are covered by other developers, Chile's gazette was not.

Actor: `stefano_seggio/diario-oficial-cl-monitor`

## Built for

- **Legal and compliance teams** tracking new regulations, decrees and resolutions by ministry or agency.
- **Law firms and consultancies** monitoring specific sectors (health, environment, telecommunications) for relevant publications.
- **Market research** on regulatory activity patterns across government branches.

## Input

| Field | Type | Default | Description |
|---|---|---|---|
| `sections` | array | `["normas_generales"]` | Which sections to fetch. Not every section publishes every day - one with nothing that day returns 404 from the source and is skipped, not treated as an error. |
| `maxItems` | integer | `300` | Hard cap on publications returned this run, across all selected sections. |

Only today's edition is supported - there is no known way to resolve an arbitrary past date's edition number (see "Known limitations").

```json
{
    "sections": ["normas_generales", "marcas_patentes"],
    "maxItems": 100
}
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
  "scrapedAt": "2026-09-04T16:16:42.538Z"
}
```

## How it works

No CheerioCrawler here, deliberately - see "Known limitations" for why. `src/resolve.ts` resolves today's edition number via the site's own redirect (`/edicionelectronica/` -> `index.php?date=...&edition=...`), checks each requested section for content (a 404 means nothing published there today, not a failure), and `src/fetchSection.ts` fetches available sections with exponential-backoff retries. `src/parsers/table.ts` walks the edition's single hierarchical table top to bottom, tracking which branch/ministry/agency heading was last seen so each publication row inherits the right context.

## Known limitations

- **Only today's edition.** No date-lookup mechanism was found during the technical audit; building historical access would need reverse-engineering the site's search/archive feature, not yet done.
- **This actor does not use Crawlee's `CheerioCrawler`.** Verified live (2026-09-04): the exact same URL, same machine, same moment, returns a real ~22KB page with the full table to a plain `fetch()` call, but a ~6KB JS bot-check stub (no table at all) to CheerioCrawler's default HTTP client (`got-scraping`). Whatever fingerprint that check keys on, `fetch()` passes it and `got-scraping` doesn't. The whole actor is built on native `fetch()` instead, with its own retry logic, rather than fighting that mismatch.
- Only `normas_generales` was confirmed to have real content on the audit date; the other six sections all returned 404 that day. They're wired up and should work identically once something is actually published there, but were not verified with real data end to end.

## Resources

- [Diario Oficial de Chile](https://www.diariooficial.interior.gob.cl/)
- [Apify SDK for JavaScript](https://docs.apify.com/sdk/js)
