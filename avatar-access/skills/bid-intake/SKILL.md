---
name: bid-intake
description: "This skill should be used when a new ITB, RFP, RFQ, plan set, scope email, or addendum arrives for Avatar Access, or when the user says \"qualify this bid\", \"log this ITB\", \"new RFP came in\", \"should we bid this\", or \"set up the bid folder\". It parses the request, qualifies it against the company's go/no-go rules, and creates the CRM deal, database row, and Drive folder.\n"
metadata:
  version: "0.1.0"
---

# Bid intake

Turn an inbound request into a qualified, recorded bid — or a documented
no-bid — in under ten minutes of agent time, with nothing sent back to the
client.

## 1. Extract

From the email, PDF, or portal text, pull:

- Client (GC / owner / design firm), contact name, email, phone
- Project name, site address, park or owner (Disney, Universal, SeaWorld,
  other), building or attraction name if given
- Due date and time, pre-bid meeting date, questions deadline
- Scope in the client's words; then restate as: system preferred, heights,
  footprint, duration, access type (facade, dance floor, hanging, stair
  tower, shoring, containment), night-work or park-hours constraints
- Deliverables asked for: layout only, engineered drawings, sealed
  drawings, BIM/IFC, load calcs, erection plan, rescue plan, equipment
  quote, labor quote
- Attachments: architectural/structural sheets, survey, photos, spec
  sections (03 / 01 54 23 temporary scaffolding), owner scaffold standards
- Insurance and bonding requirements, prevailing wage, badging/background
  check requirements

If a field is missing, record `null` and add it to the questions list. Do
not guess.

## 2. Qualify

Score each item 0–2 and sum. Bid if ≥ 10 and no hard stop.

| Criterion | 0 | 1 | 2 |
|---|---|---|---|
| Fit | Not scaffold/access | Adjacent (shoring, hoists) | Core: design, BIM, calcs, estimate |
| Market | Residential / far outside FL | FL commercial | Theme park or Central FL commercial |
| Deliverable | Labor-and-equipment only | Mixed | Design/engineering-led |
| Timeline | < 3 business days | 3–7 days | > 7 days |
| Data quality | No drawings | Partial | Full sheets + spec |
| Relationship | Unknown, no referral | Known GC | Existing client or referral |
| Size | < $2k design fee potential | $2k–$10k | > $10k or repeat program |

Hard stops (no-bid regardless of score): requires Avatar Access to erect or
install (design-only company unless Rob changes policy); requires a license
Avatar Access does not hold; site outside Florida without Rob's OK; client
on the do-not-bid list in Supabase `clients.notes`.

## 3. Record

1. HubSpot: create or find the Company and Contact; create a Deal in stage
   `Received` (or `Qualified` if score ≥ 10, `No-bid` otherwise) with
   amount = design-fee estimate from the `cost-model` fee schedule, close
   date = due date.
2. Supabase: insert `bids` row with `qualification` JSON (scores, hard-stop
   flags, missing fields, questions list) and `status`.
3. Drive: create `/Avatar Access/Bids/YYYY-MM_Client_Project/` with
   subfolders `01_ITB`, `02_Drawings`, `03_Design`, `04_Estimate`,
   `05_Proposal`, `06_Correspondence`. Save every attachment into `01_ITB`
   or `02_Drawings`.
4. If qualified and drawings are present, insert `estimates` row with status
   `queued` and `models` row with status `queued` so the nightly run picks
   them up.

## 4. Report

One line to the run log: `BID <client> / <project> — score N — <status> —
due <date> — missing: <fields>`. Add the questions list to the approval
queue as a `comms` item ("send questions to client") — do not send it.

## Theme-park specifics

Disney (WDW/FAM), Universal (UO/MEC), and SeaWorld each have owner scaffold
standards and badging. When the owner is identified, pull the relevant
standards link from `projects.owner_rules` and list every owner requirement
that changes the design (tie types, netting, night-work, guest sightlines,
containment, hurricane tie-down). Flag CFTOD / Reedy Creek permitting for
Disney property.
