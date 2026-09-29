import td

def fix_osc_blind():
    callbacks = op('/project1/tdbridge_test/bridge_osc_callbacks')
    if callbacks:
        callbacks.text = """
def onReceiveOSC(dat, rowIndex, message, bytes, timeStamp, sender, peerAddress, peerPort):
    try:
        raw_str = dat[rowIndex, 0].val if dat.numCols > 0 else ""
        split_str = raw_str.split(' ')
        if len(split_str) < 2: 
            return
            
        val = " ".join(split_str[1:])
        parts = message.split('_')
        
        if len(parts) >= 3 and parts[0] == '/slot':
            slot_id = int(parts[1])
            if slot_id < 1 or slot_id > 100: return
            
            channel = "_".join(parts[2:])
            ud = op('/project1/tdbridge_test/user_data')
            
            if channel == 'x':
                ud[slot_id, 'x'] = val
                ud[slot_id, 'joystick_x'] = val
            elif channel == 'y':
                ud[slot_id, 'y'] = val
                ud[slot_id, 'joystick_y'] = val
            elif channel == 'active':
                if val == '0' or val == '0.0':
                    ud[slot_id, 'active'] = '0'
                    ud[slot_id, 'name'] = ''
                else:
                    ud[slot_id, 'active'] = '1'
            else:
                # Blindly write to the column if we know it exists (it does)
                try:
                    ud[slot_id, channel] = val
                except: pass
                
    except Exception as e:
        pass
"""
        return "Callbacks updated to blind write!"
    return "Not found"

result = fix_osc_blind()
