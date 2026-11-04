---
name: scaffold-design
description: "This skill should be used when the user asks to \"design a scaffold\", \"lay out the scaffold\", \"size the bays\", \"pick a system\", \"tie pattern\", \"how many lifts\", \"dance floor\", \"stair tower\", \"check it against OSHA\", \"TG20\", or needs Layher Allround, ringlock, tube-and-clamp, frame, or cuplock layout rules. It turns a building elevation and scope into a bay grid, lift schedule, tie plan, and component list that the bim-model, load-check, and cost-model skills consume.\n"
metadata:
  version: "0.1.0"
---

# Scaffold design

Produce a **bay grid** (the single input every downstream skill uses) from
an elevation, footprint, and scope. Design conservatively, cite the rule
for each decision, and stop at anything that needs a PE.

## Inputs to collect

- Elevation(s): length, height to top of work, parapet/roof edge, setbacks
- Ground: slab, asphalt, soil (needs sole boards and bearing check), slope
- Duty: light (25 psf), medium (50 psf), heavy (75 psf) per OSHA
  1926.451; or EN 12811 load class 1–6 if the spec is TG20-based
- Work: facade access, dance floor, hanging/suspended, stair tower, loading
  bay, containment/enclosure, hoist, shoring (shoring → separate skill path)
- Constraints: park hours, guest sightlines, tie restrictions on finished
  facades, hurricane season (Jun–Nov), night work, crane picks
- System preference: Layher Allround (default), ringlock, tube-and-clamp,
  frame, cuplock — see `references/systems.md`

## Design procedure

1. **Choose the system.** Default Layher Allround. Ringlock when the
   client stocks it. Tube-and-clamp for odd geometry and infills only.
   Frame for straight low-rise runs under 40 ft. Cuplock only if specified.
2. **Set the bay grid.** Layher bay lengths: 0.73, 1.09, 1.57, 2.07, 2.57,
   3.07 m (2'5", 3'7", 5'2", 6'9", 8'5", 10'1"). Width 0.73 m (2 boards +
   inside board) or 1.09 m (4 boards) for medium/heavy duty. Prefer 2.57 m
   bays for facade access; drop to 2.07 m for heavy duty or above 100 ft.
   Standards at every node; lift height 2.0 m (6'7"); first lift set to
   suit ground and access.
3. **Lifts and decks.** Deck every working lift; fully plank (gaps ≤ 1 in);
   platform within 14 in of the face (18 in for plaster/finish work);
   guardrail top rail 38–45 in, midrail, 3.5 in toeboard on every open
   side; inside guardrail where the gap to the face exceeds 14 in.
4. **Ties.** OSHA 1926.451(c)(1): restrain when height-to-base-width ratio
   exceeds 4:1. First tie at the 4:1 height; then vertically every 20 ft
   (base ≤ 3 ft wide) or 26 ft (base > 3 ft); horizontally every 30 ft.
   Layher/TG20 default: every other lift, every other bay (staggered), with
   full-line ties at the top lift. Tie type from `references/ties.md`.
   Never rely on ties to a facade the owner has flagged as untouchable —
   switch to raking shores, buttresses, or freestanding towers.
5. **Bracing.** Diagonal (facade) braces every 5th bay in the outer plane,
   full height; plan braces at the base lift and every 4th lift or per
   manufacturer; ledger braces at deck-free lifts.
6. **Access.** Stair tower for anything a crew uses daily or over 3 lifts;
   ladder access acceptable for short duration ≤ 2 lifts. Access required
   whenever the platform is more than 2 ft above or below the access point.
7. **Base.** Base jacks on base plates on sole boards (2× 10 or 12 ft
   timbers) on soil; check bearing (`load-check`). Adjust for slope; never
   exceed 12 in extension on Layher base jacks without a check.
8. **Special structures.** Dance floors (bridging spans, beams), hanging
   scaffolds, cantilevers, loading bays over 2 kN/m², and any tie into a
   theme-park rockwork or themed facade go straight to `load-check` and
   are flagged **PE seal required**.

## Output: the bay grid

Write `bay_grid.json` (schema in `references/bay-grid-schema.json`) with
elevations, bays, lifts, decked lifts, ties, braces, access, base
conditions, duty, and system. Record every rule applied under `rules[]` so
the proposal can quote them. Then hand off:

- `bim-model` builds the IFC from `bay_grid.json`
- `load-check` verifies leg loads, tie loads, and bearing
- `cost-model` expands to a component list and prices it

## Non-negotiables

- Never reduce ties, guardrails, or planking to hit a price.
- Never present a layout as "engineered" or "designed" without the
  `load-check` pass and the seal status stated.
- Flag anything above 125 ft, outriggers, load-bearing brackets, or a
  design load over medium duty as PE-required (OSHA 1926.451(a)(6)).
- Manufacturer tables always win over the placeholder values in this
  plugin; call out when a table value is missing.
