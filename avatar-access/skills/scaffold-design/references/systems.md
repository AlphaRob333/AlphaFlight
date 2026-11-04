# Systems reference

Values marked *(verify)* are typical catalogue figures; replace with the
current manufacturer table before any calc is issued. Store confirmed
values in the Supabase `components` table.

## Layher Allround (default)

- Rosette every 0.5 m on standards; 8 connection points per rosette.
- Standards: 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0 m; spigot connection.
- Ledgers / transoms: 0.73, 1.09, 1.57, 2.07, 2.57, 3.07 m (also 0.39 m).
- Decks: steel or aluminum-frame plywood 0.32 m wide; lengths match bays;
  duty per Layher table by bay length (3.07 m decks are light/medium only).
- Diagonals sized per bay × lift (e.g. 2.57 m × 2.0 m).
- U-transoms and O-ledgers; intermediate transoms for 1.09 m width heavy duty.
- Base jacks: 0.6 m solid, base plates 150 × 150 mm.
- Typical allowable standard leg load per lift: use Layher Allround
  Technical Manual table for the wall-tied configuration *(verify)*.
- Weight per m² facade (0.73 m wide, 2.57 m bays, 2.0 m lifts, decked every
  lift): ~ 18–22 kg/m² *(verify, use for freight only)*.

## Generic ringlock (Allround-compatible)

Same geometry as Allround; do not mix manufacturers in one structure
unless the client's engineer approves. Use the owning manufacturer's load
table; if unknown, design at 85% of Layher values and flag.

## Tube-and-clamp

- 1.9 in OD (48.3 mm) steel tube; right-angle, swivel, sleeve couplers.
- Right-angle coupler slip: 1,000–1,250 lb *(verify)*; swivel: 600–800 lb
  *(verify)*. Ledgers within 12 in of the node; standards on base plates.
- Use for infills, ties, transitions to rockwork, and geometry no system
  bay fits. Max bay 7 ft light, 6 ft medium, 5 ft heavy *(verify)*.

## Frame (walk-thru / mason)

- 5 ft × 6'4" or 5 ft × 5 ft frames, 7 ft or 10 ft cross braces; 8 ft
  lifts. Straight runs ≤ 40 ft high. Leg load per manufacturer table.
- Not for theme-park themed work; sightlines and geometry rarely fit.

## Cuplock

- Cups every 0.5 m; ledgers 1.3, 1.8, 2.5 m; lifts 1.5 / 2.0 m.
- Only when the spec calls for it; price via `components`.

## Rules of thumb for system choice

| Situation | Choose |
|---|---|
| Themed facade, curves, rockwork | Allround + tube-and-clamp infill |
| Straight commercial facade < 40 ft | Frame (cheapest) or Allround |
| Dance floor / birdcage inside show building | Allround, 2.07 m grid |
| Stair tower | Allround stair units, 2.57 × 1.57 m |
| Heavy duty (75 psf) | Allround 1.09 m wide, 2.07 m bays, intermediate transoms |
| Hanging / suspended | Allround with beams; PE seal required |
