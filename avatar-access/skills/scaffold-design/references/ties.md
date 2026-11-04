# Ties and anchoring

## Spacing (OSHA 1926.451(c)(1))
- Restrain when height exceeds 4× the minimum base width.
- First tie at the 4:1 height. Then vertical spacing: 20 ft for scaffolds
  with base ≤ 3 ft wide, 26 ft for base > 3 ft wide. Horizontal spacing
  30 ft max. Ties at the top lift whenever the top is more than 4:1.
- Ties must resist push and pull. Design load per TG20: 3.5 kN (light),
  6.1 kN (medium), 12.2 kN (enclosed / sheeted) *(verify against TG20
  edition)*; in US practice use manufacturer tie tables or an engineered
  value per tie.

## Tie types (choose in this order)
1. **Through-tie / window tie** — reversible, no facade damage. Preferred on
   finished or themed facades.
2. **Box tie** around columns — reversible.
3. **Drilled anchor** (sleeve or wedge anchor into concrete/masonry) with
   ring bolt and tie tube — needs owner approval on finished facades;
   pull-test 10% of anchors, minimum 3, to 1.25× design load *(verify)*.
4. **Raking shore / buttress** — freestanding alternative when facade
   contact is prohibited; check base bearing and add kentledge.
5. **Themed rockwork / GFRC** — never anchor directly without the owner's
   structural engineer; route as PE-required with a photo survey.

## Enclosure and wind
- Debris netting adds ~ 0.4 wind factor; shrink-wrap / sheeting ~ 1.0.
  Halve tie spacing for sheeted scaffolds and re-run `load-check`.
- Florida hurricane season (Jun 1–Nov 30): include a storm-prep plan — net
  removal at 48 h notice, tie inspection after any named storm.

## Records
Record every tie in `bay_grid.json` → `ties[]` with location (bay, lift),
type, design load, and anchor test requirement. Ties show on the drawings
as a tie schedule; the proposal quotes the count.
