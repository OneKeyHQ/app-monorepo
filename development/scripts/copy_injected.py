import os
import shutil

def copy_file(src, dest):
    if os.path.exists(src):
        print(f"Copying {src} to {dest}")
        shutil.copy(src, dest)
    else:
        print(f"Source file {src} does not exist.")

def copy_injected():
    # Copy to Desktop preload.js
    copy_file("node_modules/@onekeyfe/cross-inpage-provider-injected/dist/injected/injectedDesktop.js", 
              "apps/desktop/public/static/preload.js")

    # Copy to Extension injected.js
    copy_file("node_modules/@onekeyfe/cross-inpage-provider-injected/dist/injected/injectedExtension.js", 
              "apps/ext/src/entry/injected.js")
    copy_file("apps/ext/src/entry/injected.js", "apps/ext/src/entry/injected.text-js")

    # Copy to Native injectedCode
    copy_file("node_modules/@onekeyfe/cross-inpage-provider-injected/dist/injected/injectedNative.js", 
              "packages/kit/src/components/WebView/injectedNative.text-js")

    # Copy index html
    copy_file("packages/shared/src/web/index.html.ejs", 
              "packages/shared/src/web/index.html")

    # Create directory for js-sdk if it doesn't exist
    js_sdk_path = "apps/desktop/public/static/js-sdk/"
    if not os.path.exists(js_sdk_path):
        print(f"Creating directory: {js_sdk_path}")
        os.makedirs(js_sdk_path)

    # Copy hardware js-sdk iframe files to desktop
    src_js_sdk = "node_modules/@onekeyfe/hd-web-sdk/build/"
    dest_js_sdk = "apps/desktop/public/static/js-sdk/"
    if os.path.exists(src_js_sdk):
        print(f"Copying {src_js_sdk} to {dest_js_sdk}")
        shutil.copytree(src_js_sdk, dest_js_sdk, dirs_exist_ok=True)
    else:
        print(f"Source directory {src_js_sdk} does not exist.")

    # Build and copy web-embed
    base_dir = os.path.dirname(os.path.realpath(__file__))
    print(f"Running web-embed.js in {base_dir}")
    os.system(f"node {os.path.join(base_dir, 'web-embed.js')}")

if __name__ == "__main__":
    copy_injected()
    print("Injected files copied.")
