---
name: load-check
description: "This skill should be used when the user asks to \"check the loads\", \"run the calcs\", \"leg loads\", \"tie loads\", \"will it hold\", \"bearing check\", \"does it pass OSHA\", \"PE review package\", or whenever a scaffold model moves toward issue. It runs the Avatar Access screening check (leg load, transom bending, tie count and load, base bearing, PE triggers) and prepares the package a Florida PE reviews and seals.\n"
metadata:
  version: "0.1.0"
---

# Load check

A screening check that decides whether a design goes forward to PE review.
It never replaces the PE. A FAIL blocks the model; a PASS earns the status
`checked`, not `issued`.

## Run

```
python ${CLAUDE_PLUGIN_ROOT}/skills/load-check/scripts/frame_check.py bay_grid.json --out loadcheck.json
```

Requires `pip install PyNiteFEA`. Exit code 0 = PASS, 2 = FAIL. Pass
`--tables load_tables.json` with the confirmed manufacturer values from
Supabase `components`/`rates` to replace the placeholders; see
`references/load-tables.md` for what each number means and where it comes
from.

## What it checks

1. **Leg load** at the worst interior standard: live load on the number of
   simultaneously loaded decked lifts (OSHA 1926.451(a): light 25 / medium
   50 / heavy 75 psf; 4:1 factor is inside the manufacturer's allowable),
   deck dead load, and self-weight, vs. the allowable leg load for the
   system in its tied configuration.
2. **Transom bending and deflection** (decks span the bay and bear on the
   transom) using a PyNite simply-supported model of 48.3 × 3.2 mm tube;
   deck span itself is checked against the deck table by duty class.
3. **Ties**: height-to-base ratio (> 4:1 requires ties), minimum count from
   OSHA spacing (20/26 ft vertical, 30 ft horizontal), and each tie's design
   load vs. the TG20-style value (3.5 kN light, 6.1 kN medium, 12.2 kN
   enclosed). Sheeted or netted scaffolds are treated as enclosed.
4. **Bearing**: leg load over base-plate or sole-board area vs. allowable
   for slab, asphalt, deck, or soil.
5. **PE triggers**: > 125 ft, hanging, cantilever, dance floor, loading bay,
   shoring, heavy duty, or `pe_required: true` in the grid.

## Interpreting results

- Any finding → FAIL. Fix the grid in `scaffold-design` (smaller bays,
  intermediate standards, more or stronger ties, sole boards) and re-run.
  Never edit the tables to make a check pass.
- Ratios above 0.9 on PASS → note as "tight" in the PE package.
- `pe_required: true` → the proposal must carry the sealed-drawings line
  and the PE's fee.

## PE review package

Assemble in `03_Design/PE/`:

1. `loadcheck.json` and a one-page summary (inputs, results, ratios).
2. `bay_grid.json` with the `rules[]` applied.
3. Drawings (preliminary stamp), tie schedule, and the IFC link.
4. Manufacturer technical manual pages used, with the table values cited.
5. Site photos and the owner's scaffold standards, if any.
6. A short list of questions for the PE (unusual ties, ground, wind).

Then create an `approvals` row of kind `engineering` so Rob transmits the
package to the PE. Update `load_checks` with inputs, results, and
`passed`; leave `reviewed_by` empty until the PE responds.

## What this tool does not do

No buckling analysis, no wind (beyond the enclosure tie factor), no
seismic, no dynamic loads, no rockwork anchor design, no beam or truss
design for dance floors and bridges. Those are PE scope. Say so in the
package rather than approximating.
