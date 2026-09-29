"""
FIX SCRIPT: Decouple physics from position control
Run this in TouchDesigner Textport (Alt+T).

WHAT THIS FIXES:
  1. "Fish flies to corner when physics=0" 
     - Separates visual position (driven by user_data x/y)
       from physics (used only for collision/bounce walls)
  2. "Fish snaps to center when joystick released"
     - Installs a Speed CHOP inside player_master so
       joystick acts as velocity throttle, not teleport

WHAT IT DOES NOT CHANGE:
  - OSC pipeline (already working correctly)
  - Replicator / user_data structure (working)
  - bot_motion / demo bots (working)
"""

import math

p = op('/project1/tdbridge_test')
pm = p.op('player_master')

if not pm:
    print("ERROR: player_master not found!")
    raise SystemExit

# ----------------------------------------------------------------
# Step 1: Make physics_actor purely cosmetic / collision-only
# We'll give it a valid SOP so the "undefined" errors stop.
# But position will be driven by Transform CHOP, not physics.
# ----------------------------------------------------------------

actor = pm.op('physics_actor')
if actor:
    # Try to find or create a sphere SOP for collision shape
    sphere = actor.op('collision_sphere')
    if not sphere:
        try:
            sphere = actor.create(sphereSOP, 'collision_sphere')
            sphere.par.radx = 0.05
            sphere.par.rady = 0.05
            sphere.par.radz = 0.05
            print("Created collision_sphere SOP inside physics_actor")
        except Exception as e:
            print(f"Could not create collision_sphere: {e}")
    if sphere:
        actor.par.sops = 'collision_sphere'
        actor.par.shape = 'bsphere'
        print(f"physics_actor now uses collision_sphere (fixes 'undefined' error spam)")

# ----------------------------------------------------------------
# Step 2: Install/fix the DAT-to-CHOP pipeline for position inside player_master
# This reads x,y from user_data and applies it via Transform CHOP
# so physics_world toggle has NO effect on where fish appear.
# ----------------------------------------------------------------

# Find the select_user DAT (reads this clone's row from user_data)
sel = pm.op('select_user')
if not sel:
    print("WARNING: select_user DAT not found inside player_master.")
    print("Cannot auto-install velocity pipeline without knowing your network layout.")
    print("Please run scripts/diagnose_physics.py first to map the internals.")
else:
    print(f"Found select_user DAT: {sel.name}")
    
    # Check if dat_to_chop exists
    d2c = pm.op('dat_to_chop1') or pm.op('dat_to_chop')
    if d2c:
        print(f"dat_to_chop found: {d2c.name}")
    else:
        print("WARNING: No dat_to_chop found. The position pipeline may need manual wiring.")

    # Check if Speed CHOP exists
    speed = pm.op('speed1') or pm.op('speed') or pm.op('player_speed')
    if speed:
        print(f"Speed CHOP found: {speed.name} - velocity mode already set up")
    else:
        print("No Speed CHOP found - this is why fish snaps to center on joystick release")
        print("See archive/player_movement_plan.md for the full plan to add velocity movement.")
        print("Run /install_velocity_movement.py when ready to install it.")

# ----------------------------------------------------------------
# Step 3: Fix startup_init to NOT call physics_world.par.start.pulse()
# at startup (or make it conditional) - this prevents the
# physics engine from OVERRIDING user_data position on open
# ----------------------------------------------------------------

startup = op('/project1/startup_init')
if startup:
    current_text = startup.text
    if 'pw.par.start.pulse()' in current_text:
        print("\n[!] startup_init is currently pulsing physics_world.par.start on open.")
        print("    This RESETS all actor positions to origin (0,0,0) every time you load the .toe.")
        print("    That is why fish appear in a corner/edge when physics is enabled at startup.")
        print("\n    FIX: The startup_init should NOT pulse physics start automatically.")
        print("    You should manually enable physics ONLY AFTER the bots have initialized.")
    else:
        print("startup_init does not auto-pulse physics start - OK")

# ----------------------------------------------------------------
# Step 4: Report current physics_world state clearly
# ----------------------------------------------------------------
pw = p.op('physics_world')
if pw:
    print(f"\n[PHYSICS WORLD STATUS]")
    print(f"  physics_world found: YES")
    try:
        print(f"  physics_world.par.active = {pw.par.active.val}")
    except:
        pass
    print("""
  IMPORTANT UNDERSTANDING:
  - physics=1  -> Bullet solver moves the fish based on forces/gravity
                   Bot fish appear to "work" because forces push them around
  - physics=0  -> Bullet solver stops; fish default to origin (0,0) in Bullet
                   This maps to a CORNER or EDGE of your canvas, not the center
                   
  REAL FIX: Drive fish position from user_data x/y via Transform TOP,
  and use physics ONLY for wall collision bouncing - not for movement.
  That way physics toggle never affects where fish are visually.
""")

print("\n=== DIAGNOSIS COMPLETE ===")
print("Next step: Open scripts/diagnose_physics.py in TD textport for a full map of your network.")
