import td

def fix_osc_dump():
    callbacks = op('/project1/tdbridge_test/bridge_osc_callbacks')
    if callbacks:
        callbacks.text = """
def onReceiveOSC(dat, rowIndex, message, bytes, timeStamp, sender, peerAddress, peerPort):
    debug_dat = op('debug') or op('').create(textDAT, 'debug')
    
    debug_dat.text = "message: " + str(message) + "\\n"
    debug_dat.text += "rowIndex: " + str(rowIndex) + "\\n"
    debug_dat.text += "dat content: " + str(dat[rowIndex, 0].val if dat.numCols > 0 else "None") + "\\n"
    if dat.numCols > 1:
        debug_dat.text += "col1: " + str(dat[rowIndex, 1].val) + "\\n"
    debug_dat.text += "numCols: " + str(dat.numCols) + "\\n"
    
"""
        return "Callbacks updated to dump!"
    return "Not found"

result = fix_osc_dump()
