import td

def setup_osc():
    parent_comp = op('/project1/tdbridge_test')
    
    if parent_comp.op('bridge_osc_in'):
        parent_comp.op('bridge_osc_in').destroy()
    if parent_comp.op('bridge_osc_callbacks'):
        parent_comp.op('bridge_osc_callbacks').destroy()

    osc_in = parent_comp.create(oscinDAT, 'bridge_osc_in')
    osc_in.par.port = 9000
    osc_in.nodeX = -600
    osc_in.nodeY = -200

    callbacks = parent_comp.create(textDAT, 'bridge_osc_callbacks')
    callbacks.nodeX = -400
    callbacks.nodeY = -200
    
    callbacks.text = """
def onReceiveOSC(dat, rowIndex, message, bytes, timeStamp, sender, peerAddress, peerPort):
    user_data = op('user_data')
    if not user_data: return
    
    parts = message.split('_')
    if len(parts) >= 3 and parts[0] == '/slot':
        try:
            slot_id = int(parts[1])
            
            # SAFEGUARD: Never overwrite the header row
            if slot_id < 1: return
            
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
    osc_in.par.callbacks = callbacks.name
    return "OSC In successfully created and linked safely"

result = setup_osc()
