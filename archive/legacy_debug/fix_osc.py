import td

def fix_osc():
    parent_comp = op('/project1/tdbridge_test')
    if parent_comp.op('bridge_osc_callbacks'):
        callbacks = parent_comp.op('bridge_osc_callbacks')
        callbacks.text = """
def onReceiveOSC(dat, rowIndex, message, bytes, timeStamp, sender, peerAddress, peerPort):
    user_data = op('user_data')
    if not user_data: return
    
    parts = message.split('_')
    if len(parts) >= 3 and parts[0] == '/slot':
        try:
            slot_id = int(parts[1])
            # DONT OVERWRITE HEADER ROW 0
            if slot_id < 1: 
                return
                
            channel = "_".join(parts[2:])
            val = dat[rowIndex, 1].val
            
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
        return "Fixed callbacks"
    return "Not found"

try:
    print(fix_osc())
except:
    pass

# ALSO FIX THE HEADER IF IT WAS CORRUPTED
def fix_header():
    user_data = op('/project1/tdbridge_test/user_data')
    if user_data and user_data.numRows > 0:
        header = ["client", "name", "x", "y", "color_h", "r", "g", "b", "rotate_vis", "action1", "action2", "slider1", "", "last_seen", "joystick_x", "joystick_y"]
        for i, h in enumerate(header):
            if i < user_data.numCols:
                user_data[0, i] = h
        return "Fixed header"
try:
    print(fix_header())
except:
    pass
