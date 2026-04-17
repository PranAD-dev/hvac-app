/**
 * Scrape HVAC contractor names + phone numbers from Google Places API (New).
 *
 * Source of truth: each field comes straight from Google's JSON response —
 * no LLM, no text parsing, no inference. Rows with a missing phone are
 * dropped so every row in the CSV has both name and phone.
 *
 * Setup:
 *   1. Create a GCP project and enable "Places API (New)".
 *   2. Create an API key and restrict it to the Places API.
 *   3. Put GOOGLE_PLACES_API_KEY=... in server/.env
 *
 * Usage:
 *   node scripts/scrape-hvac-contractors.js [--target 1000] [--out hvac.csv]
 */

const fs = require("fs");
const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "..", "server", ".env"),
});

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!API_KEY) {
  console.error("Missing GOOGLE_PLACES_API_KEY in server/.env");
  process.exit(1);
}

const args = process.argv.slice(2);
const targetIdx = args.indexOf("--target");
const TARGET = targetIdx >= 0 ? parseInt(args[targetIdx + 1], 10) : 1000;
const outIdx = args.indexOf("--out");
const OUT_PATH =
  outIdx >= 0
    ? path.resolve(args[outIdx + 1])
    : path.join(__dirname, "..", "hvac-contractors.csv");

// California first (priority), then the rest of the US.
const CITIES = [
  // ── California (24) ─────────────────────────────────────────
  { city: "Los Angeles", state: "CA" },
  { city: "San Diego", state: "CA" },
  { city: "San Jose", state: "CA" },
  { city: "San Francisco", state: "CA" },
  { city: "Fresno", state: "CA" },
  { city: "Sacramento", state: "CA" },
  { city: "Long Beach", state: "CA" },
  { city: "Oakland", state: "CA" },
  { city: "Bakersfield", state: "CA" },
  { city: "Anaheim", state: "CA" },
  { city: "Santa Ana", state: "CA" },
  { city: "Riverside", state: "CA" },
  { city: "Stockton", state: "CA" },
  { city: "Irvine", state: "CA" },
  { city: "Chula Vista", state: "CA" },
  { city: "Fremont", state: "CA" },
  { city: "San Bernardino", state: "CA" },
  { city: "Modesto", state: "CA" },
  { city: "Fontana", state: "CA" },
  { city: "Oxnard", state: "CA" },
  { city: "Huntington Beach", state: "CA" },
  { city: "Glendale", state: "CA" },
  { city: "Santa Clarita", state: "CA" },
  { city: "Garden Grove", state: "CA" },
  // ── Rest of US (24) ─────────────────────────────────────────
  { city: "Houston", state: "TX" },
  { city: "Phoenix", state: "AZ" },
  { city: "Dallas", state: "TX" },
  { city: "Austin", state: "TX" },
  { city: "San Antonio", state: "TX" },
  { city: "Fort Worth", state: "TX" },
  { city: "Jacksonville", state: "FL" },
  { city: "Miami", state: "FL" },
  { city: "Tampa", state: "FL" },
  { city: "Orlando", state: "FL" },
  { city: "Charlotte", state: "NC" },
  { city: "Raleigh", state: "NC" },
  { city: "Atlanta", state: "GA" },
  { city: "Nashville", state: "TN" },
  { city: "Columbus", state: "OH" },
  { city: "Indianapolis", state: "IN" },
  { city: "Chicago", state: "IL" },
  { city: "Detroit", state: "MI" },
  { city: "Philadelphia", state: "PA" },
  { city: "New York", state: "NY" },
  { city: "Boston", state: "MA" },
  { city: "Seattle", state: "WA" },
  { city: "Denver", state: "CO" },
  { city: "Las Vegas", state: "NV" },
];

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.nationalPhoneNumber",
  "places.formattedAddress",
  "nextPageToken",
].join(",");

async function searchCity(city, state) {
  const results = [];
  let pageToken = null;
  const queryText = `HVAC contractor in ${city}, ${state}`;

  for (let page = 0; page < 3; page++) {
    const body = {
      textQuery: queryText,
      pageSize: 20,
    };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`  [${city}, ${state}] page ${page + 1} HTTP ${res.status}: ${text.slice(0, 200)}`);
      break;
    }

    const data = await res.json();
    const places = data.places || [];
    results.push(...places);

    if (!data.nextPageToken || places.length === 0) break;
    pageToken = data.nextPageToken;
    // nextPageToken needs a brief delay before it becomes valid
    await new Promise((r) => setTimeout(r, 2000));
  }

  return results;
}

function csvEscape(value) {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function main() {
  console.error(
    `Target: ${TARGET} contractors across ${CITIES.length} cities`
  );
  console.error(`Output: ${OUT_PATH}\n`);

  const seen = new Map(); // place.id → row
  let totalApiCalls = 0;

  for (const { city, state } of CITIES) {
    if (seen.size >= TARGET) {
      console.error(`\nHit target (${TARGET}), stopping.`);
      break;
    }
    process.stderr.write(`[${city}, ${state}] `);
    const places = await searchCity(city, state);
    totalApiCalls += Math.min(3, Math.ceil(places.length / 20)) || 1;

    let added = 0;
    for (const p of places) {
      if (!p.id || !p.nationalPhoneNumber) continue;
      if (seen.has(p.id)) continue;
      seen.set(p.id, {
        name: p.displayName?.text || "",
        phone: p.nationalPhoneNumber,
        city,
        state,
        address: p.formattedAddress || "",
        place_id: p.id,
      });
      added++;
      if (seen.size >= TARGET) break;
    }
    console.error(
      `→ ${places.length} results, +${added} new (total ${seen.size}/${TARGET})`
    );
    await new Promise((r) => setTimeout(r, 200));
  }

  const rows = Array.from(seen.values());
  const header = ["name", "phone", "city", "state", "address", "place_id"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(header.map((k) => csvEscape(r[k])).join(","));
  }
  fs.writeFileSync(OUT_PATH, lines.join("\n") + "\n");

  console.error(
    `\nDone. ${rows.length} unique contractors with phone numbers written to ${OUT_PATH}`
  );
  console.error(`Approximate API calls: ${totalApiCalls}`);
  console.error(
    `Approximate cost: $${((totalApiCalls * 32) / 1000).toFixed(2)} (Text Search Pro SKU)`
  );
}

main().catch((err) => {
  console.error("Fatal:", err.message || err);
  process.exit(1);
});
