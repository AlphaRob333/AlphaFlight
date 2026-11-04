#!/usr/bin/env python3
"""
frame_check.py — first-pass scaffold load check from an Avatar Access bay_grid.json.

Usage:
    python frame_check.py bay_grid.json [--out results.json] [--tables load_tables.json]

What it checks (per elevation):
  1. Leg (standard) load at the base by tributary area: decked-lift live load
     (OSHA duty class), self-weight, and the number of simultaneously loaded
     lifts, vs. allowable leg load from the load table.
  2. Ledger / transom bending and deflection under the decked-lift UDL using a
     PyNite simply-supported beam model (48.3 x 3.2 mm tube by default).
  3. Tie count and tie design load vs. OSHA spacing and TG20-style tie loads.
  4. Base bearing: leg load / sole-board or base-plate area vs. allowable bearing.

This is a screening tool. A PASS here means "proceed to PE review", never
"issued for construction". Any FAIL blocks the model status.
"""
import argparse
import json
import math
import os
import sys

FT = 0.3048
PSF_TO_KPA = 0.04788
G = 9.80665

DEFAULT_TABLES = {
    "allowable_leg_load_kN": {          # (verify) placeholder per system, wall-tied, 2.0 m lifts
        "layher_allround": 30.0,
        "ringlock": 25.5,
        "tube_clamp": 18.0,
        "frame": 22.0,
        "cuplock": 24.0
    },
    "tube": {"od_mm": 48.3, "t_mm": 3.2, "fy_MPa": 235, "E_MPa": 210000},
    "self_weight_kN_per_m2_facade": 0.20,   # (verify) decked-every-lift facade incl. decks
    "deck_dead_kN_per_m2": 0.25,
    "tie_design_load_kN": {"light": 3.5, "medium": 6.1, "enclosed": 12.2},
    "deck_max_bay_m": {"light": 3.07, "medium": 2.57, "heavy": 2.07},   # (verify) per Layher deck table
    "bearing": {"base_plate_area_m2": 0.0225, "sole_board_area_m2": 0.12,
                "default_allowable_kPa": {"slab": 1000, "deck": 250, "asphalt": 300, "soil": 75}}
}


def to_m(v, units):
    return v * FT if units == "ft" else v


def tube_props(od_mm, t_mm):
    ro, ri = od_mm / 2000, (od_mm - 2 * t_mm) / 2000
    A = math.pi * (ro**2 - ri**2)
    I = math.pi / 4 * (ro**4 - ri**4)
    Z = I / ro
    return A, I, Z


def ledger_check(span, w_kN_m, tables):
    """Simply supported ledger under UDL via PyNite; returns Mmax, deflection, ratios."""
    from Pynite import FEModel3D
    od, t, fy, E = (tables["tube"][k] for k in ("od_mm", "t_mm", "fy_MPa", "E_MPa"))
    A, I, Z = tube_props(od, t)
    m = FEModel3D()
    m.add_material("steel", E * 1000, E * 1000 / 2.6, 0.3, 78.5)  # kN/m2 units
    m.add_node("A", 0, 0, 0)
    m.add_node("B", span, 0, 0)
    m.def_support("A", True, True, True, True, False, False)
    m.def_support("B", False, True, True, False, False, False)
    m.add_section("tube", A, I, I, 2 * I)
    m.add_member("L", "A", "B", "steel", "tube")
    m.add_member_dist_load("L", "FY", -w_kN_m, -w_kN_m)
    m.analyze(check_statics=False)
    Mmax = abs(m.members["L"].max_moment("Mz"))
    Mmin = abs(m.members["L"].min_moment("Mz"))
    M = max(Mmax, Mmin)
    d = abs(m.members["L"].min_deflection("dy"))
    M_allow = fy * 1000 * Z / 1.5          # kN·m, simple 1.5 factor (verify vs. code)
    return {"span_m": span, "w_kN_m": round(w_kN_m, 3), "M_kNm": round(M, 3),
            "M_allow_kNm": round(M_allow, 3), "ratio_M": round(M / M_allow, 3),
            "defl_mm": round(d * 1000, 2), "defl_limit_mm": round(span * 1000 / 150, 2),
            "ratio_defl": round(d / (span / 150), 3)}


def check_elevation(ev, grid, tables):
    units = grid.get("units", "m")
    system = grid.get("system", "layher_allround")
    duty = grid.get("duty", {})
    psf = duty.get("psf") or {"light": 25, "medium": 50, "heavy": 75}[duty.get("osha_class", "medium")]
    q_live = psf * PSF_TO_KPA                       # kN/m2
    n_loaded = duty.get("decked_lifts_loaded", 2)
    W = to_m(ev.get("width", 0.73), units)
    bays = [to_m(b, units) for b in ev["bays"]]
    lifts = [to_m(l, units) for l in ev["lifts"]]
    H = sum(lifts)
    decked = ev.get("decked_lifts", list(range(1, len(lifts) + 1)))
    findings, checks = [], {}

    # 1. leg load (worst interior leg: tributary = half of adjacent bays x half width)
    bmax = max(bays)
    trib = bmax * (W / 2)
    live = q_live * trib * min(n_loaded, len(decked))
    dead_decks = tables["deck_dead_kN_per_m2"] * trib * len(decked)
    self_wt = tables["self_weight_kN_per_m2_facade"] * bmax * H / 2   # half of bay strip per leg row
    leg = live + dead_decks + self_wt
    allow = tables["allowable_leg_load_kN"].get(system, 18.0)
    checks["leg_load"] = {"leg_kN": round(leg, 2), "allow_kN": allow, "ratio": round(leg / allow, 3),
                          "components_kN": {"live": round(live, 2), "deck_dead": round(dead_decks, 2), "self": round(self_wt, 2)}}
    if leg > allow:
        findings.append(f"Leg load {leg:.1f} kN exceeds allowable {allow} kN — reduce bay, add intermediate standards, or reduce loaded lifts.")

    # 2. transom bending: decks span the bay and bear on the transom (span = W).
    #    Worst transom carries half of each adjacent bay -> bmax as UDL across W.
    #    Deck span capacity itself comes from the manufacturer table (see references/load-tables.md).
    w = (q_live + tables["deck_dead_kN_per_m2"]) * bmax
    try:
        checks["transom"] = ledger_check(W, w, tables)
        if checks["transom"]["ratio_M"] > 1.0:
            findings.append(f"Transom bending ratio {checks['transom']['ratio_M']} > 1.0 for {bmax:.2f} m bays on {W:.2f} m width.")
        if checks["transom"]["ratio_defl"] > 1.0:
            findings.append(f"Transom deflection {checks['transom']['defl_mm']} mm exceeds L/150.")
    except Exception as e:  # PyNite missing
        checks["transom"] = {"error": str(e)}
        findings.append("Transom check skipped: PyNite unavailable.")
    deck_ok = tables.get("deck_max_bay_m", {}).get(duty.get("osha_class", "medium"))
    if deck_ok and bmax > deck_ok + 1e-6:
        findings.append(f"Deck span {bmax:.2f} m exceeds table max {deck_ok} m for {duty.get('osha_class','medium')} duty.")

    # 3. ties
    ratio = H / W
    ties = ev.get("ties", [])
    need_ties = ratio > 4.0
    vert_spacing_ft = 20 if W <= 3 * FT else 26
    L = sum(bays)
    req_rows = 0 if not need_ties else max(1, math.ceil((H - 4 * W) / (vert_spacing_ft * FT)) + 1)
    req_per_row = max(1, math.ceil(L / (30 * FT)))
    req = req_rows * req_per_row
    enclosed = "enclosure" in grid.get("special", [])
    tie_load = tables["tie_design_load_kN"]["enclosed" if enclosed else ("medium" if psf >= 50 else "light")]
    checks["ties"] = {"height_to_base": round(ratio, 2), "ties_required": need_ties, "min_ties_osha": req,
                      "ties_provided": len(ties), "tie_design_load_kN": tie_load,
                      "ties_under_design_load": [t for t in ties if t.get("design_load_kN", 0) < tie_load]}
    if need_ties and len(ties) < req:
        findings.append(f"{len(ties)} ties provided; OSHA spacing implies at least {req}.")
    if checks["ties"]["ties_under_design_load"]:
        findings.append(f"{len(checks['ties']['ties_under_design_load'])} tie(s) below {tie_load} kN design load.")

    # 4. bearing
    base = ev.get("base", {})
    area = tables["bearing"]["sole_board_area_m2"] if base.get("sole_boards") else tables["bearing"]["base_plate_area_m2"]
    allow_b = base.get("allowable_bearing_kPa") or tables["bearing"]["default_allowable_kPa"].get(base.get("ground", "soil"), 75)
    press = leg / area
    checks["bearing"] = {"pressure_kPa": round(press, 1), "allowable_kPa": allow_b, "ratio": round(press / allow_b, 3),
                         "sole_boards": bool(base.get("sole_boards"))}
    if press > allow_b:
        findings.append(f"Bearing {press:.0f} kPa exceeds {allow_b} kPa — add sole boards or spread footings.")

    # 5. PE triggers
    pe = []
    if H > 125 * FT:
        pe.append("height > 125 ft (OSHA 1926.451(a)(6))")
    for s in grid.get("special", []):
        if s in ("hanging", "cantilever", "dance_floor", "loading_bay", "shoring"):
            pe.append(s)
    if psf > 50:
        pe.append("heavy duty")
    checks["pe_required"] = bool(pe) or grid.get("pe_required", False)
    checks["pe_reasons"] = pe

    return {"elevation": ev["name"], "passed": not findings, "findings": findings, "checks": checks}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("grid")
    ap.add_argument("--out")
    ap.add_argument("--tables")
    a = ap.parse_args()
    grid = json.load(open(a.grid))
    tables = DEFAULT_TABLES
    if a.tables and os.path.exists(a.tables):
        tables = {**DEFAULT_TABLES, **json.load(open(a.tables))}
    results = [check_elevation(ev, grid, tables) for ev in grid["elevations"]]
    summary = {"project": grid.get("project"), "system": grid.get("system"),
               "passed": all(r["passed"] for r in results),
               "pe_required": any(r["checks"]["pe_required"] for r in results),
               "elevations": results,
               "note": "Screening check with placeholder tables marked (verify). Not for construction."}
    out = a.out or a.grid.rsplit(".", 1)[0] + "_loadcheck.json"
    json.dump(summary, open(out, "w"), indent=2)
    print(("PASS" if summary["passed"] else "FAIL") + (" — PE required" if summary["pe_required"] else ""))
    for r in results:
        for f in r["findings"]:
            print(f"  [{r['elevation']}] {f}")
    print(f"wrote {out}")
    sys.exit(0 if summary["passed"] else 2)


if __name__ == "__main__":
    main()
