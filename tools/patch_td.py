import os
import shutil
import re
import subprocess

BASE_DIR = r"C:\Users\oob\.gemini\antigravity\scratch\TDBridge"
TOE_DIR = os.path.join(BASE_DIR, "TDBridge.toe.dir")
TOX_DIR = os.path.join(BASE_DIR, "TDBridge.tox.dir")
COLLAPSE_EXE = r"C:\Program Files\Derivative\TouchDesigner\bin\toecollapse.exe"

def patch_cparm(filepath):
    print(f"Patching cparm: {filepath}")
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    if "Mastercode" not in content:
        # Insert before final '?'
        lines = content.strip().split("\n")
        new_lines = []
        for line in lines:
            if line.strip() == "?" and line != lines[0]:
                new_lines.append('772804868 Mastercode "Master Code" 1 1 0 0 1 1 1 2 0 "" "" TDBridge 13')
            new_lines.append(line)
        new_content = "\n".join(new_lines) + "\n"
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        print("  Added Mastercode parameter.")
    else:
        print("  Mastercode parameter already present.")

def patch_parm(filepath):
    print(f"Patching parm: {filepath}")
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    lines = content.strip().split("\n")
    new_lines = []
    has_mastercode = False
    for line in lines:
        if line.startswith("Status "):
            new_lines.append('Status 67109184 "[ONLINE // 60.0 FPS]"')
        elif line.startswith("Mastercode "):
            has_mastercode = True
            new_lines.append(line)
        elif line.strip() == "?" and line != lines[0]:
            if not has_mastercode:
                new_lines.append('Mastercode 67109184 ""')
                has_mastercode = True
            new_lines.append(line)
        else:
            new_lines.append(line)

    new_content = "\n".join(new_lines) + "\n"
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("  Updated Status and Mastercode in parm.")

def patch_osc_processor(filepath):
    print(f"Patching osc_processor: {filepath}")
    with open(filepath, "rb") as f:
        data = f.read()

    code_to_add = (
        b"\n                if addr == '/bridge/master_code':\n"
        b"                    if hasattr(parent().par, 'Mastercode') and val:\n"
        b"                        parent().par.Mastercode = val\n"
        b"                    continue\n"
    )

    if b"'/bridge/master_code'" not in data:
        target = b"parent().par.Roomcode = val\n                    continue\n"
        if target in data:
            data = data.replace(target, target + code_to_add, 1)
            with open(filepath, "wb") as f:
                f.write(data)
            print("  Added /bridge/master_code handler to osc_processor.")
        else:
            print("  Target anchor not found in osc_processor!")
    else:
        print("  /bridge/master_code handler already present.")

def patch_telemetry_exec(filepath):
    print(f"Patching telemetry_exec: {filepath}")
    with open(filepath, "rb") as f:
        data = f.read()

    text = data.decode("utf-8", errors="ignore")
    # Purge green/red emojis
    text = re.sub(r'parent\(\)\.par\.Status\s*=\s*f"[^"]*ONLINE[^"]*"', 'parent().par.Status = f"[ONLINE // {fps} FPS]"', text)
    text = re.sub(r'parent\(\)\.par\.Status\s*=\s*"[^"]*OFFLINE[^"]*"', 'parent().par.Status = "[OFFLINE // LINK DOWN]"', text)
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(text)
    print("  Purged emojis from telemetry_exec.")

def patch_param_exec(filepath):
    print(f"Patching param_exec: {filepath}")
    with open(filepath, "rb") as f:
        data = f.read()

    text = data.decode("utf-8", errors="ignore")
    text = re.sub(r'parent\(\)\.par\.Status\s*=\s*"[^"]*OFFLINE[^"]*"', 'parent().par.Status = "[OFFLINE // LINK DOWN]"', text)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(text)
    print("  Purged emojis from param_exec.")

def patch_readme(filepath):
    if not os.path.exists(filepath):
        return
    print(f"Patching README: {filepath}")
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        text = f.read()
    text = text.replace("🔴 OFFLINE", "[OFFLINE]")
    text = text.replace("🟢 ONLINE (60 FPS)", "[ONLINE // 60.0 FPS]")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(text)
    print("  Purged emojis from README.")

def sync_tox():
    print("Syncing updated files from toe.dir to tox.dir...")
    src_comp = os.path.join(TOE_DIR, "project1", "TDBridge")
    dst_comp = os.path.join(TOX_DIR, "TDBridge")
    
    # Sync individual DATs
    for item in os.listdir(src_comp):
        src_file = os.path.join(src_comp, item)
        dst_file = os.path.join(dst_comp, item)
        if os.path.isfile(src_file):
            shutil.copy2(src_file, dst_file)
            
    # Sync cparm and parm
    shutil.copy2(os.path.join(TOE_DIR, "project1", "TDBridge.cparm"), os.path.join(TOX_DIR, "TDBridge.cparm"))
    shutil.copy2(os.path.join(TOE_DIR, "project1", "TDBridge.parm"), os.path.join(TOX_DIR, "TDBridge.parm"))
    print("  Sync completed.")

def main():
    print("=== Patching TouchDesigner Files ===")
    
    # 1. Patch toe.dir
    patch_cparm(os.path.join(TOE_DIR, "project1", "TDBridge.cparm"))
    patch_parm(os.path.join(TOE_DIR, "project1", "TDBridge.parm"))
    patch_osc_processor(os.path.join(TOE_DIR, "project1", "TDBridge", "osc_processor.text"))
    patch_telemetry_exec(os.path.join(TOE_DIR, "project1", "TDBridge", "telemetry_exec.text"))
    patch_param_exec(os.path.join(TOE_DIR, "project1", "TDBridge", "param_exec.text"))
    patch_readme(os.path.join(TOE_DIR, "project1", "README_HOW_TO_USE.text"))
    
    # 2. Sync to tox.dir
    sync_tox()
    
    # 3. Collapse both toe and tox
    print("Collapsing TDBridge.toe...")
    res1 = subprocess.run([COLLAPSE_EXE, "TDBridge.toe"], cwd=BASE_DIR, capture_output=True, text=True)
    print("  toecollapse output:", res1.stdout.strip())
    
    print("Collapsing TDBridge.tox...")
    res2 = subprocess.run([COLLAPSE_EXE, "TDBridge.tox"], cwd=BASE_DIR, capture_output=True, text=True)
    print("  toecollapse output:", res2.stdout.strip())
    
    # Also update core/TDBridge.tox
    core_tox = os.path.join(BASE_DIR, "core", "TDBridge.tox")
    shutil.copy2(os.path.join(BASE_DIR, "TDBridge.tox"), core_tox)
    print("  Copied updated tox to core/TDBridge.tox")
    
    print("=== Patch Complete ===")

if __name__ == "__main__":
    main()
