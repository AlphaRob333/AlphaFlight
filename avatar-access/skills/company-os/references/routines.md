# Routines

Routines run unattended in Claude Code (cloud) on a schedule. Paste each
prompt into Claude Code → Routines. All use the `avatar-access` plugin.

Set each routine's model in its Claude Code routine config to the value
given under its heading.

## 1. Nightly CEO run — 05:30 America/New_York, Mon–Sat

Model: **sonnet**. Health check and inbox triage are delegated to the
`triage` agent (haiku).

```
You are the Avatar Access CEO routine. Load the avatar-access plugin's
company-os skill and execute the Daily run exactly as written. Stop at the
first connector failure and report it. Finish by writing the morning brief
to Drive and emailing it to rob@avataraccess.com. Do not send anything to
anyone else. Do not execute any approval-gated action. Run steps 1-2 with
the triage agent. If you see a cantilever, loading bay, sheeted or
wind-exposed scaffold, a PE trigger, unusual geometry, conflicting
drawings, or are not confident in your own output, stop, log an approvals
row of kind 'escalation' with the reason, and hand the task to the
designer agent.
```

## 2. Bid watcher — every hour, 07:00–19:00 ET, Mon–Fri

Model: **haiku** (inbox triage). Bid-intake runs in the `estimator` agent
(sonnet).

```
Run the triage agent on the Avatar Access inbox for new ITBs, RFPs,
addenda, or plan sets. For each, run the estimator agent's bid-intake step:
qualify, create the HubSpot deal, the Supabase bid row, and the Drive
folder; queue an estimate if qualified.
Reply only with a one-line summary per bid. Do not contact the sender.
```

## 3. Weekly numbers — Friday 16:00 ET

Model: **haiku** (back-office).

```
Run the company-os Weekly run with the back-office agent. Pull pipeline from HubSpot, cash from
QuickBooks, throughput from Supabase, connector uptime from ops_health.
Write /Avatar Access/Briefs/weekly-YYYY-WW.md and email it to Rob.
```

## 4. Engine maintenance — Sunday 02:00 ET (GitHub trigger optional)

```
In avataraccess/company: run the test suite for the scaffold engine
(scripts under skills/bim-model and skills/load-check). Open a PR for any
dependency updates that pass tests. Never merge; Rob reviews Monday.
```

## Morning brief format

```
# Avatar Access — Brief YYYY-MM-DD

## Needs you (N)
[#id] TYPE — what — recommended action — APPROVE / EDIT / REJECT

## Pipeline
Received n | Qualified n | Estimating n | Proposed $X | Won MTD $X

## Done overnight
- one line per estimate, model, check, or follow-up produced
- escalations to designer: n (see approvals kind = 'escalation')

## Blocked / could not do
- connector or data problems, with what is needed to fix them

## Health
HubSpot ok | Supabase ok | GitHub ok | QuickBooks ok | Gmail ok
```
