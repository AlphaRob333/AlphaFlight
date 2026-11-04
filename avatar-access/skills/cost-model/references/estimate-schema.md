# Estimate schema (`estimate.json`)

```json
{
  "bid_id": "uuid",
  "revision": 1,
  "currency": "USD",
  "status": "draft",
  "confidence": "medium",
  "scope_summary": "one paragraph in the client's terms",
  "system": "layher_allround",
  "duration_months": 4,
  "design": {
    "tier": "engineered",
    "base_fee": 4500.00,
    "adders": [ { "item": "additional elevation", "qty": 2, "rate": 750.00, "amount": 1500.00 } ],
    "pe_seal": { "required": true, "engineer": null, "amount": 1800.00, "passthrough": true },
    "revisions_included": 2,
    "subtotal": 7800.00
  },
  "equipment": {
    "requested": true,
    "lines": [ { "sku": "STD-4.0", "description": "Standard 4.0 m", "qty": 16, "unit": "ea", "rate_month": 3.10, "months": 4, "amount": 198.40 } ],
    "consumables": [ { "item": "Debris netting", "qty": 62, "unit": "m2", "rate": 0.85, "amount": 52.70 } ],
    "waste_allowance_pct": 3,
    "weight_kg": 2140,
    "subtotal": 0.00
  },
  "labor": {
    "requested": true,
    "erect_hours": 48, "dismantle_hours": 32, "inspection_hours": 20, "mobilization_days": 1,
    "crew": [ { "class": "erector", "hours": 80, "rate": 38.00, "amount": 3040.00 } ],
    "multipliers": [ { "reason": "night work", "factor": 1.15 } ],
    "subtotal": 0.00
  },
  "freight": { "truckloads": 1, "rate_each_way": 650.00, "amount": 1300.00 },
  "other": [ { "item": "CFTOD permit", "amount": 0.00, "passthrough": true } ],
  "margin": { "equipment_pct": 25, "labor_pct": 20, "passthrough_pct": 10 },
  "totals": { "design": 7800.00, "equipment_labor": 0.00, "grand_total": 7800.00 },
  "assumptions": [ "Two decked lifts loaded at medium duty", "Through-ties to window openings, no drilled anchors" ],
  "exclusions": [ "Permits and fees", "Ground preparation", "Engineering of rockwork anchors" ],
  "sensitivity": { "duration_plus_1_month": 0.00, "labor_minus_10pct": 0.00 },
  "sources": { "components_file": "…_components.json", "bay_grid": "bay_grid.json", "rates_snapshot": "2026-09-29" }
}
```

Rules: every `amount` is `qty × rate` (× months where relevant); subtotals
sum their lines; `grand_total = design + equipment_labor`; margin is
applied inside `equipment_labor`, never to the design fee (the fee schedule
already includes it). Store the `rates_snapshot` date so a re-price later
can show what moved.
