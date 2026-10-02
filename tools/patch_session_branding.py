import os
import shutil
import subprocess

BASE_DIR = r"C:\Users\oob\.gemini\antigravity\scratch\TDBridge"
TOE_DIR = os.path.join(BASE_DIR, "TDBridge.toe.dir")
TOX_DIR = os.path.join(BASE_DIR, "TDBridge.tox.dir")
COLLAPSE_EXE = r"C:\Program Files\Derivative\TouchDesigner\bin\toecollapse.exe"

def patch_cparm(filepath):
    print(f"Patching cparm: {filepath}")
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    if "Sessionname" not in content:
        lines = [line for line in content.strip().split("\n") if line.strip()]
        new_param = '772804868 Sessionname "Session Name" 1 1 0 0 1 1 1 2 0 "" "" TDBridge 20'
        if lines[-1].strip() == "?":
            lines.insert(-1, new_param)
        else:
            lines.append(new_param)
        new_content = "\n".join(lines) + "\n"
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        print("  Added Sessionname parameter.")
    else:
        print("  Sessionname parameter already present.")

def patch_parm(filepath):
    print(f"Patching parm: {filepath}")
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    if "Sessionname" not in content:
        lines = [line for line in content.strip().split("\n") if line.strip()]
        new_param = 'Sessionname 67109184 "MAIN STAGE"'
        if lines[-1].strip() == "?":
            lines.insert(-1, new_param)
        else:
            lines.append(new_param)
        new_content = "\n".join(lines) + "\n"
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        print("  Updated Sessionname in parm.")
    else:
        print("  Sessionname parameter already present in parm.")

def patch_telemetry_exec(filepath):
    print(f"Patching telemetry_exec: {filepath}")
    with open(filepath, "rb") as f:
        data = f.read()
    text = data.decode("utf-8", errors="ignore")
    
    snippet = "            sess_par = getattr(parent().par, 'Sessionname', None)\n            sess_name = str(sess_par.eval() if sess_par else 'MAIN STAGE').strip()\n            if sess_name:\n                osc_out.sendOSC('/td/session_name', [sess_name])\n"
    
    if "Sessionname" not in text:
        target = "if frame % 60 == 0 and osc_out:\n        try:\n"
        if target in text:
            text = text.replace(target, target + snippet, 1)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(text)
            print("  Added Sessionname sync to telemetry_exec.")
        else:
            print("  Target anchor not found in telemetry_exec!")
    else:
        print("  Sessionname sync already present in telemetry_exec.")

def patch_param_exec(filepath):
    print(f"Patching param_exec: {filepath}")
    with open(filepath, "rb") as f:
        data = f.read()
    text = data.decode("utf-8", errors="ignore")
    
    # Fix any orphaned elif or syntax issues
    text = text.replace("def onValueChange(par, prev):\n    elif par.name == 'Sessionname':", "def onValueChange(par, prev):\n    if par.name == 'Sessionname':")
    
    # Ensure Sessionname handler exists
    if "par.name == 'Sessionname'" not in text:
        snippet = "def onValueChange(par, prev):\n    if par.name == 'Sessionname':\n        sname = str(par.val).strip()\n        try:\n            op('bridge_osc_out').sendOSC('/td/session_name', [sname])\n        except Exception:\n            pass\n"
        text = text.replace("def onValueChange(par, prev):\n", snippet)
        print("  Inserted Sessionname handler.")
    else:
        print("  Sessionname handler already present.")
        
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(text)
    print("  Cleaned param_exec syntax.")

def patch_qr_display(filepath):
    print(f"Patching qr_display: {filepath}")
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        text = f.read()
    
    target = "[+] TDBRIDGE RELAY ONLINE"
    replacement = "[+] ''' + str(parent().par.Sessionname.eval() if hasattr(parent().par, 'Sessionname') and parent().par.Sessionname.eval() else 'TDBRIDGE').upper() + ''' RELAY ONLINE"
    if target in text:
        text = text.replace(target, replacement, 1)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(text)
        print("  Updated dynamic session name in qr_display.")
    else:
        print("  qr_display already updated.")

def sync_to_tox():
    print("Syncing updated files from toe.dir to tox.dir...")
    src_comp = os.path.join(TOE_DIR, "project1", "TDBridge")
    dst_comp = os.path.join(TOX_DIR, "TDBridge")
    
    if not os.path.exists(dst_comp):
        os.makedirs(dst_comp, exist_ok=True)
        
    for item in os.listdir(src_comp):
        src_file = os.path.join(src_comp, item)
        dst_file = os.path.join(dst_comp, item)
        if os.path.isfile(src_file):
            shutil.copy2(src_file, dst_file)
            
    shutil.copy2(os.path.join(TOE_DIR, "project1", "TDBridge.cparm"), os.path.join(TOX_DIR, "TDBridge.cparm"))
    shutil.copy2(os.path.join(TOE_DIR, "project1", "TDBridge.parm"), os.path.join(TOX_DIR, "TDBridge.parm"))
    print("  Sync to tox.dir completed.")

def main():
    print("=== Patching TouchDesigner Session Branding ===")
    patch_cparm(os.path.join(TOE_DIR, "project1", "TDBridge.cparm"))
    patch_parm(os.path.join(TOE_DIR, "project1", "TDBridge.parm"))
    patch_telemetry_exec(os.path.join(TOE_DIR, "project1", "TDBridge", "telemetry_exec.text"))
    patch_param_exec(os.path.join(TOE_DIR, "project1", "TDBridge", "param_exec.text"))
    patch_qr_display(os.path.join(TOE_DIR, "project1", "TDBridge", "qr_display.parm"))
    
    sync_to_tox()
    
    print("Collapsing TDBridge.toe...")
    res1 = subprocess.run([COLLAPSE_EXE, "TDBridge.toe"], cwd=BASE_DIR, capture_output=True, text=True)
    print("  toecollapse output:", res1.stdout.strip())
    
    print("Collapsing TDBridge.tox...")
    res2 = subprocess.run([COLLAPSE_EXE, "TDBridge.tox"], cwd=BASE_DIR, capture_output=True, text=True)
    print("  toecollapse output:", res2.stdout.strip())
    
    core_tox = os.path.join(BASE_DIR, "core", "TDBridge.tox")
    if os.path.exists(os.path.dirname(core_tox)):
        shutil.copy2(os.path.join(BASE_DIR, "TDBridge.tox"), core_tox)
        print("  Copied updated tox to core/TDBridge.tox")
        
    print("=== TouchDesigner Patch Complete ===")

if __name__ == "__main__":
    main()
