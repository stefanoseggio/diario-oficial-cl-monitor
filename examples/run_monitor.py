# run_monitor.py
# Runs the Diario Oficial Chile Monitor Actor and prints new/updated gazette entries.
import os
from apify_client import ApifyClient

# export APIFY_TOKEN=your_apify_api_token before running this script
client = ApifyClient(os.environ["APIFY_TOKEN"])

# Realistic minimal input: today's Normas Generales section, delta mode on.
run_input = {
    "sections": ["normas_generales"],
    "maxItems": 100,
    "onlyNew": True,
    "eventTypes": ["NEW_LISTING", "UPDATED"],
}

print("Starting diario-oficial-cl-monitor run...")
run = client.actor("qfBeEKuLfYUw9UOuW").call(run_input=run_input)

print(f'Run {run["id"]} finished with status "{run["status"]}".')

# Fetch the resulting dataset items (gazette entries) once the run completes.
dataset_items = client.dataset(run["defaultDatasetId"]).list_items().items

print(f"Fetched {len(dataset_items)} gazette publication(s):")
for item in dataset_items:
    print(f"- [{item['event_type']}] {item['ministerio']}: {item['descripcion']}")
    print(f"  PDF: {item['pdfUrl']}")
