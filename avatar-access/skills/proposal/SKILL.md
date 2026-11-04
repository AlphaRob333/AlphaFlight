---
name: proposal
description: "This skill should be used when the user asks to \"write the proposal\", \"draft the quote\", \"bid package\", \"scope letter\", \"send the estimate\", \"exclusions\", \"cover letter to the GC\", or when an approved estimate is ready to go to a client. It assembles the Avatar Access proposal from the estimate, drawings, and load-check status, routes PE-seal items, and queues the package for Rob's approval and signature — it never sends.\n"
metadata:
  version: "0.1.0"
---

# Proposal

Assemble a package a GC's project manager can approve in one read: what
they get, what it costs, what it excludes, when, and what they must do.

## Inputs

`estimate.json` (status `approved` — if `draft`, stop and queue the
estimate approval first), drawings and IFC link from `03_Design`,
`loadcheck.json`, `bids.qualification`, client details from HubSpot.

## Build

Use `references/proposal-template.md`. Sections, in order:

1. **Cover letter** — three short paragraphs: what was asked, what Avatar
   Access proposes, the price and validity (30 days). Address the named
   contact. Reference the ITB number and addenda received.
2. **Scope of services** — Tier A (design & engineering) as line items;
   Tier B (equipment & labor) only if requested, clearly marked optional.
   State the deliverable formats (PDF drawings, IFC, Revit if priced,
   Speckle viewer link) and revision count included.
3. **Design basis** — system, duty class, loaded lifts, tie type and
   count, ground assumptions, codes (OSHA 1926 Subpart L, manufacturer
   manual, TG20 where specified, owner standards named).
4. **Engineering & seal status** — one of: *Layout only, not engineered*;
   *Engineered, preliminary, PE review pending*; *Sealed by [PE name],
   FL PE #[number]*. Never overstate. If `pe_required` and no PE yet,
   say "sealed drawings by a Florida-licensed PE are included as a
   pass-through; engineer to be named on award."
5. **Price** — table from `estimate.json`. Design fee as its own subtotal;
   optional equipment & labor as a separate subtotal; grand total; payment
   terms; validity.
6. **Schedule** — design delivery in business days from notice to proceed
   and receipt of listed information; revision turnaround.
7. **Exclusions & assumptions** — from `estimate.assumptions[]` and
   `exclusions[]`, plus the standard list in the template.
8. **Client responsibilities** — site information, owner approvals for
   ties/anchors, access for site visit, badging.
9. **Acceptance** — signature block for both parties. Agents never sign.

## Attachments

Preliminary drawing set (stamped), tie schedule, component list, load
screening summary (never the raw JSON), COI sample on request.

## Route

1. Save `proposal.docx` (use the docx skill if present) and `proposal.pdf`
   to `05_Proposal`.
2. Update `estimates.status = review`, HubSpot deal stage `Proposed` is set
   **only after** Rob approves and sends.
3. Create an `approvals` row of kind `commitment`: summary, grand total,
   link to the PDF, recommended action "send to <contact>". Include a
   ready-to-send email draft in the payload. Stop.

## Tone

Plain, confident, specific. No superlatives. Short sentences. The
client's project name and their words for the scope. One page for the
letter; the rest is tables.
