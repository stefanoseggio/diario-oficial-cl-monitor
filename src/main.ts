import { Actor, log } from 'apify';

import { buildRecord, classifyEntries, passesEventTypes, passesOnlyNew } from './delta.js';
import { fetchSection } from './fetchSection.js';
import { buildSectionUrl, isSectionAvailable, resolveTodayEdition } from './resolve.js';
import { loadState, mergeEntries, saveState } from './state.js';
import type { ActorInput } from './types.js';

const RESULT_EVENT_NAME = 'result';

await Actor.init();
await run();
await Actor.exit();

async function run(): Promise<void> {
    const input = (await Actor.getInput<ActorInput>()) ?? ({} as ActorInput);
    const { sections = ['normas_generales'], maxItems = 300, onlyNew = false, eventTypes } = input;

    const edition = await resolveTodayEdition();
    log.info(`Edicion resuelta: ${edition.edicion} (${edition.fecha})`);

    const scrapedAtRunStart = new Date().toISOString();
    const state = await loadState();

    let pushed = 0;
    let failedSections = 0;
    const byEventType: Record<string, number> = {};
    const observedThisRun: { id: string; entry: { hash: string } }[] = [];

    for (const seccion of sections) {
        if (pushed >= maxItems) break;

        const url = buildSectionUrl(seccion, edition);

        const available = await isSectionAvailable(url);
        if (!available) {
            log.info(`Seccion "${seccion}" sin publicaciones hoy (404 esperado) - omitida.`);
            continue;
        }

        let entries;
        try {
            entries = await fetchSection({ url, seccion, edicion: edition.edicion, fecha: edition.fecha });
        } catch (error) {
            failedSections += 1;
            const errorMessage = error instanceof Error ? error.message : String(error);
            log.error(`Seccion "${seccion}" fallo tras reintentos: ${errorMessage}`, { url });
            await Actor.pushData({ url, seccion, error: errorMessage, scrapedAt: new Date().toISOString() });
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
