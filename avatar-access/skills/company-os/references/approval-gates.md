# Approval gates

Actions in this list are **prepared by agents and executed only by Rob**.
Queue them in the `approvals` table with a full payload and surface them in
the daily approval message. Never work around a gate by splitting an action
into smaller pieces.

## Money
- Any payment, transfer, ACH, wire, or card charge, of any amount.
- Sending an invoice to a client (drafting is fine; sending is gated).
- Changing prices in `rates`, margin policy, or the design-fee schedule.
- Signing up for, upgrading, or cancelling any paid subscription.

## Commitments
- Sending a proposal, quote, or estimate to a client. Draft → gate → send.
- Accepting a contract, PO, subcontract, or change order.
- Any e-signature request. Agents fill and route; Rob signs.
- Promising a delivery date shorter than the standard lead time.

## Engineering
- Marking any drawing, model, or calculation "Issued for Construction".
- Anything that requires a PE seal (see below). Agents produce the package;
  a Florida-licensed PE reviews and seals; Rob transmits.
- Overriding a failed load check. Fail means fail. Rob can request a redesign.

## Legal / identity
- State filings (Sunbiz annual report, amendments), tax filings, licenses.
- Bank, KYC, beneficial-owner, or tax-ID changes.
- Changing the registered agent, company address, or officers.
- Insurance certificates, COIs, and additional-insured endorsements.

## Communications
- First contact with a new client or a new person at an existing client.
- Anything sent to Disney, Universal, or SeaWorld corporate contacts.
- Public posts (website copy, LinkedIn, press).

## When a PE seal is required
Florida Statute §471.025 requires engineering documents to be signed and
sealed by a Florida-licensed professional engineer. OSHA 1926.451(a)(6)
requires a registered professional engineer for supported scaffolds over
125 ft, outrigger scaffolds, and load-bearing brackets. Many Florida
jurisdictions and all three theme-park owners require sealed drawings for
engineered temporary structures. Treat every engineered design package as
seal-required unless Rob explicitly marks it "layout only".

## Approval message format
One message per day, one line per item:

`[#id] TYPE — what — recommended action — APPROVE / EDIT / REJECT`

Include a link to the payload in Drive. No narrative, no other topics.
