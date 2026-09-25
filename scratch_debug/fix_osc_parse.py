import td

def fix_osc_again():
    callbacks = op('/project1/tdbridge_test/bridge_osc_callbacks')
    if callbacks:
        callbacks.text = """
def onReceiveOSC(dat, rowIndex, message, bytes, timeStamp, sender, peerAddress, peerPort):
    user_data = op('user_data')
    if not user_data: return
    
    # dat[rowIndex, 0].val is something like "/slot_1_x -0.9435"
    raw_str = dat[rowIndex, 0].val if dat.numCols > 0 else ""
    split_str = raw_str.split(' ')
    if len(split_str) < 2: return
    
    val = split_str[1]
    
    parts = message.split('_')
    if len(parts) >= 3 and parts[0] == '/slot':
        try:
            slot_id = int(parts[1])
            if slot_id < 1: return
            
            channel = "_".join(parts[2:])
            
            if slot_id <= user_data.numRows - 1:
                if channel == 'x':
                    if user_data.col('x'): user_data[slot_id, 'x'] = val
                    if user_data.col('joystick_x'): user_data[slot_id, 'joystick_x'] = val
                elif channel == 'y':
                    if user_data.col('y'): user_data[slot_id, 'y'] = val
                    if user_data.col('joystick_y'): user_data[slot_id, 'joystick_y'] = val
                else:
                    if user_data.col(channel):
                        user_data[slot_id, channel] = val
                        
                import time
                if user_data.col('last_seen'):
                    user_data[slot_id, 'last_seen'] = time.time()
        except Exception as e:
            pass
"""
        return "Callbacks updated to parse value correctly"
    return "Not found"

result = fix_osc_again()
