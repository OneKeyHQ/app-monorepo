#!/usr/bin/env python3
"""Run the production native handler in a dedicated simulator app, never OneKey."""
import argparse
import hashlib
from html.parser import HTMLParser
import base64
import json
from pathlib import Path
import plistlib
import platform
import shutil
import subprocess
import time
import uuid
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
PACKAGE = ROOT / "node_modules/react-native-webview/apple"


def run(*args, timeout=60):
    return subprocess.run(args, check=True, text=True, capture_output=True, timeout=timeout).stdout.strip()


def digest(data):
    return hashlib.sha256(data).hexdigest()


class ScriptParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "script" and values.get("src"):
            self.scripts.append(values)


def verify_artifact(artifact):
    files = {}
    for path in sorted(artifact.rglob("*")):
        if path.is_symlink():
            raise ValueError("Candidate must contain regular files, not symlinks")
        if path.is_file():
            files[path.relative_to(artifact).as_posix()] = digest(path.read_bytes())
    parser = ScriptParser()
    parser.feed((artifact / "index.html").read_text())
    if len(parser.scripts) != 3:
        raise ValueError("Expected the protected WebEmbed's three initial scripts")
    for script in parser.scripts:
        url = urlsplit(script["src"])
        if url.scheme or url.netloc or url.query or url.fragment or ".." in Path(url.path).parts:
            raise ValueError("Initial scripts must reference packaged files")
        path = artifact / url.path.lstrip("/")
        expected = "sha384-" + base64.b64encode(hashlib.sha384(path.read_bytes()).digest()).decode()
        if script.get("integrity") != expected or script.get("crossorigin") != "anonymous":
            raise ValueError("Original HTML must retain exact SHA384 SRI and anonymous crossorigin")
    return files


def state_methods(output):
    source = (PACKAGE / "RNCWebViewImpl.m").read_text()
    names = ["resetOneKeyWebEmbedAfterDestroy", "oneKeyWebEmbedFailClosed", "setOneKeyWebEmbedAssets",
             "setAllowFileAccessFromFileURLs", "setAllowUniversalAccessFromFileURLs", "setSource",
             "setAllowingReadAccessToURL"]
    methods = []
    for name in names:
        prefix = "- (void)" + name
        start = source.index(prefix)
        end = source.index("\n}", start) + 2
        methods.append(source[start:end])
    if source.count("[self resetOneKeyWebEmbedAfterDestroy];") != 1:
        raise ValueError("Production teardown must call the lifecycle transition under test")
    (output / "ProductionStateMethods.inc").write_text("\n\n".join(methods) + "\n")
    fabric = (PACKAGE / "RNCWebView.mm").read_text()
    assignment = "    _view.oneKeyWebEmbedAssets = newViewProps.oneKeyWebEmbedAssets;"
    if fabric.count(assignment) != 1:
        raise ValueError("Fabric must unconditionally reconcile the locked flag after recycling")
    (output / "ProductionFabricProp.inc").write_text(assignment + "\n")
    return digest(source.encode())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--simulator", help="Explicit existing dedicated OneKey LavaMoat simulator UUID")
    parser.add_argument("--runtime", help="Installed iOS runtime for a newly created disposable simulator")
    args = parser.parse_args()
    if platform.system() != "Darwin":
        raise RuntimeError("This native WK test requires macOS and Xcode; it never silently skips")
    artifact = args.artifact.resolve(strict=True)
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    manifest = verify_artifact(artifact)
    (output / "artifact-sha256.json").write_text(json.dumps(manifest, indent=2) + "\n")
    source_hash = state_methods(output)
    bundle_id = "so.onekey.lavamoat.wkschemetests.p" + uuid.uuid4().hex
    app = output / "Probe.app"
    app.mkdir()
    shutil.copytree(artifact, app / "web-embed")
    info = {"CFBundleIdentifier": bundle_id, "CFBundleExecutable": "Probe", "CFBundleName": "Native WebEmbed Test",
            "CFBundleVersion": "1", "CFBundleShortVersionString": "1.0", "CFBundlePackageType": "APPL",
            "LSRequiresIPhoneOS": True, "UILaunchScreen": {}, "UIDeviceFamily": [1, 2]}
    (app / "Info.plist").write_bytes(plistlib.dumps(info))
    sdk = run("xcrun", "--sdk", "iphonesimulator", "--show-sdk-path")
    arch = "arm64" if platform.machine() == "arm64" else "x86_64"
    command = ["/usr/bin/xcrun", "--sdk", "iphonesimulator", "clang", "-fobjc-arc", "-fmodules", "-Werror",
               "-fmodules-cache-path=module-cache", "-target", arch + "-apple-ios15.5-simulator",
               "-isysroot", sdk, "-I", str(PACKAGE), "-I", ".", "-framework", "UIKit", "-framework", "WebKit",
               "-framework", "Foundation", str(HERE / "Probe.m"), str(HERE / "StateFixture.m"),
               str(PACKAGE / "RNCOneKeyWebEmbedAssets.m"), "-o", "Probe.app/Probe"]
    # Keep the caller's output directory out of compiler arguments. Argument
    # lists never pass through a shell; paths are not shell-escaped strings.
    compilation = subprocess.run(command, cwd=output, shell=False, text=True, capture_output=True, timeout=120)
    (output / "compile.log").write_text(compilation.stdout + compilation.stderr)
    compilation.check_returncode()
    run("codesign", "--force", "--sign", "-", str(app))
    created = not args.simulator
    simulator = args.simulator
    installed = False
    try:
        if simulator:
            devices = json.loads(run("xcrun", "simctl", "list", "devices", "available", "--json"))["devices"]
            device = next((d for group in devices.values() for d in group if d["udid"] == simulator), None)
            if not device or not device["name"].startswith("OneKey LavaMoat"):
                raise ValueError("Explicit reuse is restricted to a dedicated OneKey LavaMoat simulator")
            if device["state"] != "Booted":
                run("xcrun", "simctl", "boot", simulator)
        else:
            runtimes = json.loads(run("xcrun", "simctl", "list", "runtimes", "--json"))["runtimes"]
            available = [r for r in runtimes if r["isAvailable"] and ".iOS-" in r["identifier"]]
            runtime = args.runtime or sorted(available, key=lambda r: tuple(int(x) for x in r["version"].split(".")))[-1]["identifier"]
            types = json.loads(run("xcrun", "simctl", "list", "devicetypes", "--json"))["devicetypes"]
            phone = next(d["identifier"] for d in reversed(types) if d["name"].startswith("iPhone"))
            simulator = run("xcrun", "simctl", "create", "OneKey LavaMoat Native Scheme Test", phone, runtime)
            run("xcrun", "simctl", "boot", simulator)
        run("xcrun", "simctl", "bootstatus", simulator, "-b", timeout=120)
        run("xcrun", "simctl", "install", simulator, str(app))
        installed = True
        run("xcrun", "simctl", "launch", simulator, bundle_id)
        container = Path(run("xcrun", "simctl", "get_app_container", simulator, bundle_id, "data"))
        report = container / "Documents/report.json"
        deadline = time.monotonic() + 90
        while not report.exists() and time.monotonic() < deadline:
            time.sleep(0.5)
        if not report.exists():
            raise TimeoutError("Actual native WK regression did not finish")
        for file in (container / "Documents").iterdir():
            if file.suffix in {".json", ".png"}:
                shutil.copyfile(file, output / file.name)
        result = json.loads(report.read_text())
        result["provenance"] = {"simulator": simulator, "bundleId": bundle_id, "artifactIndexSHA256": manifest["index.html"],
                                "nativeImplSHA256": source_hash,
                                "handlerSHA256": digest((PACKAGE / "RNCOneKeyWebEmbedAssets.m").read_bytes()),
                                "fixtureSHA256": digest((HERE / "Probe.m").read_bytes())}
        (output / "report.json").write_text(json.dumps(result, indent=2) + "\n")
        if verify_artifact(artifact) != manifest:
            raise ValueError("Input artifact changed during test")
        if not result["passed"]:
            raise AssertionError([check for check in result["checks"] if not check["passed"]])
        print(f"PASS: {len(result['checks'])} native checks; report: {output / 'report.json'}")
    finally:
        # Attempt every cleanup even if the app already exited or a previous command failed.
        cleanup = []
        if installed:
            cleanup.extend([("terminate", simulator, bundle_id), ("uninstall", simulator, bundle_id)])
        if created and simulator:
            cleanup.extend([("shutdown", simulator), ("delete", simulator)])
        cleanup_results = []
        for command in cleanup:
            try:
                result = subprocess.run(("xcrun", "simctl", *command), capture_output=True, text=True, timeout=30)
                cleanup_results.append({"operation": command[0], "exitCode": result.returncode})
            except subprocess.TimeoutExpired:
                cleanup_results.append({"operation": command[0], "error": "timeout"})
        (output / "cleanup.json").write_text(json.dumps(cleanup_results, indent=2) + "\n")
        if any(item["operation"] in {"uninstall", "delete"} and item.get("exitCode") != 0 for item in cleanup_results):
            raise RuntimeError("Dedicated native test cleanup failed; inspect cleanup.json")


if __name__ == "__main__":
    main()
