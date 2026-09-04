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

**Cumulative `maxItems` across independent per-section requests is a
real hazard, not just a style question.** A first draft used
`request.userData.alreadyPushed` under a CheerioCrawler-router design -
wrong the moment more than one section is selected, because each
request's `userData` is fixed at enqueue time and requests can run in any
order. `main.ts` now tracks a single running counter across all sections
in one sequential loop, which was simpler once CheerioCrawler was removed
anyway.

## Memory

`minMemoryMbytes`/`maxMemoryMbytes` are 256/512 in `.actor/actor.json` -
per the by-now-established lesson from both other actors in this
portfolio, this does not sync to the live Actor record automatically
across any number of builds. Check `defaultRunOptions` via `apify api GET
actors/<slug>` after the first build and fix by hand with `apify api PUT
... -d -` if it's still showing the 4096MB template default - do not
assume the actor.json value took effect just because the build succeeded.
