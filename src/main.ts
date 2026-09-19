import { Actor, log } from 'apify';

import { buildRecord, classifyEntries, passesEventTypes, passesOnlyNew } from './delta.js';
import { fetchSection } from './fetchSection.js';
import { buildSectionUrl, resolveTodayEdition } from './resolve.js';
import { loadState, mergeEntries, saveState } from './state.js';
import type { ActorInput, SectionName } from './types.js';

const RESULT_EVENT_NAME = 'result';

// The one section confirmed to carry real content at audit time (see README "Section
// selection") and the input schema's own default - a normally-active section, unlike the other
// six which are wired against the same parser but never confirmed end-to-end. Zero entries here
// is worth distinguishing structurally (see the zero-entries handling below); on the other six,
// "nothing published" is the unverified common case and not yet worth the same signal.
const DEFAULT_SECTIONS: SectionName[] = ['normas_generales'];

await Actor.init();
await run();
await Actor.exit();

async function run(): Promise<void> {
    const input = (await Actor.getInput<ActorInput>()) ?? ({} as ActorInput);
    const { sections = DEFAULT_SECTIONS, maxItems = 300, onlyNew = false, eventTypes } = input;

    const edition = resolveTodayEdition();
    log.info(`Edicion resuelta: ${edition.edicion} (${edition.fecha})`);

    const scrapedAtRunStart = new Date().toISOString();
    const state = await loadState();

    let pushed = 0;
    let failedSections = 0;
    const byEventType: Record<string, number> = {};
    const observedThisRun: { id: string; entry: { hash: string } }[] = [];

    for (const seccion of sections) {
        if (pushed >= maxItems) break;

        const url = buildSectionUrl(seccion);

        // SITE CHANGE, 2026-09-19: an empty section used to 404; it now returns a normal 200
        // page with zero content rows (verified live: all 7 sections did this simultaneously on
        // a Saturday with no edition published at all). There's no longer a way to tell "empty"
        // from "has content" without parsing the page, so the separate pre-check is gone -
        // fetchSection() itself now doubles as that check, an empty array meaning "nothing
        // published in this section today" rather than a failure.
        let entries;
        let headingsEncountered;
        let noPublicationsNoticeFound;
        try {
            ({ entries, headingsEncountered, noPublicationsNoticeFound } = await fetchSection({
                url,
                seccion,
                edicion: edition.edicion,
                fecha: edition.fecha,
            }));
        } catch (error) {
            failedSections += 1;
            const errorMessage = error instanceof Error ? error.message : String(error);
            log.error(`Seccion "${seccion}" fallo tras reintentos: ${errorMessage}`, { url });
            await Actor.pushData({ url, seccion, error: errorMessage, scrapedAt: new Date().toISOString() });
            continue;
        }

        if (entries.length === 0) {
            // A 200 response with zero content rows is normally just "nothing published in this
            // section today" (see the SITE CHANGE note above). But on a normally-active section,
            // that's only trustworthy as a genuine quiet day when the page still shows SOMETHING
            // parseTable recognizes: either title3/title4/title5 headings, or the site's own
            // explicit "nothing published" notice (verified live, 2026-09-19: a real quiet day's
            // page has no table/headings at ALL, just that notice - so "no headings" by itself is
            // the norm on a quiet day, not evidence of a break). Only when NEITHER is present -
            // the page loaded 200 but shows none of the markup this parser has ever recognized -
            // does that plausibly mean a site redesign broke the selectors rather than a quiet day.
            const looksLikeGenuineQuietDay = headingsEncountered || noPublicationsNoticeFound;
            if (DEFAULT_SECTIONS.includes(seccion) && !looksLikeGenuineQuietDay) {
                log.warning(
                    `Seccion "${seccion}" sin publicaciones y sin ninguna senal reconocida (ni encabezados title3/title4/title5, ni el aviso de "sin publicaciones" del sitio) en una seccion normalmente activa - la pagina respondio 200 pero pudo haber cambiado de estructura (posible rediseno del sitio) en vez de ser un dia genuinamente sin publicaciones.`,
                    { url },
                );
            } else {
                log.info(`Seccion "${seccion}" sin publicaciones hoy - omitida.`);
            }
            continue;
        }

        log.info(`Seccion "${seccion}": ${entries.length} publicaciones encontradas`);

        const classified = classifyEntries(entries, state).filter(
            (c) => passesOnlyNew(c.eventType, onlyNew) && passesEventTypes(c.eventType, eventTypes),
        );

        for (const c of classified) {
            if (pushed >= maxItems) break;

            const record = buildRecord(c, url);
            await Actor.pushData(record);
            pushed += 1;
            byEventType[c.eventType] = (byEventType[c.eventType] ?? 0) + 1;
            observedThisRun.push({ id: c.recordId, entry: { hash: c.hash } });

            const { eventChargeLimitReached } = await Actor.charge({ eventName: RESULT_EVENT_NAME, count: 1 });
            if (eventChargeLimitReached) {
                log.info('Charge limit reached - stopping.');
                await saveState(mergeEntries(state.entries, observedThisRun), scrapedAtRunStart);
                return;
            }
        }
    }

    // Only ids actually pushed this run are marked "seen" - a record that was fetched but
    // held back by maxItems/onlyNew/eventTypes/the charge limit must stay eligible next run,
    // matching the fleet-wide principle established across every other delta-enabled actor.
    await saveState(mergeEntries(state.entries, observedThisRun), scrapedAtRunStart);

    if (failedSections > 0) {
        log.warning(`Terminado con ${failedSections} seccion(es) fallidas tras reintentos. Ver registros con campo "error" en el dataset.`);
    }
    log.info(
        `Cargados ${pushed} items al dataset (${Object.entries(byEventType)
            .map(([type, count]) => `${type}=${count}`)
            .join(', ')}).`,
    );
}
