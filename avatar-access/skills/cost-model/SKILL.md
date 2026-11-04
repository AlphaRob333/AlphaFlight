---
name: cost-model
description: "This skill should be used when the user asks to \"price this\", \"build the estimate\", \"what's the design fee\", \"cost model\", \"takeoff\", \"how much equipment\", \"rental for 6 months\", \"labor to erect\", \"margin\", or when an estimates row is queued. It expands a bay grid or component count into priced equipment, labor, freight, design/engineering fees, and margin using the Avatar Access estimate schema, with the design fee always shown as its own line.\n"
metadata:
  version: "0.1.0"
---

# Cost model

Every estimate has two parts: **A. Design & engineering** (Avatar Access's
own fee, always present) and **B. Equipment & labor** (optional, shown when
the client wants a turnkey number or a budget). Price both from tables in
Supabase, never from memory.

## Inputs

- `*_components.json` from `bim-model` (or a manual takeoff)
- `bay_grid.json` (duty, height, ties, special items, PE flag)
- `bids.qualification` (duration, site, park, night work, badging)
- Supabase `components` (weights, rental rates) and `rates` (labor, freight,
  fees, margin)

## A. Design & engineering fee

Use `references/fee-schedule.md`. Base fee by scope tier, plus per-elevation
and per-special-structure adders, plus the PE seal pass-through when
`pe_required` is true, plus revisions beyond two. Show the PE fee as a
separate pass-through line with the PE's name once known.

## B. Equipment & labor (when requested)

1. **Equipment** — for each SKU in the component count: quantity × monthly
   rental rate × months (minimum 1 month; partial months per the rate
   table's rounding). Add consumables and hardware by rule of thumb:
   couplers 2 per tie and 2 per tube-and-clamp joint, pins/wedges included
   in system pieces, netting by m² of facade, sole boards by base count.
   Add a **waste/loss** allowance (default 3% of equipment value, from `rates`).
2. **Labor** — erect and dismantle man-hours from `references/productivity.md`
   (kg per man-hour by system and height band), × crew rate from `rates`
   (erector, foreman, competent person). Night work, badging, park-hours
   restrictions, and hand-carry distance apply as multipliers. Add
   mobilization/demobilization days and a daily inspection allowance
   (competent-person inspections are required before each shift under
   OSHA 1926.451(f)(3)).
3. **Freight** — truckloads = total weight / payload (default 40,000 lb
   flatbed) rounded up, × rate by zone from `rates`, each way.
4. **Other** — engineering already in A; permits and CFTOD fees at cost;
   insurance/bond adders at the rate-table percentage; per diem if the site
   is outside the crew's zone.
5. **Margin** — apply the margin policy from `rates` (`margin.equipment`,
   `margin.labor`, `margin.passthrough`). Never change policy here; queue an
   approval if the deal needs a different margin.

## Output

Write `estimate.json` per `references/estimate-schema.md` and a
human-readable `estimate.md` summary, save both to `04_Estimate`, insert an
`estimates` row (status `draft`), and hand off to `proposal`. Include:

- Every assumption (duration, loaded lifts, tie type, ground) as a line in
  `assumptions[]` so the proposal can list exclusions.
- A `sensitivity` block: ± 1 month duration, ± 10% labor productivity.
- `confidence`: high / medium / low based on drawing completeness.

## Sanity checks before hand-off

- Equipment weight per m² of facade between 15 and 30 kg for Allround
  facade access; outside that, re-check the count.
- Erect + dismantle labor hours per tonne within the productivity band.
- Design fee ≥ the minimum in the fee schedule.
- Total rounds to the nearest $50; unit rates carry two decimals.

## What never happens here

No prices are sent to anyone. No discounts are invented. No margin policy
is changed. The estimate is a draft until Rob approves it in the daily
approval queue.
