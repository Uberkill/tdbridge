import td

# ==============================================================
# MASTER FIX SCRIPT - Run once when TD is open
# Fixes:
#   1. Cook Dependency Loop on bridge_osc_in
#   2. Clone physics_actor missing collision SOP path
#   3. Bots visible at start (populate user_data with test bots)
#   4. Select DAT filter (only show active rows to Replicator)
# ==============================================================

def master_fix():
    p = op('/project1/tdbridge_test')
    ud = p.op('user_data')

    # ----------------------------------------------------------
    # FIX 1: OSC Callback - blind write (no reads inside OSC handler)
    # Reads ALWAYS cause Cook Dependency Loops in OSC callbacks.
    # We use slot_id as a direct row index instead of findCell().
    # ----------------------------------------------------------
    cb = p.op('bridge_osc_callbacks')
    cb.text = """\
def onReceiveOSC(dat, rowIndex, message, bytes, timeStamp, sender, peerAddress, peerPort):
    try:
        raw_str = dat[rowIndex, 0].val
        parts_msg = message.split('_')
        if len(parts_msg) < 3 or parts_msg[0] != '/slot':
            return

        slot_id = int(parts_msg[1])
        if slot_id < 1 or slot_id > 100:
            return

        channel = '_'.join(parts_msg[2:])
        space = raw_str.find(' ')
        val = raw_str[space+1:] if space >= 0 else '0'

        ud = op('user_data')
        # Row index = slot_id (row 1 = slot_1, etc.)
        # user_data has header on row 0, slot_N is on row N
        # We ONLY WRITE, never read row counts. This prevents cook loops.

        if channel == 'x':
            ud[slot_id, 'x'] = val
            ud[slot_id, 'joystick_x'] = val
        elif channel == 'y':
            ud[slot_id, 'y'] = val
            ud[slot_id, 'joystick_y'] = val
        elif channel == 'active':
            ud[slot_id, 'active'] = val
            if val == '0' or val == '0.0':
                ud[slot_id, 'name'] = ''
                ud[slot_id, 'x'] = '0'
                ud[slot_id, 'y'] = '0'
                ud[slot_id, 'joystick_x'] = '0'
                ud[slot_id, 'joystick_y'] = '0'
        elif channel == 'name':
            ud[slot_id, 'name'] = val.strip('"').strip("'")
        elif channel == 'action1':
            ud[slot_id, 'action1'] = val
        elif channel == 'action2':
            ud[slot_id, 'action2'] = val
        elif channel == 'slider1':
            ud[slot_id, 'slider1'] = val
        elif channel == 'rotate_vis':
            ud[slot_id, 'rotate_vis'] = val
    except:
        pass
"""

    # ----------------------------------------------------------
    # FIX 2: Pre-populate user_data with 100 clean rows (all zeros)
    # Slot_id maps directly to row index. No dynamic append/delete.
    # ----------------------------------------------------------
    ud.clear(keepFirstRow=True)
    float_cols = ['x', 'y', 'color_h', 'r', 'g', 'b', 'rotate_vis', 'action1', 'action2', 'slider1', 'joystick_x', 'joystick_y', 'active']
    for r in range(1, 101):
        new_row = []
        for c in range(ud.numCols):
            col_name = ud[0, c].val
            if col_name == 'client':
                new_row.append(f'slot_{r}')
            elif col_name in float_cols:
                new_row.append('0')
            else:
                new_row.append('')
        ud.appendRow(new_row)

    # ----------------------------------------------------------
    # FIX 3: Create a Select DAT that filters only active players
    # Replicator reads this - only spawns fish for active=1 slots
    # ----------------------------------------------------------
    sel = p.op('select_active')
    if not sel:
        sel = p.create(selectDAT, 'select_active')
    sel.par.dat = 'user_data'
    sel.par.extractrows = 'cond'
    # Keep header (row 0) + any row where active == '1'
    sel.par.rowexpr = "me.inputTable[me.inputRow, 'active'] == '1' or me.inputRow == 0"

    # ----------------------------------------------------------
    # FIX 4: Point Replicator to the Select DAT (not raw user_data)
    # ----------------------------------------------------------
    rep = p.op('replicator')
    rep.par.template = 'select_active'

    # ----------------------------------------------------------
    # FIX 5: Fix physics_actor clone collision SOP path in master
    # ----------------------------------------------------------
    actor = p.op('player_master/physics_actor')
    if actor:
        actor.par.sops = '../collision_shape'

    # ----------------------------------------------------------
    # FIX 6: Spawn 5 test bots so screen isn't empty
    # ----------------------------------------------------------
    import math, time
    bot_names = ['Nemo', 'Dory', 'Marlin', 'Gill', 'Bubbles']
    for i, name in enumerate(bot_names):
        angle = (i / 5) * 2 * math.pi
        ud[i+1, 'active'] = '1'
        ud[i+1, 'name'] = name
        ud[i+1, 'x'] = str(round(0.4 * math.cos(angle), 3))
        ud[i+1, 'y'] = str(round(0.4 * math.sin(angle), 3))
        ud[i+1, 'joystick_x'] = str(round(0.2 * math.cos(angle + 0.5), 3))
        ud[i+1, 'joystick_y'] = str(round(0.2 * math.sin(angle + 0.5), 3))

    # Rebuild all clones
    rep.par.recreateall.pulse()

    return f"Master fix applied! user_data={ud.numRows} rows, replicator->select_active"

result = master_fix()
