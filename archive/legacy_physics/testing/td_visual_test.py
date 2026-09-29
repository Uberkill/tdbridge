# td_visual_test.py
# ----------------------------------------------------
# 1. Copy this code.
# 2. In TouchDesigner, double-click to add a "Text DAT".
# 3. Paste this code inside the Text DAT.
# 4. Right-click the Text DAT and select "Run Script".
# ----------------------------------------------------
# WARNING: This will delete existing nodes in the current component to build the test environment!

def build_visual_test():
    c = parent()
    
    # 1. Clean up existing nodes (so you can run it multiple times safely)
    for child in c.findChildren(depth=1):
        if child != me:
            child.destroy()
            
    # 2. Data Intake (Port 9000)
    # CHOP for Joystick Numbers (Float)
    osc_chop = c.create(oscInCHOP, 'osc_chop')
    osc_chop.par.port = 9000
    osc_chop.nodeX = 0; osc_chop.nodeY = 100
    
    # DAT for Names and Room Codes (String)
    osc_dat = c.create(oscInDAT, 'osc_dat')
    osc_dat.par.port = 9000
    osc_dat.nodeX = 0; osc_dat.nodeY = -100
    
    # 3. Extract Player 1 X/Y
    sel = c.create(selectCHOP, 'player1_xy')
    sel.par.channames = 'slot_1_x slot_1_y'
    sel.inputConnectors[0].connect(osc_chop)
    sel.nodeX = 200; sel.nodeY = 100
    
    lag = c.create(lagCHOP, 'smooth')
    lag.inputConnectors[0].connect(sel)
    lag.par.lag1 = 0.1 # 100ms lag for silky smooth movement
    lag.nodeX = 400; lag.nodeY = 100
    
    # 4. Visuals: Background and Player Avatar
    bg = c.create(constantTOP, 'bg')
    bg.par.colorr = 0.1; bg.par.colorg = 0.1; bg.par.colorb = 0.1
    bg.par.resolutionw = 1280; bg.par.resolutionh = 720
    bg.nodeX = 200; bg.nodeY = 400
    
    circle = c.create(circleTOP, 'player1_avatar')
    circle.par.resolutionw = 1280; circle.par.resolutionh = 720
    circle.par.radiusx = 0.05; circle.par.radiusy = 0.05
    circle.par.colorr = 0.2; circle.par.colorg = 0.8; circle.par.colorb = 0.4
    circle.nodeX = 400; circle.nodeY = 400
    
    # Drive circle position dynamically with CHOP data
    circle.par.centerx.expr = "op('smooth')['slot_1_x']"
    circle.par.centery.expr = "op('smooth')['slot_1_y']"
    
    comp = c.create(compositeTOP, 'render')
    comp.par.operand = 1 # Over
    comp.inputConnectors[0].connect(bg)
    comp.inputConnectors[1].connect(circle)
    comp.nodeX = 600; comp.nodeY = 400
    
    # 5. Display the Active Room Code from Node.js
    room_text = c.create(textTOP, 'room_code_display')
    room_text.par.resolutionw = 1280; room_text.par.resolutionh = 720
    room_text.par.fontsize = 60
    room_text.par.fontalpha = 0.5
    room_text.par.alignx = 0 # Left align
    room_text.par.aligny = 2 # Top align
    room_text.par.position1 = -0.45
    room_text.par.position2 = 0.45
    # Read the string directly from the OSC In DAT row!
    room_text.par.text.expr = "'ROOM CODE: ' + (op('osc_dat')['/slot_0_room_code', 1].val if op('osc_dat')['/slot_0_room_code', 1] else 'Waiting for Node Server...')"
    room_text.nodeX = 400; room_text.nodeY = -100
    
    comp2 = c.create(compositeTOP, 'final_out')
    comp2.par.operand = 1
    comp2.inputConnectors[0].connect(comp)
    comp2.inputConnectors[1].connect(room_text)
    comp2.nodeX = 800; comp2.nodeY = 400
    
    out = c.create(outTOP, 'out1')
    out.inputConnectors[0].connect(comp2)
    out.nodeX = 1000; out.nodeY = 400
    
    # Turn on background display
    out.display = True
    print("Visual Test Environment Built successfully!")

build_visual_test()
