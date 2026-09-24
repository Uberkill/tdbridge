# TouchDesigner Replicator Guide: Spawning Characters

Based on the screenshot you sent, you are looking at the exact prototype network before I ran the massive cleanup script! You are currently looking at `testing3.toe`. The cleaned-up version is inside `testing.toe` in the Git repository, but the core mechanics are exactly the same. 

Here is the step-by-step breakdown of how TouchDesigner spawns and controls characters, and how you can replace the triangle with your own 3D creature.

---

## 1. The Database (`user_data` Table)
In the bottom right of your screenshot, there is a Table DAT called `user_data`. 
Think of this as the **Guest List**. Every time a phone connects via WebSockets, Python adds a new row to this spreadsheet. It stores their Name, X/Y joystick coordinates, and button states.

## 2. The Blueprint (`player_master` Base COMP)
Look at the node named `player_master`. 
Think of this as the **DNA** or the **Blueprint** for a character. 
Right now, if you double-click and go inside `player_master`, you will see a simple 2D Triangle (Circle TOP) and a Text TOP for the name. 

**How to change the character:**
You do NOT change the character out here in the main network. You go *inside* `player_master`. You can delete the 2D triangle and drop in an FBX 3D model of your creature, a Render TOP, a Camera, and a Light. As long as the final output inside `player_master` is wired to an `Out TOP` named `out1`, the system will use your 3D creature instead of the triangle!

## 3. The Factory (`replicator` COMP)
Look at the `replicator` node. 
This is the **Clone Factory**. It does two things:
1. It constantly watches the `user_data` Guest List.
2. It looks at the `player_master` Blueprint.

If 10 phones connect, the `user_data` table gets 10 rows. The Replicator instantly says *"I need 10 players!"* and it magically generates 10 exact clones of `player_master`.

## 4. The Characters (`item1`, `item2`, etc.)
In your screenshot, you see `item1`. 
**Yes, `item1` is the actual spawned character for Player 1.**
If Player 2 joins, a new box named `item2` will instantly pop into existence on your screen.

**Crucial Rule:**
Never, ever manually edit `item1`. If you try to go inside `item1` and change the color, the moment a new user joins, the Replicator will delete your changes and overwrite `item1` using the `player_master` blueprint. **Always make your changes inside `player_master`.**

## 5. The Output (`all_players` Composite TOP)
As the Replicator generates `item1`, `item2`, `item3`, it triggers a Python script (`replicator_callbacks`). 
This script takes the video output from every single `item` box and automatically wires it into the `all_players` Composite TOP. The Composite TOP simply stacks all the video layers on top of each other (using an 'Over' operation) so you can see all 10 creatures running around on the screen at the same time.

---

### Summary for your workflow:
If you want to swap the triangle for your creature:
1. Double-click to go inside `player_master`.
2. Delete the Circle TOP.
3. Drop your Creature graphics/models inside. 
4. Read the user's Joystick X/Y data using a `Select DAT` pointed at `../user_data`, just like the triangle did.
5. Wire your Creature's final render into the `out1` node.
6. The moment you step back out, the Replicator will update `item1` to be your creature!
