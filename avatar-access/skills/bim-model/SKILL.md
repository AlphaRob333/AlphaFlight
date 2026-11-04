---
name: bim-model
description: "This skill should be used when the user asks to \"build the model\", \"make the IFC\", \"generate the BIM\", \"export to Revit\", \"send it to Speckle\", \"make the drawings\", or when a bay grid from scaffold-design is ready to be modeled. It generates an IFC4 scaffold model with IfcOpenShell from bay_grid.json, produces a component count, and routes .rvt or viewer deliverables through the lowest-cost path.\n"
metadata:
  version: "0.1.0"
---

# BIM model

Turn `bay_grid.json` into a model the client can open, a component count
the estimator can price, and a set of drawings, at zero software cost
unless the client demands a native Revit file.

## Pipeline

1. **Validate** the bay grid against
   `${CLAUDE_PLUGIN_ROOT}/skills/scaffold-design/references/bay-grid-schema.json`.
   Refuse to model a grid that has no `rules[]` entries or no `duty`.
2. **Generate IFC** —
   `python ${CLAUDE_PLUGIN_ROOT}/skills/bim-model/scripts/ifc_scaffold.py bay_grid.json out.ifc`
   (requires `pip install ifcopenshell`). Output: IFC4 with one
   `IfcBuildingStorey` per elevation, standards as `IfcColumn`, ledgers and
   transoms as `IfcBeam`, decks as `IfcPlate`, guardrails/toeboards as
   `IfcRailing`, diagonals and ties as `IfcMember`. Every element carries an
   `AvatarAccess_Scaffold` property set with `Sku`, `System`, `Length_m`.
   A `*_components.json` count file is written beside the IFC.
3. **Load check** — hand the same `bay_grid.json` to the `load-check`
   skill. Do not proceed to drawings on a FAIL.
4. **Drawings** — plan at each decked lift, elevation, tie schedule, and a
   section through the widest bay. Produce with Bonsai/Blender headless
   (`blender -b --python`) or, when unavailable, render the IFC to SVG with
   IfcOpenShell's `ifcconvert` and annotate. Title block from
   `/Avatar Access/Templates/titleblock.svg`. Stamp every sheet
   **PRELIMINARY — NOT FOR CONSTRUCTION** until the proposal skill changes
   the status; sealed sheets are stamped by the PE, never by an agent.
5. **Share** — push the IFC to Speckle (free tier) for a browser link, and
   save IFC + drawings + counts to the bid's `03_Design` Drive folder.
6. **Record** — update the `models` row: `ifc_path`, `drawings_path`,
   `status = checked` (if the load check passed) and the revision.

## When the client wants .rvt

Pick the cheapest path that meets the ask:

| Ask | Path | Cost |
|---|---|---|
| "Can we see it in our model?" | IFC link via Speckle or IFC file for Navisworks/Revit link | $0 |
| "Send us a Revit file" | Autodesk Platform Services Design Automation for Revit job that links the IFC into a template .rvt | ~ $6 per processing hour (Flex tokens) |
| Native Layher families required | LayPLAN TO REVIT portal upload (emails back an .rvt) or the Revit MCP server on Rob's desktop with the Layher Allround family library | Desktop Revit seat |

Never buy or subscribe to anything to satisfy a one-off ask; queue an
approval with the cost.

## Modeling conventions

- Metric internally; the bay grid may be in feet (`units: "ft"`).
- Elevation origin and `direction_deg` place each run in site coordinates;
  supply a site survey or the architect's grid origin when available so the
  model federates with the client's BIM.
- Diagonals are modeled as straight members between nodes; true geometry
  appears on the elevation drawing.
- Do not model couplers, pins, or wedges; counts come from rules of thumb in
  `cost-model` (e.g. couplers per tie, per diagonal).
- Keep revisions: never overwrite `out.ifc`; write `out_r2.ifc` and bump
  `models.revision`.

## Quality checks before hand-off

- Piece count sanity: standards = nodes × 2 rows × (height / stock lengths);
  decks = decked lifts × bays × (width / 0.32). If the count is off, the
  grid is wrong, not the script.
- Open the IFC with `ifcopenshell.open()` and confirm `schema == IFC4` and
  the product count matches the component total + storeys/site/project.
- Tie count in the IFC equals `ties[]` in the grid.
