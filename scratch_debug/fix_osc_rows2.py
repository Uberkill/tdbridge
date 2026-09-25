import td

def fix_osc_rows2():
    callbacks = op('/project1/tdbridge_test/bridge_osc_callbacks')
    if callbacks:
        callbacks.text = """
def onReceiveOSC(dat, rowIndex, message, bytes, timeStamp, sender, peerAddress, peerPort):
    user_data = op('user_data')
    if not user_data: return
    
    raw_str = dat[rowIndex, 0].val if dat.numCols > 0 else ""
    split_str = raw_str.split(' ')
    if len(split_str) < 2: return
    
    val = " ".join(split_str[1:])
    
    parts = message.split('_')
    if len(parts) >= 3 and parts[0] == '/slot':
        try:
            slot_id = int(parts[1])
            if slot_id < 1: return
            
            channel = "_".join(parts[2:])
            
            # dynamically expand rows if needed
            while user_data.numRows <= slot_id:
                new_row = [f"slot_{user_data.numRows}"]
                for i in range(1, user_data.numCols):
                    col_name = user_data[0, i].val
                    if col_name in ['x', 'y', 'joystick_x', 'joystick_y', 'action1', 'action2', 'slider1', 'active', 'color_h', 'r', 'g', 'b']:
                        new_row.append("0")
                    else:
                        new_row.append("")
                user_data.appendRow(new_row)
            
            if channel == 'x':
                if user_data.col('x'): user_data[slot_id, 'x'] = val
                if user_data.col('joystick_x'): user_data[slot_id, 'joystick_x'] = val
            elif channel == 'y':
                if user_data.col('y'): user_data[slot_id, 'y'] = val
                if user_data.col('joystick_y'): user_data[slot_id, 'joystick_y'] = val
            elif channel == 'active':
                if val == '0' or val == '0.0':
                    if user_data.col('name'): user_data[slot_id, 'name'] = ""
            else:
                if user_data.col(channel):
                    user_data[slot_id, channel] = val
                    
            import time
            if user_data.col('last_seen'):
                user_data[slot_id, 'last_seen'] = time.time()
        except Exception as e:
            pass
"""
        return "Callbacks updated to initialize 0s!"
    return "Not found"

result = fix_osc_rows2()
