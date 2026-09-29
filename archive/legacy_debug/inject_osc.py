import td

def setup_osc():
    parent_comp = op('/project1/tdbridge_test')
    
    # Clean up old nodes if any
    if parent_comp.op('bridge_osc_in'):
        parent_comp.op('bridge_osc_in').destroy()
    if parent_comp.op('bridge_osc_callbacks'):
        parent_comp.op('bridge_osc_callbacks').destroy()

    # Create OSC In DAT
    osc_in = parent_comp.create(oscinDAT, 'bridge_osc_in')
    osc_in.par.port = 9000
    osc_in.nodeX = -600
    osc_in.nodeY = -200

    # Create Callbacks DAT
    callbacks = parent_comp.create(textDAT, 'bridge_osc_callbacks')
    callbacks.nodeX = -400
    callbacks.nodeY = -200
    
    callbacks.text = """
def onReceiveOSC(dat, rowIndex, message, bytes, timeStamp, sender, peerAddress, peerPort):
    user_data = op('user_data')
    if not user_data: return
    
    # message is like /slot_1_name or /slot_1_x
    parts = message.split('_')
    if len(parts) >= 3 and parts[0] == '/slot':
        try:
            slot_id = int(parts[1])
            channel = "_".join(parts[2:])
            
            # The value is in the second column of the received row
            val = dat[rowIndex, 1].val
            
            # Row 1 is slot 1, row 2 is slot 2, etc. (Since row 0 is header)
            if slot_id <= user_data.numRows - 1:
                # If channel is 'x', map to 'joystick_x' or 'x'?
                # Wait, earlier user_data had 'x', 'y', 'joystick_x', 'joystick_y'. Let's write to both just in case.
                if channel == 'x':
                    if user_data.col('x'): user_data[slot_id, 'x'] = val
                    if user_data.col('joystick_x'): user_data[slot_id, 'joystick_x'] = val
                elif channel == 'y':
                    if user_data.col('y'): user_data[slot_id, 'y'] = val
                    if user_data.col('joystick_y'): user_data[slot_id, 'joystick_y'] = val
                else:
                    if user_data.col(channel):
                        user_data[slot_id, channel] = val
                        
                # Update last_seen
                import time
                if user_data.col('last_seen'):
                    user_data[slot_id, 'last_seen'] = time.time()
        except Exception as e:
            print("OSC error:", e)
"""
    
    # Hook them up
    osc_in.par.callbacks = callbacks.name
    return "OSC In successfully created and linked to user_data"

result = setup_osc()
