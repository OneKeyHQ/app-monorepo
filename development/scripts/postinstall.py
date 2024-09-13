import os
import shutil

def postinstall():
    # Run yarn setup:env
    print("Running yarn setup:env...")
    os.system("yarn setup:env")

    # Run patch-package
    print("Running patch-package...")
    os.system("patch-package")

    # Run yarn copy:inject
    print("Running yarn copy:inject...")
    os.system("yarn copy:inject")

    # Remove realm-flipper-plugin-device src directory
    realm_path = "node_modules/realm-flipper-plugin-device/src"
    if os.path.exists(realm_path):
        print(f"Removing directory: {realm_path}")
        shutil.rmtree(realm_path)

if __name__ == "__main__":
    postinstall()
    print("Post-installation steps completed.")
