"""
TDBRIDGE DIAGNOSTIC SCRIPT
Run this in TouchDesigner's Textport (Alt+T) to get a full status report.
Tells you exactly what is wrong with physics and why controls feel broken.
"""

def diagnose():
    report = []
    report.append("=" * 60)
    report.append("TDBRIDGE DIAGNOSTIC REPORT")
    report.append("=" * 60)

    p = op('/project1/tdbridge_test')
    if not p:
        print("ERROR: /project1/tdbridge_test not found. Wrong network path?")
        return

    # ----------------------------------------------------------------
    # 1. Check physics_world
    # ----------------------------------------------------------------
    pw = p.op('physics_world')
    report.append("\n[1] PHYSICS WORLD")
    if not pw:
        report.append("  ERROR: physics_world not found!")
    else:
        try:
            active = pw.par.active.val
            report.append(f"  physics_world exists: YES")
            report.append(f"  physics_world.par.active = {active}")
            report.append(f"  Cook state: {pw.cookState}")
        except Exception as e:
            report.append(f"  Could not read physics_world params: {e}")

    # ----------------------------------------------------------------
    # 2. Check player_master physics_actor
    # ----------------------------------------------------------------
    report.append("\n[2] PLAYER_MASTER PHYSICS ACTOR")
    pm = p.op('player_master')
    if not pm:
        report.append("  ERROR: player_master not found!")
    else:
        actor = pm.op('physics_actor')
        if not actor:
            report.append("  ERROR: player_master/physics_actor not found!")
        else:
            report.append(f"  physics_actor exists: YES")
            try:
                report.append(f"  physics_actor.par.active = {actor.par.active.val}")
                report.append(f"  physics_actor.par.sops    = '{actor.par.sops.val}'")
                report.append(f"  physics_actor.par.shape   = '{actor.par.shape.val}'")
                # Check if the referenced SOP actually exists
                sop_ref = actor.par.sops.val
                if sop_ref:
                    sop = actor.op(sop_ref)
                    if not sop:
                        report.append(f"  WARNING: SOP '{sop_ref}' referenced but NOT FOUND inside physics_actor!")
                        report.append(f"  --> This causes physics errors every frame (the 'undefined' spam in log)")
                    else:
                        report.append(f"  SOP '{sop_ref}' found: OK")
                else:
                    report.append("  WARNING: physics_actor.par.sops is EMPTY - no collision shape assigned!")
            except Exception as e:
                report.append(f"  Could not read actor params: {e}")

    # ----------------------------------------------------------------
    # 3. Check how player_master uses position (physics vs direct)
    # ----------------------------------------------------------------
    report.append("\n[3] POSITION CONTROL MODE (KEY ISSUE)")
    if pm:
        # Look for a Transform TOP or similar that drives position
        transform = pm.op('transform1') or pm.op('transform') or pm.op('player_transform')
        if transform:
            report.append(f"  Found transform node: {transform.name}")
            try:
                tx = transform.par.tx.val if hasattr(transform.par, 'tx') else '?'
                ty = transform.par.ty.val if hasattr(transform.par, 'ty') else '?'
                report.append(f"  Transform tx={tx}, ty={ty}")
            except:
                pass
        else:
            report.append("  No top-level transform found - position likely driven differently")

        # Check if there's a Speed CHOP (velocity mode)
        speed = pm.op('speed1') or pm.op('speed')
        if speed:
            report.append(f"  Speed CHOP found: {speed.name} (VELOCITY MODE - good!)")
        else:
            report.append("  WARNING: No Speed CHOP found.")
            report.append("  --> Position is likely ABSOLUTE (joystick=0 snaps fish to center/corner)")
            report.append("  --> THIS IS THE CONTROL PROBLEM YOU ARE SEEING")

    # ----------------------------------------------------------------
    # 4. Check user_data table state
    # ----------------------------------------------------------------
    report.append("\n[4] USER_DATA TABLE")
    ud = p.op('user_data')
    if not ud:
        report.append("  ERROR: user_data not found!")
    else:
        report.append(f"  Rows: {ud.numRows}, Cols: {ud.numCols}")
        report.append(f"  Header row: {[ud[0, c].val for c in range(ud.numCols)]}")
        # Show first 6 rows
        for r in range(1, min(7, ud.numRows)):
            name = ud[r, 'name'].val if ud.col('name') else '?'
            x    = ud[r, 'x'].val    if ud.col('x')    else '?'
            y    = ud[r, 'y'].val    if ud.col('y')    else '?'
            report.append(f"  Row {r}: name='{name}', x={x}, y={y}")

    # ----------------------------------------------------------------
    # 5. Check osc_processor active state
    # ----------------------------------------------------------------
    report.append("\n[5] OSC PROCESSOR")
    proc = p.op('osc_processor')
    if not proc:
        report.append("  ERROR: osc_processor not found!")
    else:
        report.append(f"  Active: {proc.par.active.val}")
        report.append(f"  framestart: {proc.par.framestart.val}")

    # ----------------------------------------------------------------
    # 6. Check bridge_osc_in
    # ----------------------------------------------------------------
    report.append("\n[6] OSC IN (bridge_osc_in)")
    osc_in = p.op('bridge_osc_in')
    if not osc_in:
        report.append("  ERROR: bridge_osc_in not found!")
    else:
        report.append(f"  Active: {osc_in.par.active.val}")
        report.append(f"  Port: {osc_in.par.port.val}")
        report.append(f"  Callbacks: '{osc_in.par.callbacks.val}' (should be '')")

    # ----------------------------------------------------------------
    # SUMMARY
    # ----------------------------------------------------------------
    report.append("\n" + "=" * 60)
    report.append("ROOT CAUSE SUMMARY:")
    report.append("=" * 60)
    report.append("""
PHYSICS TOGGLE BUG (physics=0 sends fish to corner):
  The physics_world Bullet solver is DRIVING position when active.
  When you set physics_world=0, the solver stops, but the fish
  position is no longer being SET by anything (it defaults to 0,0
  which in your canvas coordinate system is likely a corner or edge).

  FIX OPTIONS:
  A) Don't use physics for position control. Drive position
     purely from user_data x/y via a Transform CHOP/TOP inside
     player_master, and use physics only for collision/bouncing.
  B) If you want physics for movement: apply a force/velocity
     based on joystick input INSIDE the physics_actor, rather
     than teleporting the actor via x/y.
  C) Quick workaround: when disabling physics, also set all
     x/y positions to their last known values.

CONTROL FEEL BUG (fish snaps to center on joystick release):
  The joystick sends X=0, Y=0 on release. If position is
  ABSOLUTE (directly mapped to x/y), the fish teleports to
  center. You need a Speed CHOP (velocity accumulator) inside
  player_master so the fish *drifts* to a stop instead.
  See archive/player_movement_plan.md for the exact plan.
""")

    for line in report:
        print(line)

diagnose()
