# Avatar Access — Cowork plugin

The operating system for Avatar Access (avataraccess.com), an AI-run
engineered-access company: scaffold design, BIM models, load screening,
cost models, proposals, and back office, with a human owner who approves,
signs, and routes PE seals.

## What's inside

**Skills**

| Skill | Use it for |
|---|---|
| `company-os` | How the company runs: roles, approval gates, daily/weekly routines, data model, routine prompts for Claude Code |
| `bid-intake` | Parse and qualify an ITB/RFP, create the deal, bid row, and Drive folder |
| `scaffold-design` | Bay grid, lifts, ties, bracing, access for Layher Allround, ringlock, tube-and-clamp, frame, cuplock; OSHA Subpart L / TG20 rules |
| `bim-model` | Generate IFC4 scaffold models with IfcOpenShell (`scripts/ifc_scaffold.py`), drawings, Speckle/Revit hand-off |
| `load-check` | Screening check with PyNite (`scripts/frame_check.py`): leg load, transom bending, ties, bearing, PE triggers; PE package |
| `cost-model` | Design fee schedule, equipment rental, labor productivity, freight, margin; estimate schema |
| `proposal` | Assemble the proposal package and queue it for approval |

**Agents** — each does one job, on the model sized for it:

| Agent | Model | Skills / work |
|---|---|---|
| CEO routine | sonnet | `company-os` daily run, morning brief (set in the routine config) |
| `triage` | haiku | Connector health check, inbox triage |
| `estimator` | sonnet | `bid-intake`, `cost-model`, `proposal` |
| `designer` | opus | `scaffold-design`, `load-check`, PE package; escalation target |
| `modeler` | sonnet | `bim-model` (IFC + drawings) |
| `back-office` | haiku | Invoice drafts, CRM hygiene, follow-ups, weekly numbers |

Haiku and sonnet agents stop and escalate to `designer` on cantilevers,
loading bays, sheeted or wind-exposed scaffold, PE triggers, unusual
geometry, conflicting drawings, or low confidence, logging each as an
`approvals` row of kind `escalation`.

**Hook**: a PreToolUse guard that blocks money movement, client sends,
signatures, filings, and "issued" stamps, so those always land in the
approval queue for Rob.

**Connectors** (`.mcp.json`): HubSpot, Supabase, GitHub, Intuit QuickBooks.
Authorize each once in Cowork's connector settings. Add Gmail/Google Drive
from the directory for inbox triage and file storage.

## Setup

1. Install the plugin in Cowork.
2. Connect HubSpot, Supabase, GitHub, QuickBooks (and Gmail/Drive).
3. In Supabase, run `skills/company-os/references/data-model.sql`, then
   load `skills/cost-model/examples/rates_seed.json` into `rates` and your
   component catalog into `components`.
4. Replace the placeholder load-table values (see
   `skills/load-check/references/load-tables.md`) with confirmed
   manufacturer values.
5. Create the Drive folder tree `/Avatar Access/{Bids,Estimates,Models,Proposals,Briefs,Templates}`.
6. Paste the routine prompts from `skills/company-os/references/routines.md`
   into Claude Code → Routines.
7. Python for the engine: `pip install ifcopenshell PyNiteFEA`.

## Try it

- "Qualify this ITB" with an attached PDF → `bid-intake`
- "Design a 3-bay, 4-lift Allround facade at medium duty on slab" → `scaffold-design`, then
  `python skills/bim-model/scripts/ifc_scaffold.py bay_grid.json out.ifc`
- `python skills/load-check/scripts/frame_check.py bay_grid.json`
- "Price it, design fee only" → `cost-model`
- "Write the proposal" → `proposal` (ends in the approval queue)
- "Run the company" → `company-os` daily run

## Human gates that never move

Money, client sends, signatures, state/tax filings, bank/KYC changes, and
anything requiring a Florida PE seal (Fla. Stat. §471.025; OSHA
1926.451(a)(6)). Agents prepare; Rob acts.

## Engineering disclaimer

The load check is a screening tool with placeholder tables marked
*(verify)*. Nothing this plugin produces is for construction until a
Florida-licensed professional engineer has reviewed and sealed it.
