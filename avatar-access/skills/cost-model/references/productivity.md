# Productivity and labor factors (starting values — verify against your own job history)

Erect and dismantle rates in kg of scaffold per man-hour. Store live values
in Supabase `rates` under `labor.*`.

| System | Erect kg/MH | Dismantle kg/MH | Notes |
|---|---|---|---|
| Layher Allround facade, 0–40 ft | 150 | 220 | ground-loaded, good access |
| Layher Allround facade, 40–100 ft | 110 | 170 | hoist or hand-chain |
| Layher Allround, > 100 ft or complex | 80 | 130 | |
| Ringlock (generic) | 140 | 200 | |
| Tube-and-clamp | 60 | 90 | infill/transition work |
| Frame | 200 | 280 | straight runs |
| Cuplock | 130 | 190 | |

Multipliers (stack them): night work 1.15; theme-park badged site with
park-hours restrictions 1.20; hand-carry > 150 ft 1.10; occupied facade /
guest sightline protection 1.10; enclosure or netting install 1.08;
first job with a new crew 1.10.

Crew: 1 foreman per 4–6 erectors; competent person on site every shift.
Inspection allowance: 0.5 hour per shift per structure. Mobilization: 1
day per truckload, minimum 1 day each way.

Freight: 40,000 lb flatbed payload; Allround facade at ~ 20 kg/m² means a
truckload covers roughly 900 m² of facade. Zone rates in `rates`
(`freight.zone1` = Orlando metro, `zone2` = Tampa Bay, `zone3` = rest of FL).
