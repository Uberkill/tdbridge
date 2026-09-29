import td

def fix_osc_dynamic():
    callbacks = op('/project1/tdbridge_test/bridge_osc_callbacks')
    if callbacks:
        callbacks.text = """
def onReceiveOSC(dat, rowIndex, message, bytes, timeStamp, sender, peerAddress, peerPort):
    user_data = op('user_data')
    if not user_data: return
    
    try:
        raw_str = dat[rowIndex, 0].val if dat.numCols > 0 else ""
        split_str = raw_str.split(' ')
        if len(split_str) < 2: 
            return
            
        val = " ".join(split_str[1:])
        parts = message.split('_')
        
        if len(parts) >= 3 and parts[0] == '/slot':
            slot_id = int(parts[1])
            if slot_id < 1: return
            
            channel = "_".join(parts[2:])
            
            # Dynamically add rows (delayed to avoid cook loop)
            if user_data.numRows <= slot_id:
                script = f"op('user_data').appendRow(['slot_{slot_id}'] + ['0' if c in ['x', 'y', 'joystick_x', 'joystick_y', 'action1', 'action2', 'slider1', 'active', 'color_h', 'r', 'g', 'b', 'rotate_vis'] else '' for c in [op('user_data')[0, i].val for i in range(1, op('user_data').numCols)]])"
                while user_data.numRows <= slot_id:
                    # Append a blank placeholder instantly to prevent index errors this frame
                    user_data.appendRow([f"slot_{user_data.numRows}"] + [""] * (user_data.numCols - 1))
                    run(script, delayFrames=1)
            
            if channel == 'x':
                if user_data.col('x'): user_data[slot_id, 'x'] = val
                if user_data.col('joystick_x'): user_data[slot_id, 'joystick_x'] = val
            elif channel == 'y':
                if user_data.col('y'): user_data[slot_id, 'y'] = val
                if user_data.col('joystick_y'): user_data[slot_id, 'joystick_y'] = val
            elif channel == 'active':
                if val == '0' or val == '0.0':
                    # Delete row (delayed to avoid cook loop)
                    run(f"op('user_data').deleteRow({slot_id})", delayFrames=1)
            else:
                if user_data.col(channel):
                    user_data[slot_id, channel] = val
                    
            import time
            if user_data.col('last_seen'):
                user_data[slot_id, 'last_seen'] = time.time()
                
    except Exception as e:
        pass
"""
        return "Callbacks updated to dynamic!"
    return "Not found"

result = fix_osc_dynamic()
