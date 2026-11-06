#!/usr/bin/env python3
"""Regression tests for the JPush native SDK build-time patchers.

The tests build minimal synthetic SDK artifacts (a Mach-O static archive and a
Java class JAR) instead of shipping the proprietary SDK bytes, then exercise the
unpatched, patched, tampered and unsupported-input paths of both patchers.

Run:
    python3 -B apps/mobile/scripts/__tests__/patch-jpush-sdks.test.py
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import plistlib
import struct
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parents[1]
IOS_PATCHER = SCRIPTS / "patch-jpush-ios.py"
ANDROID_PATCHER = SCRIPTS / "patch-jpush-android.py"


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


IOS = load_module("patch_jpush_ios", IOS_PATCHER)
ANDROID = load_module("patch_jpush_android", ANDROID_PATCHER)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def build_ar(members: dict[str, bytes]) -> bytes:
    archive = bytearray(b"!<arch>\n")
    for name, data in members.items():
        raw_name = name.encode()
        total = len(raw_name) + len(data)
        header = (
            ("#1/" + str(len(raw_name))).ljust(16).encode()
            + b"0".ljust(12)
            + b"0".ljust(6)
            + b"0".ljust(6)
            + b"100644".ljust(8)
            + str(total).ljust(10).encode()
            + b"`\n"
        )
        archive += header + raw_name + data
        if total % 2:
            archive += b"\n"
    return bytes(archive)


def build_macho(text: bytes, symbols: list[tuple[str, int]]) -> bytes:
    string_table = bytearray(b"\x00")
    string_offsets = []
    for name, _value in symbols:
        string_offsets.append(len(string_table))
        string_table += name.encode() + b"\x00"
    segment_size = 72 + 80
    symtab_size = 24
    command_bytes = segment_size + symtab_size
    code_offset = 32 + command_bytes
    symbol_offset = code_offset + len(text)
    string_offset = symbol_offset + 16 * len(symbols)

    segment = struct.pack(
        "<II16sQQQQiiII",
        0x19,
        segment_size,
        b"",
        0,
        len(text),
        0,
        len(text),
        7,
        7,
        1,
        0,
    )
    section = struct.pack(
        "<16s16sQQIIIIIIII",
        b"__text",
        b"__TEXT",
        0,
        len(text),
        code_offset,
        0,
        0,
        0,
        0x80000400,
        0,
        0,
        0,
    )
    symtab = struct.pack(
        "<IIIIII",
        0x2,
        symtab_size,
        symbol_offset,
        len(symbols),
        string_offset,
        len(string_table),
    )
    nlist = b""
    for (name, value), offset in zip(symbols, string_offsets):
        nlist += struct.pack("<IBBHQ", offset, 0x0E, 1, 0, value)
    header = struct.pack(
        "<IiiIIII", 0xFEEDFACF, 0x0100000C, 0, 1, 2, command_bytes, 0
    ) + b"\x00" * 4
    return header + segment + section + symtab + text + nlist + bytes(string_table)


def build_java_class(target_call: bool) -> bytes:
    pool: list[tuple[int, bytes]] = []

    def add_utf8(value: str) -> int:
        encoded = value.encode()
        pool.append((1, struct.pack(">H", len(encoded)) + encoded))
        return len(pool)

    fixture = add_utf8("Fixture")
    fixture_class = len(pool) + 1
    pool.append((7, struct.pack(">H", fixture)))
    object_name = add_utf8("java/lang/Object")
    object_class = len(pool) + 1
    pool.append((7, struct.pack(">H", object_name)))
    method_name = add_utf8("run")
    method_descriptor = add_utf8("()V")
    code_name = add_utf8("Code")
    webview_name = add_utf8("android/webkit/WebView")
    webview_class = len(pool) + 1
    pool.append((7, struct.pack(">H", webview_name)))
    load_name = add_utf8("loadUrl")
    load_descriptor = add_utf8("(Ljava/lang/String;)V")
    load_nat = len(pool) + 1
    pool.append((12, struct.pack(">HH", load_name, load_descriptor)))
    load_ref = len(pool) + 1
    pool.append((10, struct.pack(">HH", webview_class, load_nat)))
    bridge_name = add_utf8("addJavascriptInterface")
    add_utf8("Unrelated")

    code = bytearray(b"\x01\x01")  # aconst_null, aconst_null
    if target_call:
        code += bytes((0xB6, load_ref >> 8, load_ref & 0xFF))
    code += b"\xb1"  # return

    code_payload = (
        struct.pack(">HHI", 2, 0, len(code))
        + bytes(code)
        + struct.pack(">HH", 0, 0)
    )
    code_attribute = struct.pack(">HI", code_name, len(code_payload)) + code_payload
    method = struct.pack(">HHHH", 0x0009, method_name, method_descriptor, 1)
    method += code_attribute

    constant_pool = b"".join(
        bytes((tag,)) + payload if tag == 1 else bytes((tag,)) + payload
        for tag, payload in pool
    )
    body = struct.pack(">HHH", 0x0021, fixture_class, object_class)
    body += struct.pack(">H", 0)  # interfaces
    body += struct.pack(">H", 0)  # fields
    body += struct.pack(">H", 1) + method  # methods
    body += struct.pack(">H", 0)  # class attributes
    return (
        struct.pack(">IHH", 0xCAFEBABE, 0, 52)
        + struct.pack(">H", len(pool) + 1)
        + constant_pool
        + body
    )


def write_jar(path: Path, entries: dict[str, bytes]) -> None:
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in entries.items():
            archive.writestr(name, data)


def build_ios_fixture(root: Path) -> tuple[Path, dict]:
    package = root / "fixture-jpush"
    xcframework = package / "ios" / "fixture.xcframework"
    slice_root = xcframework / "ios-arm64"
    slice_root.mkdir(parents=True)
    (package / "package.json").write_text(json.dumps({"version": "3.2.1"}))
    (xcframework / "Info.plist").write_bytes(
        plistlib.dumps(
            {
                "CFBundlePackageType": "XFWK",
                "XCFrameworkFormatVersion": "1.0",
                "AvailableLibraries": [
                    {
                        "LibraryIdentifier": "ios-arm64",
                        "LibraryPath": "libFixture.a",
                        "SupportedArchitectures": ["arm64"],
                        "SupportedPlatform": "ios",
                    }
                ],
            }
        )
    )
    text = b"\x1f\x20\x03\xd5" * 2  # two nop instructions
    object_bytes = build_macho(text, [("-[Fixture a]", 0), ("-[Fixture b]", 4)])
    archive_bytes = build_ar({"Fixture.o": object_bytes})
    library = slice_root / "libFixture.a"
    library.write_bytes(archive_bytes)

    patched = bytearray(archive_bytes)
    IOS.patch_thin_archive(patched, 0, len(patched), ["-[Fixture a]", "-[Fixture b]"])
    manifest = {
        "schemaVersion": 1,
        "libraries": [
            {
                "name": "Fixture",
                "packageJson": "fixture-jpush/package.json",
                "packageVersion": "3.2.1",
                "xcframework": "fixture-jpush/ios/fixture.xcframework",
                "binary": "libFixture.a",
                "symbols": ["-[Fixture a]", "-[Fixture b]"],
                "slices": {
                    "ios-arm64": {
                        "inputSha256": sha256(archive_bytes),
                        "outputSha256": sha256(bytes(patched)),
                    }
                },
            }
        ],
    }
    return library, manifest


def build_android_fixture(root: Path) -> tuple[Path, dict]:
    package = root / "fixture-jpush"
    libraries = package / "android" / "libs"
    libraries.mkdir(parents=True)
    (package / "package.json").write_text(json.dumps({"version": "3.2.1"}))
    entries = {
        "fixture/Fixture.class": build_java_class(True),
        "fixture/Other.class": build_java_class(False),
        "META-INF/MANIFEST.MF": b"Manifest-Version: 1.0\n",
    }
    jar = libraries / "fixture.jar"
    write_jar(jar, entries)

    target = {
        "owner": "android/webkit/WebView",
        "name": "loadUrl",
        "descriptor": "(Ljava/lang/String;)V",
    }
    rename = {
        "value": "addJavascriptInterface",
        "replacement": "addJavascriptInterfacX",
    }
    spec = {
        "invokeTargets": [target],
        "utf8Renames": [rename],
    }
    patched_entries = {}
    for name, data in entries.items():
        if name.endswith(".class"):
            invokes, renames = ANDROID.class_patches(data, spec)
            data = ANDROID.apply_patches(data, invokes + renames)
        patched_entries[name] = sha256(data)
    manifest = {
        "schemaVersion": 1,
        "jars": [
            {
                "name": "Fixture",
                "packageJson": "fixture-jpush/package.json",
                "packageVersion": "3.2.1",
                "jar": "fixture-jpush/android/libs/fixture.jar",
                "inputSha256": sha256(jar.read_bytes()),
                "expectedInvokeSites": 1,
                "expectedUtf8Renames": 2,
                "invokeTargets": [target],
                "utf8Renames": [rename],
                "patchedEntries": patched_entries,
            }
        ],
    }
    return jar, manifest


def run_patcher(
    patcher: Path, node_modules: Path, manifest: dict, *extra: str
) -> subprocess.CompletedProcess:
    manifest_path = node_modules.parent / (
        manifest.get("name", "manifest") + ".json"
    )
    manifest_path.write_text(json.dumps(manifest))
    command = [
        sys.executable,
        "-B",
        str(patcher),
        str(node_modules),
        "--manifest",
        str(manifest_path),
        *extra,
    ]
    return subprocess.run(command, capture_output=True, text=True, check=False)


class IosPatcherTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.node_modules = self.root / "node_modules"
        self.library, self.manifest = build_ios_fixture(self.node_modules)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_patch_then_verify_is_idempotent(self) -> None:
        result = run_patcher(IOS_PATCHER, self.node_modules, self.manifest)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("patched", result.stdout)
        result = run_patcher(IOS_PATCHER, self.node_modules, self.manifest, "--check")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("already patched", result.stdout)

    def test_check_rejects_unpatched_library(self) -> None:
        result = run_patcher(IOS_PATCHER, self.node_modules, self.manifest, "--check")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("still present", result.stderr)

    def test_patch_rejects_unknown_sdk_bytes(self) -> None:
        data = bytearray(self.library.read_bytes())
        data[-1] ^= 0xFF
        self.library.write_bytes(bytes(data))
        result = run_patcher(IOS_PATCHER, self.node_modules, self.manifest)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Unsupported", result.stderr)


class AndroidPatcherTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.node_modules = self.root / "node_modules"
        self.jar, self.manifest = build_android_fixture(self.node_modules)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_patch_then_verify_is_idempotent(self) -> None:
        result = run_patcher(ANDROID_PATCHER, self.node_modules, self.manifest)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("patched", result.stdout)
        result = run_patcher(
            ANDROID_PATCHER, self.node_modules, self.manifest, "--check"
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("already patched", result.stdout)

    def test_check_rejects_unpatched_jar(self) -> None:
        result = run_patcher(
            ANDROID_PATCHER, self.node_modules, self.manifest, "--check"
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("still present", result.stderr)

    def test_check_rejects_tampered_unpinned_entry(self) -> None:
        result = run_patcher(ANDROID_PATCHER, self.node_modules, self.manifest)
        self.assertEqual(result.returncode, 0, result.stderr)
        with zipfile.ZipFile(self.jar) as archive:
            entries = {info.filename: archive.read(info) for info in archive.infolist()}
        entries["META-INF/MANIFEST.MF"] = b"Manifest-Version: 1.1\n"
        write_jar(self.jar, entries)
        result = run_patcher(
            ANDROID_PATCHER, self.node_modules, self.manifest, "--check"
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("reviewed result", result.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
