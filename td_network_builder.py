# td_network_builder.py
# ----------------------------------------------------
# How to use:
# 1. Create a Text DAT in your TouchDesigner network.
# 2. Paste this code inside.
# 3. Right-click the Text DAT and select "Run Script".
# ----------------------------------------------------

def build_network():
    target_comp = parent()
    
    # 1. Create OSC In CHOP
    osc_in = target_comp.create(oscInCHOP, 'osc_in_bridge')
    osc_in.par.port = 9000
    osc_in.nodeX = 0
    osc_in.nodeY = 0

    # 2. Create Lag CHOP for 60Hz Smoothing
    lag = target_comp.create(lagCHOP, 'smooth_movement')
    lag.inputConnectors[0].connect(osc_in)
    lag.par.lag1 = 0.1 # 100ms smoothing (adjust based on network latency)
    lag.nodeX = 200
    lag.nodeY = 0

    # 3. Create Slope CHOP (Detect Ghost users)
    slope = target_comp.create(slopeCHOP, 'movement_detector')
    slope.inputConnectors[0].connect(osc_in)
    slope.nodeX = 200
    slope.nodeY = -150

    # 4. Create Logic CHOP (Fades out users who stop moving for 2 seconds)
    logic = target_comp.create(logicCHOP, 'is_active')
    logic.inputConnectors[0].connect(slope)
    logic.par.convert = 1 # Off when zero
    logic.nodeX = 400
    logic.nodeY = -150

    # 5. Create Filter CHOP (Smoothly fade scale to 0)
    fade = target_comp.create(filterCHOP, 'fade_inactive')
    fade.inputConnectors[0].connect(logic)
    fade.par.type = 1 # Box
    fade.par.width = 1.0 # 1 second fade
    fade.nodeX = 600
    fade.nodeY = -150

    print("Multi-User Network generated! Wire the Lag CHOP into your Instancing Translate parameters, and the Filter CHOP into your Scale parameters.")

build_network()
