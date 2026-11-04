#!/usr/bin/env python3
"""
ifc_scaffold.py — generate an IFC4 scaffold model from an Avatar Access bay_grid.json.

Usage:
    python ifc_scaffold.py bay_grid.json out.ifc [--components components.json]

Creates standards (vertical), ledgers (along), transoms (across), decks on decked
lifts, diagonal braces, and tie markers as IfcMember / IfcPlate elements grouped
under an IfcBuildingElementProxy container per elevation. Also writes a component
count JSON next to the IFC for the cost-model skill.

Geometry is metric internally; a bay_grid in feet is converted.
"""
import json
import math
import sys
from collections import Counter

import ifcopenshell
import ifcopenshell.api
import ifcopenshell.api.root
import ifcopenshell.api.unit
import ifcopenshell.api.context
import ifcopenshell.api.project
import ifcopenshell.api.spatial
import ifcopenshell.api.geometry
import ifcopenshell.api.aggregate
import ifcopenshell.api.pset

FT = 0.3048
TUBE_D = 0.0483          # 48.3 mm scaffold tube
DECK_T = 0.05            # deck thickness
DECK_W = 0.32            # Layher deck width
ROSETTE = 0.5            # rosette pitch on standards


def load(path):
    with open(path) as f:
        return json.load(f)


def to_m(v, units):
    return v * FT if units == "ft" else v


def nearest_standard(h):
    """Split a lift height into stock standard lengths (m)."""
    stock = [4.0, 3.0, 2.5, 2.0, 1.5, 1.0, 0.5]
    out, rem = [], round(h, 3)
    while rem > 0.01:
        for s in stock:
            if s <= rem + 1e-6:
                out.append(s)
                rem = round(rem - s, 3)
                break
        else:
            out.append(0.5)
            rem = 0
    return out


class Builder:
    def __init__(self, project_name):
        self.f = ifcopenshell.api.project.create_file(version="IFC4")
        self.project = ifcopenshell.api.root.create_entity(self.f, ifc_class="IfcProject", name=project_name)
        ifcopenshell.api.unit.assign_unit(self.f)
        self.ctx = ifcopenshell.api.context.add_context(self.f, context_type="Model")
        self.body = ifcopenshell.api.context.add_context(
            self.f, context_type="Model", context_identifier="Body", target_view="MODEL_VIEW", parent=self.ctx
        )
        self.site = ifcopenshell.api.root.create_entity(self.f, ifc_class="IfcSite", name="Site")
        ifcopenshell.api.aggregate.assign_object(self.f, relating_object=self.project, products=[self.site])
        self.counts = Counter()

    def box(self, name, ifc_class, origin, dx, dy, dz, rot_deg=0.0, container=None, props=None, sku=None):
        """Axis-aligned box (before rotation about Z at origin)."""
        el = ifcopenshell.api.root.create_entity(self.f, ifc_class=ifc_class, name=name)
        rep = ifcopenshell.api.geometry.add_wall_representation(self.f, context=self.body, length=dx, height=dz, thickness=dy)
        ifcopenshell.api.geometry.assign_representation(self.f, product=el, representation=rep)
        m = ifcopenshell.util.placement.a2p(  # noqa: F821 (imported below)
            origin, (0.0, 0.0, 1.0), (math.cos(math.radians(rot_deg)), math.sin(math.radians(rot_deg)), 0.0)
        )
        ifcopenshell.api.geometry.edit_object_placement(self.f, product=el, matrix=m)
        if container is not None:
            ifcopenshell.api.spatial.assign_container(self.f, relating_structure=container, products=[el])
        pset = ifcopenshell.api.pset.add_pset(self.f, product=el, name="AvatarAccess_Scaffold")
        data = {"Sku": sku or name}
        if props:
            data.update(props)
        ifcopenshell.api.pset.edit_pset(self.f, pset=pset, properties=data)
        if sku:
            self.counts[sku] += 1
        return el

    def elevation(self, ev, units, system):
        L = to_m(ev["length"], units)
        H = to_m(ev["height"], units)
        W = to_m(ev.get("width", 0.73), units)
        bays = [to_m(b, units) for b in ev["bays"]]
        lifts = [to_m(l, units) for l in ev["lifts"]]
        decked = set(ev.get("decked_lifts", list(range(1, len(lifts) + 1))))
        ox, oy = (ev.get("origin") or [0, 0])[:2]
        rot = ev.get("direction_deg", 0.0)
        storey = ifcopenshell.api.root.create_entity(self.f, ifc_class="IfcBuildingStorey", name=f"Elevation {ev['name']}")
        ifcopenshell.api.aggregate.assign_object(self.f, relating_object=self.site, products=[storey])
        cr, sr = math.cos(math.radians(rot)), math.sin(math.radians(rot))

        def world(x, y, z):
            return (ox + x * cr - y * sr, oy + x * sr + y * cr, z)

        # node x positions
        xs = [0.0]
        for b in bays:
            xs.append(xs[-1] + b)
        ys = [0.0, W]
        lift_z = [0.0] + [sum(lifts[: i + 1]) for i in range(len(lifts))]
        top = lift_z[-1]

        # standards
        for x in xs:
            for y in ys:
                z = 0.0
                for seg in nearest_standard(top):
                    self.box(f"Standard {seg} m", "IfcColumn", world(x, y, z), TUBE_D, TUBE_D, seg, rot,
                             storey, {"System": system, "Length_m": seg}, sku=f"STD-{seg:.1f}")
                    z += seg
                self.box("Base jack", "IfcMember", world(x, y, -0.02), 0.15, 0.15, 0.02, rot, storey,
                         {"System": system}, sku="BASEJACK")

        # ledgers (along) at every lift level incl. base (kick lift at 0.5 m per rosette)
        for li, z in enumerate(lift_z):
            zz = z if li > 0 else ROSETTE
            for i, b in enumerate(bays):
                for y in ys:
                    self.box(f"Ledger {b:.2f} m", "IfcBeam", world(xs[i], y - TUBE_D / 2, zz), b, TUBE_D, TUBE_D, rot,
                             storey, {"System": system, "Length_m": b}, sku=f"LDG-{b:.2f}")
            # transoms (across) at every node
            for x in xs:
                self.box(f"Transom {W:.2f} m", "IfcBeam", world(x - TUBE_D / 2, 0.0, zz), TUBE_D, W, TUBE_D, rot,
                         storey, {"System": system, "Length_m": W}, sku=f"TRN-{W:.2f}")
            # guardrails: top rail at +1.0 and mid at +0.5 on outer face for decked lifts
            if li in decked:
                for i, b in enumerate(bays):
                    for dz in (0.5, 1.0):
                        self.box("Guardrail", "IfcRailing", world(xs[i], W - TUBE_D / 2, zz + dz), b, TUBE_D, TUBE_D, rot,
                                 storey, {"System": system, "Length_m": b}, sku=f"LDG-{b:.2f}")
                    self.box("Toeboard", "IfcRailing", world(xs[i], W - 0.03, zz), b, 0.03, 0.15, rot, storey,
                             {"System": system}, sku=f"TOE-{b:.2f}")

        # decks
        n_decks_across = max(1, int(round(W / DECK_W)))
        for li in decked:
            if li >= len(lift_z):
                continue
            z = lift_z[li]
            for i, b in enumerate(bays):
                for k in range(n_decks_across):
                    self.box(f"Deck {b:.2f} m", "IfcPlate", world(xs[i], k * DECK_W, z), b, DECK_W, DECK_T, rot, storey,
                             {"System": system, "Length_m": b}, sku=f"DECK-{b:.2f}")

        # facade diagonals every n bays, full height, outer plane
        n = (ev.get("braces") or {}).get("facade_every_n_bays", 5)
        for i in range(0, len(bays), max(1, n)):
            for li in range(len(lifts)):
                z0, z1 = lift_z[li], lift_z[li + 1]
                length = math.hypot(bays[i], z1 - z0)
                self.box(f"Diagonal {bays[i]:.2f}x{(z1 - z0):.2f}", "IfcMember", world(xs[i], W + 0.05, z0),
                         length, TUBE_D, TUBE_D, rot, storey,
                         {"System": system, "Length_m": round(length, 3), "Note": "shown flat; true inclination in drawings"},
                         sku=f"DIAG-{bays[i]:.2f}x{(z1 - z0):.2f}")

        # ties
        for t in ev.get("ties", []):
            bi, li = t["bay"], t["lift"]
            x = xs[min(bi, len(xs) - 1)]
            z = lift_z[min(li, len(lift_z) - 1)]
            self.box(f"Tie ({t.get('type','anchor')})", "IfcMember", world(x, -0.6, z), 0.6 + W, TUBE_D, TUBE_D, rot,
                     storey, {"System": system, "TieType": t.get("type", "anchor"),
                              "DesignLoad_kN": t.get("design_load_kN", 0)}, sku=f"TIE-{t.get('type','anchor').upper()}")

        return storey


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    grid = load(sys.argv[1])
    out = sys.argv[2]
    units = grid.get("units", "m")
    system = grid.get("system", "layher_allround")
    b = Builder(grid.get("project", "Avatar Access scaffold"))
    for ev in grid["elevations"]:
        b.elevation(ev, units, system)
    b.f.write(out)
    counts_path = out.rsplit(".", 1)[0] + "_components.json"
    with open(counts_path, "w") as f:
        json.dump({"system": system, "counts": dict(sorted(b.counts.items()))}, f, indent=2)
    print(f"wrote {out} and {counts_path}: {sum(b.counts.values())} pieces")


import ifcopenshell.util.placement  # noqa: E402

if __name__ == "__main__":
    main()
