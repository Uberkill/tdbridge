import td

comp = op('/project1/tdbridge_test')

# Clean up any existing annotations
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
            if (i+1) % 3 == 0:
                curr_x = x + 50
                curr_y -= 150

# 1. SERVER & SETTINGS
server_nodes = ['web_server', 'web_server_callbacks', 'generate_room_code', 'room_code_dat', 'ui_config']
create_box('anno_server', '1. SERVER & SETTINGS\\nReceives inputs from phones and sets up UI.', (0.2, 0.4, 0.8), 0, 0, 700, 400, server_nodes)

# 2. DATABASE & FACTORY
db_nodes = ['user_data', 'replicator', 'replicator_callbacks', 'player_master']
create_box('anno_db', '2. DATABASE & FACTORY\\nuser_data holds phone data. Replicator clones player_master.', (0.2, 0.8, 0.4), 800, 0, 700, 400, db_nodes)

# 3. RENDERING & COMPOSITING
render_nodes = ['bg', 'dummy_bg', 'all_players', 'rgbkey1', 'room_code_display', 'name_tag', 'over1', 'over2', 'over3', 'out1']
create_box('anno_render', '3. RENDERING & COMPOSITING\\nStacks all clones together and outputs to the screen.', (0.7, 0.2, 0.7), 0, -500, 1500, 450, render_nodes)

# Fix Render Layout manually to preserve flow
comp.op('bg').nodeX = 50; comp.op('bg').nodeY = -250
comp.op('dummy_bg').nodeX = 50; comp.op('dummy_bg').nodeY = -400
comp.op('all_players').nodeX = 300; comp.op('all_players').nodeY = -400
comp.op('rgbkey1').nodeX = 300; comp.op('rgbkey1').nodeY = -250

comp.op('room_code_display').nodeX = 500; comp.op('room_code_display').nodeY = -250
comp.op('name_tag').nodeX = 500; comp.op('name_tag').nodeY = -400

comp.op('over1').nodeX = 750; comp.op('over1').nodeY = -350
comp.op('over2').nodeX = 950; comp.op('over2').nodeY = -350
comp.op('over3').nodeX = 1150; comp.op('over3').nodeY = -350
comp.op('out1').nodeX = 1350; comp.op('out1').nodeY = -350

# Move dynamically created replicas below the replicator
for child in comp.children:
    if child.name.startswith('item'):
        child.nodeX = 1100
        child.nodeY = -50

# 4. ORPHANED PROTOTYPES
proto_nodes = ['coords', 'player1_xy', 'smooth', 'buttons', 'rotate_speed', 'rotate_math', 'red_dot']
create_box('anno_proto', '4. OLD PROTOTYPES (NOT USED)\\nThese were from early testing before Replicators were added.', (0.5, 0.5, 0.5), 0, -1000, 1500, 300, proto_nodes)

project.save('C:/Users/oob/.gemini/antigravity/scratch/TDBridge/testing.3.toe')
print("Organized perfectly without deleting!")
