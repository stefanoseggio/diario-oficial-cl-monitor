import { Actor, log } from 'apify';

import { fetchSection } from './fetchSection.js';
import { buildSectionUrl, isSectionAvailable, resolveTodayEdition } from './resolve.js';
import type { ActorInput } from './types.js';

const RESULT_EVENT_NAME = 'result';

await Actor.init();
await run();
await Actor.exit();

async function run(): Promise<void> {
    const input = (await Actor.getInput<ActorInput>()) ?? ({} as ActorInput);
    const { sections = ['normas_generales'], maxItems = 300 } = input;

    const edition = await resolveTodayEdition();
    log.info(`Edicion resuelta: ${edition.edicion} (${edition.fecha})`);

    let pushed = 0;
    let failedSections = 0;

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

        for (const entry of entries) {
            if (pushed >= maxItems) break;

            await Actor.pushData(entry);
            pushed += 1;

            const { eventChargeLimitReached } = await Actor.charge({ eventName: RESULT_EVENT_NAME, count: 1 });
            if (eventChargeLimitReached) {
                log.info('Charge limit reached - stopping.');
                return;
            }
        }
    }

    if (failedSections > 0) {
        log.warning(`Terminado con ${failedSections} seccion(es) fallidas tras reintentos. Ver registros con campo "error" en el dataset.`);
    }
}
