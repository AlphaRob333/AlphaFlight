# Load tables

`frame_check.py` ships with placeholder values marked *(verify)*. Replace
them by passing `--tables load_tables.json` built from confirmed sources,
and store the confirmed values in Supabase `rates` (`key` =
`load.<system>.<field>`) so every run uses the same numbers.

```json
{
  "allowable_leg_load_kN": { "layher_allround": 30.0, "ringlock": 25.5, "tube_clamp": 18.0, "frame": 22.0, "cuplock": 24.0 },
  "tube": { "od_mm": 48.3, "t_mm": 3.2, "fy_MPa": 235, "E_MPa": 210000 },
  "self_weight_kN_per_m2_facade": 0.20,
  "deck_dead_kN_per_m2": 0.25,
  "tie_design_load_kN": { "light": 3.5, "medium": 6.1, "enclosed": 12.2 },
  "deck_max_bay_m": { "light": 3.07, "medium": 2.57, "heavy": 2.07 },
  "bearing": { "base_plate_area_m2": 0.0225, "sole_board_area_m2": 0.12,
               "default_allowable_kPa": { "slab": 1000, "deck": 250, "asphalt": 300, "soil": 75 } }
}
```

| Field | Meaning | Source to confirm |
|---|---|---|
| `allowable_leg_load_kN` | Allowable axial load on one standard in the tied, braced configuration at 2.0 m lifts, including the manufacturer's safety factor | Layher Allround Technical Manual (US edition) leg-load tables; ringlock manufacturer's table; for tube-and-clamp use the engineer's value for 48.3 × 3.2 tube at the lift height |
| `tube` | Section and steel grade for the transom check | Manufacturer; Layher uses higher-grade steel than 235 MPa, so the placeholder is conservative |
| `self_weight_kN_per_m2_facade` | Scaffold self-weight per m² of facade, decked every lift | Layher weight tables or the component count × weights from `components` |
| `deck_dead_kN_per_m2` | Deck dead load | Steel deck ≈ 0.25; aluminum-ply lighter |
| `tie_design_load_kN` | Design load per tie by condition | TG20 (light/medium/enclosed); US practice may use the manufacturer's tie table or an engineered value |
| `deck_max_bay_m` | Longest bay a deck may span by duty class | Layher deck load table; 3.07 m decks are not rated for heavy duty |
| `bearing` | Base-plate and sole-board contact areas; allowable bearing by ground | Base plate 150 × 150 mm; sole board 2 × 10 × 1 ft; concrete slab values from the structural engineer; soil from the geotech or a conservative 75 kPa |

## OSHA duty classes (1926.451 App. A)
Light 25 psf, medium 50 psf, heavy 75 psf uniformly distributed on the
platform. The scaffold must support its own weight and 4× the maximum
intended load; manufacturer allowables already include that factor.

## EN 12811-1 / TG20 load classes (for specs that use them)
Class 1: 0.75 kN/m², 2: 1.5, 3: 2.0, 4: 3.0, 5: 4.5, 6: 6.0. Map to OSHA
as 1–2 ≈ light, 3 ≈ medium, 4–6 ≈ heavy (conservative).
