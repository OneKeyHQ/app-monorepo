import os
import shutil
import platform

def remove_dir(path):
    if os.path.exists(path):
        print(f"Removing directory: {path}")
        shutil.rmtree(path)

def remove_file(path):
    if os.path.exists(path):
        print(f"Removing file: {path}")
        os.remove(path)

def clean_workspace():
    # Clean yarn cache
    print("Cleaning yarn cache...")
    os.system("yarn cache clean")

    # Root directory cleanup
    remove_dir("node_modules")
    remove_dir(".expo")
    remove_dir(".husky/_")
    remove_dir(".app-mono-ts-cache")

    # Desktop cleanup
    remove_dir("apps/desktop/node_modules")
    remove_dir("apps/desktop/.expo")
    remove_dir("apps/desktop/__generated__")
    remove_dir("apps/desktop/dist")
    remove_dir("apps/desktop/build")
    remove_dir("apps/desktop/build-electron")
    remove_dir("apps/desktop/public/static/js-sdk")
    remove_dir("apps/desktop/public/static/connect")
    remove_file("apps/desktop/public/static/preload.js")

    # Ext cleanup
    remove_dir("apps/ext/node_modules")
    remove_dir("apps/ext/.expo")
    remove_dir("apps/ext/build")
    remove_file("apps/ext/src/entry/injected.js")
    remove_file("apps/ext/src/entry/injected.text-js")

    # Mobile cleanup
    remove_dir("apps/mobile/node_modules")
    remove_dir("apps/mobile/.expo")
    remove_dir("apps/mobile/__generated__")
    remove_dir("apps/mobile/ios/Pods")
    remove_dir("apps/mobile/ios/build")
    remove_dir("apps/mobile/ios/OneKeyWallet/web-embed")
    remove_dir("apps/mobile/ios/OneKeyWallet.xcworkspace/xcuserdata")
    remove_dir("apps/mobile/src/public/static/connect")
    remove_dir("apps/mobile/android/.gradle")
    remove_dir("apps/mobile/android/build")
    remove_dir("apps/mobile/android/app/build")
    remove_dir("apps/mobile/android/lib-keys-secret/build")
    remove_dir("apps/mobile/android/lib-keys-secret/.cxx")
    remove_dir("apps/mobile/android/app/src/main/assets/web-embed")

    # Web cleanup
    remove_dir("apps/web/node_modules")
    remove_dir("apps/web/.expo")
    remove_dir("apps/web/__generated__")
    remove_dir("apps/web/dist")
    remove_dir("apps/web/web-build")
    remove_dir("apps/web/.expo-shared")

    # Web-embed cleanup
    remove_dir("apps/web-embed/node_modules")
    remove_dir("apps/web-embed/.expo")
    remove_dir("apps/web-embed/__generated__")
    remove_dir("apps/web-embed/dist")
    remove_dir("apps/web-embed/web-build")
    remove_dir("apps/web-embed/.expo-shared")

    # Package cleanup
    remove_dir("packages/components/node_modules")
    remove_dir("packages/core/node_modules")
    remove_dir("packages/kit/node_modules")
    remove_file("packages/kit/src/components/WebView/injectedNative.text-js")
    remove_dir("packages/kit-bg/node_modules")
    remove_dir("packages/shared/node_modules")
    remove_file("packages/shared/src/web/index.html")

if __name__ == "__main__":
    clean_workspace()
    print("Workspace cleaned.")
