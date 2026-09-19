# Diario Oficial Chile Monitor - technical notes (this repo)

Third actor in the portfolio, alongside `primer-actor` (CleanMeta Crawler)
and `pba-tenders-monitor`. Same conventions apply: one Actor = one repo,
branch for non-trivial changes, validate build/lint/test + a real `apify
run` before pushing, never `git push`/`apify push`/promote to `latest`
without asking first in that specific conversation, Store Publishing
Terms require a literal human Console click, never delegable.

## Why Chile, not Colombia or Peru (audited 2026-09-04)

All three candidates were checked live before any code was written, per
the lesson from `pba-tenders-monitor` almost shipping against a
DevExpress-callback national portal:

- **Colombia** (`imprenta.gov.co` / `svrpubindc.imprenta.gov.co/diario/`):
  runs PrimeFaces/JSF (Java enterprise framework), `jsessionid` in the
  URL, its own ViewState-equivalent AJAX machinery. Not tested further -
  real complexity, closer to `comprar.gob.ar`'s profile than PBAC's.
- **Peru** (`elperuano.pe` / `busquedas.elperuano.pe`): a React Router SPA
  with server-side streaming - the actual data is present in the raw
  HTML response, but serialized in Remix/React Router's internal
  "turbo-stream" wire format (indexed references like `{"_1":2,"_3":-5}`,
  not plain JSON), not something to parse without properly understanding
  that protocol.
- **Chile** (`diariooficial.interior.gob.cl`): plain PHP, jQuery-era
  markup, no JS framework at all. A single hierarchical `<table>` per
  edition (`title3` = branch of government, `title4` = ministry, `title5`
  = agency, `tr.content` = the actual publication). Picked on this basis.

## Real bugs found by the live tests, not by reading code

**Wrong URL base path.** `/index.php?date=...&edition=...` at the site
root and `/edicionelectronica/index.php?date=...&edition=...` are two
completely different pages - the root one is unrelated content with no
`<table>` at all (confirmed: different byte length, `title3` absent). An
early manual check against the root path returned 200 with a plausible
word count and was wrongly read as confirmation that the fix worked; only
the automated live test against the real parser (asserting on parsed
entries, not just HTTP status) caught that it wasn't the same content.
Every section URL is built under `/edicionelectronica/`, never the root -
see `resolve.ts`.

**CRITICAL: this actor cannot use `CheerioCrawler`.** Verified live,
same machine, same moment, same exact URL: a plain `fetch()` call returns
the real ~22KB edition page with the full table; `CheerioCrawler`'s
default HTTP client (`got-scraping`) gets served a ~6KB JS bot-check stub
instead (`window["bobcmn"] = "..."`, no `<table>`, no `title3`) with the
same 200 status. This is not the same failure mode as PBAC (geo-blocked,
fixed with Residential+AR proxy) or COMPR.AR (DevExpress callbacks,
killed outright) - it is specifically a client-fingerprint check that
`got-scraping`'s default configuration trips and Node's native `fetch()`
does not. Consequence: **there is no `crawlee` dependency in this repo at
all** - `src/fetchSection.ts` uses `fetch()` + `cheerio.load()` directly,
with its own exponential-backoff retry loop. Do not "simplify" this back
to CheerioCrawler without re-verifying live first; that would silently
reintroduce the empty-page failure.

**`impit` is blocked too - do not adopt it here.** Tried 2026-09-19 as
part of a fleet-wide TLS/JA3 fingerprint-hardening pass (`impit` gives
requests a real Chrome/Firefox TLS+HTTP2 fingerprint instead of Node's
native one - a genuine improvement on most of the fleet). Verified live,
same site, same moment: `impit.fetch()` with `browser: 'chrome'` AND
`browser: 'firefox'` both got served the exact same `bobcmn` bot-check
stub as `got-scraping` above (~6-6.6KB, no `<table>`), while plain
`fetch()` still got the real ~10.3KB page. This site's bot-check appears
to specifically target known browser-impersonation TLS signatures
(the same category of tooling as curl-impersonate, which `impit` and
`got-scraping` both belong to), while Node's honest, non-spoofing
fingerprint passes cleanly. **This actor stays on plain `fetch()`
permanently** - it is the one place in the fleet where a more
Chrome-like fingerprint is the wrong direction, not just unnecessary.
Change was fully reverted, nothing shipped; if `impit` gains a
non-browser-impersonating mode in a future version, re-verify live
before trying again.

**Cumulative `maxItems` across independent per-section requests is a
real hazard, not just a style question.** A first draft used
`request.userData.alreadyPushed` under a CheerioCrawler-router design -
wrong the moment more than one section is selected, because each
request's `userData` is fixed at enqueue time and requests can run in any
order. `main.ts` now tracks a single running counter across all sections
in one sequential loop, which was simpler once CheerioCrawler was removed
anyway.

## Delta engine v2 (2026-09-08)

This actor never had ANY delta engine, envelope, or onlyNew concept before
this pass - it simply re-extracted today's full edition every run, with
no notion of "seen before". Added `src/state.ts`, `src/fingerprint.ts`,
`src/delta.ts`.

- **This domain has no status or lifecycle concept at all - the fleet's
  usual STATUS_CHANGE/CLOSED categories were considered and explicitly
  NOT built here, not omitted by oversight.** A published law, decree or
  resolution is a permanent public record; it does not get "adjudicated"
  or "closed" the way a tender does. The one real thing that CAN happen
  to a published entry is a correction (a fe de erratas) re-published
  under the same CVE with amended text - that is `UPDATED`. Everything
  else is `NEW_LISTING` (first time seen) or `UNCHANGED`.
- **`record_id` = `cve` when present, a content-hash fallback otherwise**
  (`src/fingerprint.ts`'s `recordIdOf`). CVE (Codigo de Verificacion
  Electronica) is the source's own real per-publication id, extracted via
  regex from the link text (`src/parsers/table.ts`) - it can be `null` if
  that pattern doesn't match, a real, disclosed edge case (not verified
  live how often this happens). The fallback mirrors
  entrerios-compras-monitor's approach for a source with no reliable
  native id at all: `sha1(seccion|edicion|descripcion|pdfUrl)`.
- **`source_url` uses `pdfUrl` when present, not a shared listing URL.**
  Unlike most of this fleet's sibling actors (Cordoba, Salta, PBA, Entre
  Rios), this source genuinely has a per-publication deep link - the
  official PDF - so there's no need to fall back to a generic page.
- **Deliberately no `dateRange` input.** Every entry pushed by one run
  shares the exact same `fecha` (the resolved edition's date) - a
  date-range filter here would be a trivial pass/fail-everything
  operation, not a meaningful per-record filter. Kept out entirely rather
  than added as a disclosed no-op (the choice entrerios-compras-monitor
  made for its own no-op case) - there, the field already existed from
  the v1 retrofit and removing it would have been a breaking input-shape
  change; here, there was never a dateRange input to begin with, so
  adding one just for shape-consistency with the rest of the fleet would
  be theater with no real function.
- **Still "today only" - no historical-date support added.** The
  existing `resolveTodayEdition()` only resolves today's edition number;
  there is no live-verified way to compute a past date's edition number
  (not a simple offset from the calendar date, per the existing note in
  `resolve.ts`). Extending this to accept an arbitrary date is a natural
  future addition, not attempted in this pass without first live-
  verifying the edition-resolution mechanism for a past date.
- **Pricing unchanged**: single `result` event, same as v1 - no natural
  detail/summary cost split exists here (every entry is already fully
  parsed inline, same reasoning as tucuman-compras-monitor and
  entrerios-compras-monitor). `Actor.charge()` kept as the original
  separate call (not `pushData(item, eventName)`) since there's only one
  tier - no double-charge risk to design around.
- New `onlyNew`/`eventTypes` inputs, matching the fleet convention where
  they apply to this domain.

## Memory

`minMemoryMbytes`/`maxMemoryMbytes` are 256/512 in `.actor/actor.json` -
per the by-now-established lesson from both other actors in this
portfolio, this does not sync to the live Actor record automatically
across any number of builds. Check `defaultRunOptions` via `apify api GET
actors/<slug>` after the first build and fix by hand with `apify api PUT
... -d -` if it's still showing the 4096MB template default - do not
assume the actor.json value took effect just because the build succeeded.
