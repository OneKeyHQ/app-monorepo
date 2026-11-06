#!/usr/bin/env python3
"""Neutralize JPush rich-media WebView rendering and its JavaScript bridge.

The Jiguang JPush Android SDK ships as prebuilt JARs. Its rich-push pages and
in-app messages render server-supplied HTML in an `android.webkit.WebView`, and
the page gets a `@JavascriptInterface` object registered reflectively under
`addJavascriptInterface` that can launch Intents, download files, create
shortcuts and read device/notification data. The app never uses these features,
so the reviewed call sites are neutralized before Gradle compiles the JARs:

- `WebView.loadUrl` / `loadData` / `loadDataWithBaseURL` / `postUrl` calls are
  replaced with stack-balancing pops, so no remote page is ever loaded.
- `WebSettings.setJavaScriptEnabled` calls are neutralized for the same reason.
- The `addJavascriptInterface` method-name constant is renamed in place; the
  SDK's reflective lookup then fails and the JavaScript bridge is never
  registered.

Only bytecode instructions of the same length are rewritten, so the JVM
verifier sees an unchanged stack height on every instruction boundary and all
StackMapTable/exception-table offsets stay valid.

The manifest pins the reviewed input JAR SHA-256, the expected number of call
sites, and the SHA-256 of every patched class entry. An SDK upgrade fails
loudly until the new bytes are reviewed again. The patch is idempotent.

Usage:
    python3 -B apps/mobile/scripts/patch-jpush-android.py <node_modules>
    python3 -B apps/mobile/scripts/patch-jpush-android.py <node_modules> --check
    python3 -B apps/mobile/scripts/patch-jpush-android.py <node_modules> --report
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import stat
import struct
import tempfile
import zipfile


POP = 0x57
POP2 = 0x58
NOP = 0x00

# JVM opcode operand lengths for instruction walking. Only fixed-size opcodes
# and the two switch instructions are needed; reserved opcodes never appear in
# class files and are rejected loudly.
OPCODE_LENGTHS = {opcode: 1 for opcode in range(0x00, 0x10)}
OPCODE_LENGTHS.update({0x10: 2, 0x11: 3, 0x12: 2, 0x13: 3, 0x14: 3})
for _opcode in range(0x15, 0x1A):
    OPCODE_LENGTHS[_opcode] = 2
for _opcode in range(0x1A, 0x36):
    OPCODE_LENGTHS[_opcode] = 1
for _opcode in range(0x36, 0x3B):
    OPCODE_LENGTHS[_opcode] = 2
for _opcode in range(0x3B, 0x84):
    OPCODE_LENGTHS[_opcode] = 1
OPCODE_LENGTHS[0x84] = 3
for _opcode in range(0x85, 0x99):
    OPCODE_LENGTHS[_opcode] = 1
for _opcode in range(0x99, 0xA9):
    OPCODE_LENGTHS[_opcode] = 3
OPCODE_LENGTHS[0xA9] = 2
for _opcode in range(0xAC, 0xB2):
    OPCODE_LENGTHS[_opcode] = 1
for _opcode in range(0xB2, 0xB6):
    OPCODE_LENGTHS[_opcode] = 3
OPCODE_LENGTHS.update(
    {
        0xB6: 3,
        0xB7: 3,
        0xB8: 3,
        0xB9: 5,
        0xBA: 5,
        0xBB: 3,
        0xBC: 2,
        0xBD: 3,
        0xBE: 1,
        0xBF: 1,
        0xC0: 3,
        0xC1: 3,
        0xC2: 1,
        0xC3: 1,
        0xC5: 4,
        0xC6: 3,
        0xC7: 3,
        0xC8: 5,
        0xC9: 5,
        0xCA: 1,
    }
)


class PatchError(ValueError):
    pass


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def u1(data: bytes, offset: int) -> int:
    return data[offset]


def u2(data: bytes, offset: int) -> int:
    return struct.unpack_from(">H", data, offset)[0]


def u4(data: bytes, offset: int) -> int:
    return struct.unpack_from(">I", data, offset)[0]


def instruction_length(code: bytes, offset: int) -> int:
    opcode = code[offset]
    if opcode == 0xAA:  # tableswitch
        padding = (4 - ((offset + 1) % 4)) % 4
        base = offset + 1 + padding
        low = struct.unpack_from(">i", code, base + 4)[0]
        high = struct.unpack_from(">i", code, base + 8)[0]
        return 1 + padding + 12 + 4 * (high - low + 1)
    if opcode == 0xAB:  # lookupswitch
        padding = (4 - ((offset + 1) % 4)) % 4
        base = offset + 1 + padding
        pairs = struct.unpack_from(">i", code, base + 4)[0]
        return 1 + padding + 8 + 8 * pairs
    if opcode == 0xC4:  # wide
        return 6 if code[offset + 1] == 0x84 else 4
    length = OPCODE_LENGTHS.get(opcode)
    if length is None:
        raise PatchError("Unsupported JVM opcode " + hex(opcode))
    return length


def parameter_slots(descriptor: str) -> int:
    index = 1
    slots = 0
    while index < len(descriptor):
        char = descriptor[index]
        if char == ")":
            break
        if char in "JD":
            slots += 2
            index += 1
        elif char == "[":
            index += 1
            while descriptor[index] == "[":
                index += 1
            index += 2 if descriptor[index] in "JD" else 1
            slots += 1
        elif char == "L":
            while descriptor[index] != ";":
                index += 1
            index += 1
            slots += 1
        else:
            index += 1
            slots += 1
    return slots


def balanced_pops(descriptor: str) -> bytes:
    """Replace one 3-byte invoke with pops that remove the same stack values."""
    slots = 1 + parameter_slots(descriptor)
    if slots == 2:
        return bytes((POP, POP, NOP))
    if slots == 3:
        return bytes((POP, POP, POP))
    if slots == 4:
        return bytes((POP2, POP2, NOP))
    if slots == 5:
        return bytes((POP2, POP2, POP))
    if slots == 6:
        return bytes((POP2, POP2, POP2))
    raise PatchError("Unsupported invoke stack shape: " + descriptor)


def parse_constant_pool(data: bytes) -> tuple[list, int, dict[int, tuple[int, int]]]:
    count = u2(data, 8)
    offset = 10
    pool: list = [None] * count
    utf8: dict[int, tuple[int, int]] = {}
    index = 1
    while index < count:
        tag = u1(data, offset)
        offset += 1
        if tag == 1:
            length = u2(data, offset)
            offset += 2
            utf8[index] = (offset, length)
            pool[index] = (tag, data[offset : offset + length])
            offset += length
        elif tag in (7, 8, 16, 19, 20):
            pool[index] = (tag, u2(data, offset))
            offset += 2
        elif tag == 15:
            pool[index] = (tag, u1(data, offset), u2(data, offset + 1))
            offset += 3
        elif tag in (3, 4):
            pool[index] = (tag, data[offset : offset + 4])
            offset += 4
        elif tag in (5, 6):
            pool[index] = (tag, data[offset : offset + 8])
            offset += 8
            index += 1
        elif tag in (9, 10, 11, 12, 17, 18):
            pool[index] = (tag, u2(data, offset), u2(data, offset + 2))
            offset += 4
        else:
            raise PatchError("Unsupported constant pool tag " + str(tag))
        if pool[index] is None:
            pool[index] = (tag,)
        index += 1
    return pool, offset, utf8


def utf8_value(data: bytes, entry: tuple[int, int]) -> bytes:
    start, length = entry
    return data[start : start + length]


def invoke_sites(
    data: bytes, targets: dict[tuple[str, str, str], bytes]
) -> list[tuple[int, bytes, bytes]]:
    """Return (offset, original, replacement) for reviewed invoke call sites."""
    pool, offset, _utf8 = parse_constant_pool(data)
    offset += 6  # access_flags, this_class, super_class
    interfaces = u2(data, offset)
    offset += 2 + 2 * interfaces
    fields = u2(data, offset)
    offset += 2
    for _ in range(fields):
        offset += 6
        attributes = u2(data, offset)
        offset += 2
        for _ in range(attributes):
            offset += 6 + u4(data, offset + 2)
    methods = u2(data, offset)
    offset += 2
    patches: list[tuple[int, bytes, bytes]] = []
    for _ in range(methods):
        offset += 6
        attributes = u2(data, offset)
        offset += 2
        for _ in range(attributes):
            name = pool[u2(data, offset)]
            length = u4(data, offset + 2)
            attribute_offset = offset + 6
            if name[1] == b"Code":
                code_length = u4(data, attribute_offset + 4)
                code_start = attribute_offset + 8
                cursor = 0
                while cursor < code_length:
                    opcode = data[code_start + cursor]
                    if opcode in (0xB6, 0xB7, 0xB8, 0xB9):
                        index = u2(data, code_start + cursor + 1)
                        reference = pool[index]
                        if isinstance(reference, tuple) and reference[0] == 10:
                            class_index = pool[reference[1]][1]
                            name_and_type = pool[reference[2]]
                            owner = pool[class_index][1]
                            method_name = pool[name_and_type[1]][1]
                            descriptor = pool[name_and_type[2]][1]
                            key = (
                                owner.decode("utf-8"),
                                method_name.decode("utf-8"),
                                descriptor.decode("utf-8"),
                            )
                            if key in targets:
                                original = data[
                                    code_start + cursor : code_start + cursor + 3
                                ]
                                patches.append(
                                    (code_start + cursor, original, targets[key])
                                )
                    cursor += instruction_length(data[code_start:], cursor)
            offset += 6 + length
    return patches


def class_patches(
    data: bytes, spec: dict
) -> tuple[list[tuple[int, bytes, bytes]], list[tuple[int, bytes, bytes]]]:
    targets = {
        (target["owner"], target["name"], target["descriptor"]): balanced_pops(
            target["descriptor"]
        )
        for target in spec["invokeTargets"]
    }
    invokes = invoke_sites(data, targets)
    pool, _offset, utf8_offsets = parse_constant_pool(data)
    renames: list[tuple[int, bytes, bytes]] = []
    for entry in spec["utf8Renames"]:
        original = entry["value"].encode("utf-8")
        replacement = entry["replacement"].encode("utf-8")
        if len(original) != len(replacement):
            raise PatchError("UTF-8 rename must keep the same byte length")
        for index, (start, length) in utf8_offsets.items():
            if pool[index][1] == original:
                renames.append((start, original, replacement))
                break
    return invokes, renames


def apply_patches(data: bytes, patches: list[tuple[int, bytes, bytes]]) -> bytes:
    result = bytearray(data)
    for offset, original, replacement in patches:
        if bytes(result[offset : offset + len(original)]) != original:
            raise PatchError("Reviewed class bytes no longer match the manifest")
        result[offset : offset + len(original)] = replacement
    return bytes(result)


def scan_jar(entries: dict[str, bytes], spec: dict) -> tuple[int, int, dict[str, list]]:
    invoke_count = 0
    rename_count = 0
    details: dict[str, list] = {}
    for name, data in entries.items():
        if not name.endswith(".class"):
            continue
        invokes, renames = class_patches(data, spec)
        if invokes or renames:
            invoke_count += len(invokes)
            rename_count += len(renames)
            details[name] = [
                {"offset": offset, "replacement": replacement.hex()}
                for offset, _original, replacement in invokes
            ] + [
                {"offset": offset, "replacement": replacement.decode("latin-1")}
                for offset, _original, replacement in renames
            ]
    return invoke_count, rename_count, details


def read_entries(jar: Path) -> tuple[list[zipfile.ZipInfo], dict[str, bytes]]:
    infos = []
    entries: dict[str, bytes] = {}
    with zipfile.ZipFile(jar) as archive:
        for info in archive.infolist():
            infos.append(info)
            entries[info.filename] = archive.read(info)
    return infos, entries


def write_jar(
    jar: Path, infos: list[zipfile.ZipInfo], entries: dict[str, bytes]
) -> None:
    with tempfile.NamedTemporaryFile(
        prefix=".onekey-jpush-android-", dir=jar.parent, delete=False
    ) as temporary:
        temporary_path = Path(temporary.name)
        try:
            with zipfile.ZipFile(
                temporary, "w", zipfile.ZIP_DEFLATED, compresslevel=9
            ) as archive:
                for info in infos:
                    copy = zipfile.ZipInfo(
                        info.filename, date_time=(1980, 1, 1, 0, 0, 0)
                    )
                    copy.compress_type = info.compress_type
                    copy.external_attr = info.external_attr
                    copy.internal_attr = info.internal_attr
                    copy.create_system = info.create_system
                    archive.writestr(copy, entries[info.filename])
            temporary.flush()
            os.fchmod(temporary.fileno(), stat.S_IMODE(jar.stat().st_mode))
            os.replace(temporary_path, jar)
        finally:
            temporary_path.unlink(missing_ok=True)


def patch_jar(jar: Path, spec: dict, check_only: bool, report_only: bool) -> str:
    if jar.is_symlink() or not jar.is_file():
        raise PatchError("Expected a real SDK jar: " + str(jar))
    infos, entries = read_entries(jar)
    invoke_count, rename_count, details = scan_jar(entries, spec)
    if invoke_count == 0 and rename_count == 0:
        actual_hashes = {
            name: digest(entries[name]) for name in spec["patchedClassSha256"]
        }
        if actual_hashes != spec["patchedClassSha256"]:
            raise PatchError(
                "Already-neutralized class bytes do not match the reviewed result: "
                + jar.name
            )
        return "already patched"
    if report_only:
        print(
            "[" + spec["name"] + "] " + jar.name
            + " input sha256=" + digest(jar.read_bytes())
            + " invoke-sites=" + str(invoke_count)
            + " utf8-renames=" + str(rename_count)
        )
        for name, items in sorted(details.items()):
            print("  " + name)
            for item in items:
                print("    " + str(item))
        return "reported"
    if digest(jar.read_bytes()) != spec["inputSha256"]:
        raise PatchError(
            "Unsupported " + jar.name + " SHA-256; review the new SDK bytes "
            "before updating the patch"
        )
    if invoke_count != spec["expectedInvokeSites"]:
        raise PatchError(
            "Expected "
            + str(spec["expectedInvokeSites"])
            + " reviewed call sites in "
            + jar.name
            + ", found "
            + str(invoke_count)
        )
    if rename_count != spec["expectedUtf8Renames"]:
        raise PatchError(
            "Expected "
            + str(spec["expectedUtf8Renames"])
            + " reviewed reflection names in "
            + jar.name
            + ", found "
            + str(rename_count)
        )
    if check_only:
        raise PatchError(
            "[" + spec["name"] + "] remote WebView rendering and JS bridge are "
            "still present in " + jar.name
        )
    for name, data in list(entries.items()):
        if not name.endswith(".class"):
            continue
        invokes, renames = class_patches(data, spec)
        if invokes or renames:
            entries[name] = apply_patches(data, invokes + renames)
    invoke_after, rename_after, _details = scan_jar(entries, spec)
    if invoke_after or rename_after:
        raise PatchError("Patch did not remove every reviewed call site: " + jar.name)
    def patched_hash(class_name: str) -> str:
        return digest(entries[class_name])
    actual_hashes = {
        class_name: patched_hash(class_name)
        for class_name in spec["patchedClassSha256"]
    }
    if actual_hashes != spec["patchedClassSha256"]:
        raise PatchError(
            "Patched class SHA-256 does not match the reviewed result: " + jar.name
        )
    write_jar(jar, infos, entries)
    return "patched"


def load_manifest() -> dict:
    manifest = json.loads(Path(__file__).with_suffix(".json").read_text())
    if manifest.get("schemaVersion") != 1:
        raise PatchError("Unsupported JPush Android patch manifest schema")
    if not manifest.get("jars"):
        raise PatchError("JPush Android patch manifest has no jars")
    return manifest


def run(node_modules: Path, check_only: bool, report_only: bool) -> int:
    manifest = load_manifest()
    for spec in manifest["jars"]:
        package_json = node_modules / spec["packageJson"]
        version = json.loads(package_json.read_text()).get("version")
        if version != spec["packageVersion"]:
            raise PatchError(
                spec["name"]
                + " version "
                + str(version)
                + " does not match the reviewed "
                + spec["packageVersion"]
            )
        jar = node_modules / spec["jar"]
        state = patch_jar(jar, spec, check_only, report_only)
        if state != "reported":
            print("[" + spec["name"] + "] " + state + " " + str(jar))
    if check_only:
        print(
            "[JPush] Remote WebView rendering and JS bridge are removed "
            "from the pinned SDK"
        )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Remove remote rich-media WebView rendering and the JavaScript bridge "
            "from the pinned JPush Android SDK"
        )
    )
    parser.add_argument("node_modules", type=Path)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--check",
        action="store_true",
        help="verify the pinned jar is already neutralized without writing",
    )
    mode.add_argument(
        "--report",
        action="store_true",
        help="print reviewed call sites and hashes without writing",
    )
    arguments = parser.parse_args()
    try:
        return run(arguments.node_modules, arguments.check, arguments.report)
    except (KeyError, OSError, PatchError, struct.error, zipfile.BadZipFile) as error:
        parser.exit(1, "[JPush] Remote command removal failed: " + str(error) + "\n")


if __name__ == "__main__":
    raise SystemExit(main())
