// run-monitor.js
// Runs the Diario Oficial Chile Monitor Actor and prints new/updated gazette entries.
const { ApifyClient } = require('apify-client');

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN, // export APIFY_TOKEN=your_apify_api_token first
});

async function main() {
    // Realistic minimal input: today's Normas Generales section, delta mode on.
    const input = {
        sections: ['normas_generales'],
        maxItems: 100,
        onlyNew: true,
        eventTypes: ['NEW_LISTING', 'UPDATED'],
    };

    console.log('Starting diario-oficial-cl-monitor run...');
    const run = await client.actor('qfBeEKuLfYUw9UOuW').call(input);

    console.log(`Run ${run.id} finished with status "${run.status}".`);

    // Fetch the resulting dataset items (gazette entries) once the run completes.
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`Fetched ${items.length} gazette publication(s):`);
    for (const item of items) {
        console.log(`- [${item.event_type}] ${item.ministerio}: ${item.descripcion}`);
        console.log(`  PDF: ${item.pdfUrl}`);
    }
}

main().catch((err) => {
    console.error('Run failed:', err.message);
    process.exit(1);
});
