"""
FULL SYSTEM REPAIR SCRIPT v2
Run this in the TD textport OR paste into a textDAT and pulse it.

Fixes applied:
1. bot_motion -> writes joystick_x/y (not x/y) so bots use velocity pipeline correctly
2. Velocity CHOPs reset on all clones
3. Telemetry system: osc_out node (port 9001) + telemetry_exec sending fps/players/errors
4. joystick_switch expression fixed for proper bot vs real player routing
5. osc_processor upgraded with lag diagnostics (last_seen tracking)
6. startup_init updated with all v2 fixes
7. Physics toggle verified
"""

import math

p = op('/project1/tdbridge_test')
ud = p.op('user_data')

print('='*60)
print('TDBRIDGE REPAIR SCRIPT v2')
print('='*60)

# ==============================================================
# FIX 1: bot_motion - write joystick_x/y not x/y
# ==============================================================
bm = p.op('bot_motion')
bm.text = '''
import math
BOT_SLOTS = [1, 2, 3, 4, 5]
BOT_NAMES  = ['Nemo', 'Dory', 'Marlin', 'Gill', 'Bubbles']
BOT_COLORS = [(1.0,0.45,0.0),(0.2,0.5,1.0),(0.1,0.8,0.6),(1.0,0.85,0.1),(0.7,0.3,1.0)]
ORBIT_R    = 0.42     # orbit radius (fraction of screen)
ORBIT_SPD  = 0.003    # radians per frame

def onFrameStart(frame):
    try:
        ud = op("user_data")
        t  = frame * ORBIT_SPD
        for i, slot in enumerate(BOT_SLOTS):
            name = ud[slot, "name"].val
            # Restore bot if slot is empty
            if name == "":
                ud[slot, "name"]  = BOT_NAMES[i]
                ud[slot, "r"]     = str(BOT_COLORS[i][0])
                ud[slot, "g"]     = str(BOT_COLORS[i][1])
                ud[slot, "b"]     = str(BOT_COLORS[i][2])
                continue
            # Skip if a real player took this slot
            if name not in BOT_NAMES:
                continue
            # Orbit: feed velocity delta into joystick_x/y so Speed CHOP drives position
            angle = (i / len(BOT_SLOTS)) * 2 * math.pi + t
            # velocity = derivative of circle position, scaled to fit -1..1 joystick range
            vx = round(-ORBIT_R * math.sin(angle) * ORBIT_SPD * 60, 4)
            vy = round( ORBIT_R * math.cos(angle) * ORBIT_SPD * 60, 4)
            ud[slot, "joystick_x"] = str(vx)
            ud[slot, "joystick_y"] = str(vy)
    except:
        pass
'''
print('[FIX 1] bot_motion rewritten -> writes joystick_x/y')

# Clear stale joystick values for all bot slots
for slot in range(1, 6):
    ud[slot, 'joystick_x'] = '0'
    ud[slot, 'joystick_y'] = '0'
print('[FIX 1] Bot joystick_x/y cleared to 0')

# ==============================================================
# FIX 2: Reset velocity CHOPs on all clones + player_master
# ==============================================================
for cname in ['player_master', 'item1','item2','item3','item4','item5']:
    clone = p.op(cname)
    if clone:
        vel = clone.op('velocity')
        if vel:
            try:
                vel.par.resetpulse.pulse()
            except:
                # Manual drain: briefly set speed=0 then restore
                old = vel.par.speed.val
                vel.par.speed.val = 0.0
                vel.par.speed.val = old
print('[FIX 2] Velocity CHOPs reset on all clones')

# ==============================================================
# FIX 3: osc_out telemetry node
# ==============================================================
osc_out = p.op('osc_out')
if not osc_out:
    osc_out = p.create(oscoutDAT, 'osc_out')
osc_out.par.address = '127.0.0.1'
osc_out.par.port    = 9001
osc_out.par.active  = True
print(f'[FIX 3] osc_out -> 127.0.0.1:9001 active={osc_out.par.active.val}')

# ==============================================================
# FIX 4: telemetry_exec (1Hz diagnostic sender)
# ==============================================================
tele = p.op('telemetry_exec')
if not tele:
    tele = p.create(executeDAT, 'telemetry_exec')

tele.par.active     = 1
tele.par.framestart = 1
tele.text = '''
_tick = 0
INTERVAL = 60  # frames between sends (1s @ 60fps)

def onFrameStart(frame):
    global _tick
    _tick += 1
    if _tick < INTERVAL:
        return
    _tick = 0
    try:
        p      = op("/project1/tdbridge_test")
        osc_out = p.op("osc_out")
        if not osc_out:
            return
        # FPS
        osc_out.sendOSC("/td/fps", [project.cookRate])
        # Real players (slots 6+)
        ud = p.op("user_data")
        real_players = sum(1 for r in range(6, ud.numRows) if ud[r,"name"].val != "")
        osc_out.sendOSC("/td/players", [real_players])
        # Clone count
        clones = len([c for c in p.children if c.name.startswith("item") and c.OPType == "baseCOMP"])
        osc_out.sendOSC("/td/clones", [clones])
        # Swaporder safety check
        ap = p.op("all_players")
        if ap and ap.par.swaporder.val:
            ap.par.swaporder.val = False
            osc_out.sendOSC("/td/error", ["AUTOFIX: swaporder was True - corrected"])
        # OSC buffer check (should never exceed 200 rows)
        osc_in = p.op("bridge_osc_in")
        if osc_in and osc_in.numRows > 200:
            osc_in.clear(keepFirstRow=True)
            osc_out.sendOSC("/td/error", ["AUTOFIX: osc_in buffer overflow cleared"])
        # Errors
        errs = [c.name for c in p.children
                if hasattr(c,"errors") and c.errors() and len(c.errors().strip()) > 5]
        if errs:
            osc_out.sendOSC("/td/error", ["ERR in: " + ", ".join(errs[:3])])
    except:
        pass
'''
print('[FIX 4] telemetry_exec (1Hz) installed')

# ==============================================================
# FIX 5: Upgrade osc_processor with last_seen tracking + lag metrics
# ==============================================================
proc = p.op('osc_processor')
proc.text = '''
_prev_player_count = 0
import time as _time

def onFrameStart(frame):
    global _prev_player_count
    try:
        p      = op("/project1/tdbridge_test")
        osc_in = p.op("bridge_osc_in")
        ud     = p.op("user_data")
        if not osc_in or not ud:
            return
        if osc_in.numRows <= 1:
            return

        # Read all messages (skip header row 0)
        msgs = []
        for r in range(1, osc_in.numRows):
            raw = osc_in[r, 0].val if osc_in.numCols > 0 else ""
            if not raw or not raw.startswith("/slot_"):
                continue
            space = raw.find(" ")
            if space < 0:
                continue
            address = raw[:space]
            val     = raw[space+1:].strip()
            parts   = address.split("_")
            # /slot_N_channel -> parts = ["/slot", "N", "channel"]
            if len(parts) < 3:
                continue
            slot_id_str = parts[1]
            channel     = "_".join(parts[2:])
            msgs.append((slot_id_str, channel, val))

        # CRITICAL: clear buffer after reading
        if msgs:
            osc_in.clear(keepFirstRow=True)

        now_str = str(frame)  # Use frame as lightweight timestamp
        name_changed = False

        for slot_id_str, channel, val in msgs:
            try:
                slot_id = int(slot_id_str)
                if slot_id < 1 or slot_id > 100:
                    continue
                if channel == "x":
                    ud[slot_id, "x"]          = val
                    ud[slot_id, "joystick_x"] = val
                elif channel == "y":
                    ud[slot_id, "y"]          = val
                    ud[slot_id, "joystick_y"] = val
                elif channel == "active":
                    if val in ("0", "0.0"):
                        for col in ["name","x","y","joystick_x","joystick_y",
                                    "rotate_vis","action1","action2","slider1",
                                    "r","g","b","last_seen"]:
                            ud[slot_id, col] = "" if col in ("name","last_seen") else "0"
                        name_changed = True
                elif channel == "name":
                    clean = val.strip(chr(34)).strip("\'")
                    if ud[slot_id, "name"].val != clean:
                        ud[slot_id, "name"]      = clean
                        ud[slot_id, "last_seen"] = now_str
                        name_changed = True
                elif channel == "action1":
                    ud[slot_id, "action1"] = val
                elif channel == "action2":
                    ud[slot_id, "action2"] = val
                elif channel == "slider1":
                    ud[slot_id, "slider1"] = val
                elif channel == "rotate_vis":
                    ud[slot_id, "rotate_vis"] = val
                elif channel in ("room_code",):
                    pass  # ignore
                else:
                    ud[slot_id, "last_seen"] = now_str  # mark activity on any message
            except:
                pass

        # Trigger replicator only when player count actually changes (slots 6+)
        if name_changed:
            current = sum(1 for r in range(6, ud.numRows) if ud[r,"name"].val != "")
            if current != _prev_player_count:
                _prev_player_count = current
                rep = p.op("replicator")
                if rep:
                    rep.par.recreateall.pulse()
    except:
        pass
'''
print('[FIX 5] osc_processor upgraded with last_seen tracking')

# ==============================================================
# FIX 6: verify physics_toggle and physics_world
# ==============================================================
pt = p.op('physics_toggle')
pw = p.op('physics_world')
if pt:
    print(f'[CHECK] physics_toggle: physics_enabled = {pt["physics_enabled"].eval()}')
if pw:
    print(f'[CHECK] physics_world: gravityy expr = {pw.par.gravityy.expr!r}')
    if not pw.par.gravityy.expr:
        pw.par.gravityy.expr = "op('/project1/tdbridge_test/physics_toggle')['physics_enabled'] * -9.8"
        print('[FIX 6] physics_world gravityy expression restored')

# ==============================================================
# FIX 7: Sanity checks
# ==============================================================
ap = p.op('all_players')
if ap.par.swaporder.val:
    ap.par.swaporder.val = False
    print('[FIX 7] all_players swaporder reset to False')

out1 = p.op('out1')
if not out1.inputs:
    ov1 = p.op('over1')
    if ov1:
        ov1.outputConnectors[0].connect(out1)
        print('[FIX 7] Reconnected over1 -> out1')

# ==============================================================
# UPDATE startup_init to bake all v2 fixes on every project open
# ==============================================================
startup = op('/project1/startup_init')
startup.text = '''
def onStart():
    import math
    p  = op("/project1/tdbridge_test")
    ud = p.op("user_data")
    if not ud:
        return

    # 1. Ensure 101 rows (header + 100 slots)
    float_cols = ["x","y","color_h","r","g","b","rotate_vis",
                  "action1","action2","slider1","joystick_x","joystick_y"]
    header = [ud[0,c].val for c in range(ud.numCols)]
    if ud.numRows < 101:
        ud.clear(keepFirstRow=True)
        for r in range(1, 101):
            row = []
            for col in header:
                if col == "client":   row.append(f"slot_{r}")
                elif col in float_cols: row.append("0")
                else:                  row.append("")
            ud.appendRow(row)

    # 2. Reset OSC buffer + store
    p.store("osc_msgs", [])
    osc_in = p.op("bridge_osc_in")
    if osc_in:
        osc_in.clear(keepFirstRow=True)

    # 3. Bot init (slots 1-5)
    BOT_NAMES  = ["Nemo","Dory","Marlin","Gill","Bubbles"]
    BOT_COLORS = [(1.0,0.45,0.0),(0.2,0.5,1.0),(0.1,0.8,0.6),(1.0,0.85,0.1),(0.7,0.3,1.0)]
    for i,(name,(r,g,b)) in enumerate(zip(BOT_NAMES,BOT_COLORS)):
        row = i+1
        if ud[row,"name"].val == "":
            angle = (i/5)*2*math.pi
            ud[row,"name"]  = name
            ud[row,"x"]     = str(round(0.4*math.cos(angle),3))
            ud[row,"y"]     = str(round(0.4*math.sin(angle),3))
            ud[row,"r"]     = str(r)
            ud[row,"g"]     = str(g)
            ud[row,"b"]     = str(b)
        elif ud[row,"r"].val == "0":  # Fix missing colors
            ud[row,"r"] = str(r)
            ud[row,"g"] = str(g)
            ud[row,"b"] = str(b)

    # 4. select_active
    sel = p.op("select_active")
    if sel:
        sel.par.extractrows = "byexpr"
        sel.par.rowexpr = "me.inputTable[me.inputRow, \\'name\\'] != \\'\\' or me.inputRow == 0"

    # 5. Replicator
    rep = p.op("replicator")
    if rep:
        rep.par.method   = "bytable"
        rep.par.template = "select_active"
        rep.par.recreateall.pulse()

    # 6. Compositor
    ap = p.op("all_players")
    if ap:
        ap.par.swaporder.val = False

    # 7. Background color
    bg = p.op("bg")
    if bg:
        bg.par.colorr.val = 0.05
        bg.par.colorg.val = 0.05
        bg.par.colorb.val = 0.12

    # 8. Movement switch locked (velocity mode)
    pm = p.op("player_master")
    if pm:
        ms = pm.op("movement_switch")
        if ms:
            ms.par.index.expr = ""
            ms.par.index.val  = 0
        vel = pm.op("velocity")
        if vel:
            vel.par.speed.val = 0.3

    # 9. Physics gravity
    pw = p.op("physics_world")
    if pw:
        try:
            pw.par.gravityy.expr = "op(\\'/project1/tdbridge_test/physics_toggle\\')[\\'physics_enabled\\'] * -9.8"
        except:
            pass

    # 10. Output chain
    nt = p.op("name_tag")
    if nt:
        nt.bypass = True
    ov1  = p.op("over1")
    out1 = p.op("out1")
    if ov1 and out1 and not out1.inputs:
        ov1.outputConnectors[0].connect(out1)

    # 11. Telemetry: osc_out
    osc_out = p.op("osc_out")
    if not osc_out:
        osc_out = p.create(oscoutDAT, "osc_out")
    osc_out.par.address = "127.0.0.1"
    osc_out.par.port    = 9001
    osc_out.par.active  = True
'''

print('\n[DONE] All fixes applied.')
print('[SAVE] Saving project...')
project.save()
print('Saved as:', project.name)
