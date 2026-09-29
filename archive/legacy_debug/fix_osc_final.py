import td

def fix_osc_final():
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
            
            client_str = f"slot_{slot_id}"
            channel = "_".join(parts[2:])
            
            # Find row
            target_row = None
            cell = user_data.findCell(client_str, cols=['client'])
            if cell:
                target_row = cell[0].row
            
            if channel == 'active':
                if val == '0' or val == '0.0':
                    # Disconnect -> Delete row
                    if target_row is not None:
                        script = f"op('user_data').deleteRow({target_row})"
                        run(script, delayFrames=1)
                    return
                else:
                    # Connect -> Add row if missing
                    if target_row is None:
                        script = f"op('user_data').appendRow(['{client_str}'] + ['0' if c in ['x', 'y', 'joystick_x', 'joystick_y', 'action1', 'action2', 'slider1', 'active', 'color_h', 'r', 'g', 'b', 'rotate_vis'] else '' for c in [op('user_data')[0, i].val for i in range(1, op('user_data').numCols)]])"
                        run(script, delayFrames=1)
                    return
            
            # If row doesn't exist yet, we can't update it this frame
            if target_row is None:
                return
                
            if channel == 'x':
                if user_data.col('x'): user_data[target_row, 'x'] = val
                if user_data.col('joystick_x'): user_data[target_row, 'joystick_x'] = val
            elif channel == 'y':
                if user_data.col('y'): user_data[target_row, 'y'] = val
                if user_data.col('joystick_y'): user_data[target_row, 'joystick_y'] = val
            else:
                if user_data.col(channel):
                    user_data[target_row, channel] = val
                    
            import time
            if user_data.col('last_seen'):
                user_data[target_row, 'last_seen'] = time.time()
                
    except Exception as e:
        pass
"""
        return "Callbacks updated to findCell!"
    return "Not found"

result = fix_osc_final()
