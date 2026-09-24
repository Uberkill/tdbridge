import td

comp = op('/project1/tdbridge_test')

# 1. Delete Trash Nodes
trash = ['over1', 'over2', 'over3', 'coords', 'smooth', 'buttons', 'red_dot', 'rgbkey1', 'dummy_bg', 'name_tag', 'rotate_math', 'rotate_speed', 'player1_xy']
for t in trash:
    n = comp.op(t)
    if n:
        n.destroy()

# 2. Add generate_room_code if missing
if not comp.op('generate_room_code'):
    exec_dat = comp.create(executeDAT, 'generate_room_code')
    code = """def onStart():
\timport random
\timport string
\tcode = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
\top('room_code_dat').text = code
"""
    exec_dat.text = code
    exec_dat.par.start = True

# 3. Create Network Annotations & Organize

# Delete old annotations
for a in comp.findChildren(type=annotateCOMP):
    a.destroy()

def create_box(name, label, color, x, y, width, height, nodes):
    anno = comp.create(annotateCOMP, name)
    anno.nodeX = x
    anno.nodeY = y
    anno.nodeWidth = width
    anno.nodeHeight = height
    anno.par.Titletext = label
    anno.par.Titleheight = 40
    anno.par.Backcolorr = color[0]
    anno.par.Backcolorg = color[1]
    anno.par.Backcolorb = color[2]
    
    # Position nodes inside
    curr_x = x + 50
    curr_y = y + height - 100
    for i, n_name in enumerate(nodes):
        node = comp.op(n_name)
        if node:
            node.nodeX = curr_x
            node.nodeY = curr_y
            curr_x += 200
            if (i+1) % 2 == 0:
                curr_x = x + 50
                curr_y -= 150

# SERVER SETUP
server_nodes = ['web_server', 'web_server_callbacks', 'generate_room_code', 'room_code_dat']
create_box('anno_server', '1. WEB SERVER & ROOM', (0.2, 0.4, 0.8), 0, 0, 500, 400, server_nodes)

# UI CONFIG
ui_nodes = ['ui_config']
create_box('anno_ui', '2. UI DESIGNER (Blueprint)', (0.8, 0.3, 0.2), 600, 0, 400, 400, ui_nodes)
comp.op('ui_config').nodeX = 650
comp.op('ui_config').nodeY = 250

# DATABASE
db_nodes = ['user_data', 'replicator', 'player_master']
create_box('anno_db', '3. PLAYERS & DATABASE', (0.2, 0.8, 0.4), 1100, 0, 500, 400, db_nodes)

# RENDERING
render_nodes = ['bg', 'all_players', 'out1']
create_box('anno_render', '4. VISUAL RENDERING', (0.7, 0.2, 0.7), 1700, 0, 600, 400, render_nodes)

# Align render nodes specifically
comp.op('bg').nodeX = 1750
comp.op('bg').nodeY = 150
comp.op('all_players').nodeX = 1950
comp.op('all_players').nodeY = 150
comp.op('out1').nodeX = 2150
comp.op('out1').nodeY = 150

# Clean up dynamically created replicas from view
for child in comp.children:
    if child.name.startswith('item') and child.name != 'item1':
        child.nodeX = 1150
        child.nodeY = -200

# Re-link the output properly just in case
comp.op('out1').inputConnectors[0].connect(comp.op('all_players'))

# SAVE TO GIT REPO
repo_path = 'C:/Users/oob/.gemini/antigravity/scratch/TDBridge/'
comp.save(repo_path + 'TDBridge.tox')
project.save(repo_path + 'testing.toe')

print("Cleanup, organization, and export complete.")
