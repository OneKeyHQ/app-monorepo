#!/usr/bin/env python3
"""Remove JPush/JCore remote commands from the pinned iOS SDKs.

The Jiguang JPush/JCore iOS SDK ships as prebuilt static archives and has no
public switch for the following server-driven paths, so the reviewed
Objective-C method implementations are replaced with an immediate `ret` in the
pinned archives:

- Pasteboard: `JPUSHPasteController` writes server-supplied content into
  `[UIPasteboard generalPasteboard]`, while `JCommonPasteController` /
  `JCommonPasteReportManager` read the clipboard and upload its contents.
- In-app messages and rich-media notifications: server dictionaries reach the
  `JPUSHInMessageManager` / `JPUSHNotiInMessageManager` / `JPUSHInAppManager`
  dispatch methods, which load remote HTML into `WKWebView`, run
  `evaluateJavaScript:` and expose a `WKScriptMessageHandler` bridge.
- Geofence and location strategy: `JPUSHGeofenceManager` accepts remote
  control-command and custom push messages that can add regions and start
  location updates; `JCommonServiceController` relays remote strategy
  commands, including `JCORELocationController` location collection.
- Diagnostics: `JCORELogger` accepts remote log enable/expiry/upload settings.

This removes the remote commands without changing any public API, normal
notification payload or push delivery path. Relocation rows that target an
overwritten entry instruction are removed as well; otherwise the linker would
apply e.g. ARM64_RELOC_PAGE21 to a `ret` and reject the object. The manifest
pins the SHA-256 of every reviewed input and expected output slice. An SDK
upgrade fails loudly until the new bytes are reviewed again. The patch is
idempotent: an already patched slice is verified and left untouched.

Usage:
    python3 -B apps/mobile/scripts/patch-jpush-ios.py <node_modules>
    python3 -B apps/mobile/scripts/patch-jpush-ios.py <node_modules> --check
    python3 -B apps/mobile/scripts/patch-jpush-ios.py <node_modules> --report-hashes

`--check` verifies that every pinned archive is already patched and writes
nothing. `--report-hashes` prints the reviewed input/output hashes without
touching disk; it is the helper used when auditing a new SDK version.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import plistlib
import stat
import struct
import tempfile


AR_MAGIC = b"!<arch>\n"
FAT_MAGIC = 0xCAFEBABE
MH_MAGIC_64 = 0xFEEDFACF
MH_OBJECT = 0x1
LC_SEGMENT_64 = 0x19
LC_SYMTAB = 0x2
N_SECT = 0x0E
CPU_ARM64 = 0x0100000C
CPU_X86_64 = 0x01000007
RET_BYTES = {
    CPU_ARM64: b"\xc0\x03\x5f\xd6",  # ret
    CPU_X86_64: b"\xc3",  # ret
}
EXPECTED_ARCHITECTURES = {
    "ios-arm64": ["arm64"],
    "ios-arm64_x86_64-simulator": ["arm64", "x86_64"],
}


class PatchError(ValueError):
    pass


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def u32(data: bytes, offset: int) -> int:
    return struct.unpack_from("<I", data, offset)[0]


def u64(data: bytes, offset: int) -> int:
    return struct.unpack_from("<Q", data, offset)[0]


def cstring(data: bytes, offset: int) -> str:
    end = data.index(b"\0", offset)
    return data[offset:end].decode("utf-8")


def is_fat(data: bytes) -> bool:
    return len(data) >= 8 and struct.unpack_from(">I", data, 0)[0] == FAT_MAGIC


def fat_slices(data: bytes) -> list[tuple[int, int, int]]:
    """Return (cpu, offset, size) for each architecture of a fat file."""
    if not is_fat(data):
        raise PatchError("Expected a fat Mach-O library")
    count = struct.unpack_from(">I", data, 4)[0]
    if not 1 <= count <= 8:
        raise PatchError("Unexpected fat archive architecture count")
    rows = []
    for index in range(count):
        cpu, _subtype, offset, size, alignment = struct.unpack_from(
            ">5I", data, 8 + 20 * index
        )
        if not 1 <= alignment <= 16 or offset % (1 << alignment):
            raise PatchError("Unexpected fat archive slice alignment")
        if offset + size > len(data) or size < 8:
            raise PatchError("Fat archive slice exceeds its container")
        rows.append((cpu, offset, size))
    return rows


def archive_members(data: bytes, base: int, length: int):
    """Yield (member_name, payload_offset, payload_size) for a thin `ar` archive."""
    if data[base : base + 8] != AR_MAGIC:
        raise PatchError("Expected a thin static library archive")
    end = base + length
    cursor = base + 8
    while cursor < end:
        if cursor + 60 > end:
            raise PatchError("Truncated archive member header")
        header = data[cursor : cursor + 60]
        raw_name = header[0:16].decode("latin-1").strip()
        try:
            total_size = int(header[48:58].decode("latin-1").strip())
        except ValueError as error:
            raise PatchError("Invalid archive member size") from error
        payload_offset = cursor + 60
        payload_size = total_size
        if raw_name.startswith("#1/"):
            try:
                name_length = int(raw_name[3:])
            except ValueError as error:
                raise PatchError("Invalid archive member name length") from error
            if name_length > total_size:
                raise PatchError("Invalid archive extended member name")
            name = (
                data[payload_offset : payload_offset + name_length]
                .rstrip(b"\0")
                .decode("utf-8")
            )
            payload_offset += name_length
            payload_size -= name_length
        else:
            name = raw_name.rstrip("/")
        if payload_size < 0 or payload_offset + payload_size > end:
            raise PatchError("Archive member exceeds its container")
        yield name, payload_offset, payload_size
        cursor = payload_offset + payload_size + (total_size % 2)


def object_sections(data: bytes, base: int, size: int):
    """Return (cpu, sections, symtab) for one Mach-O object inside an archive."""
    if u32(data, base) != MH_MAGIC_64:
        raise PatchError("Expected a 64-bit Mach-O object")
    cpu = u32(data, base + 4)
    file_type = u32(data, base + 12)
    if file_type != MH_OBJECT:
        raise PatchError("Archive member is not an object file")
    command_count = u32(data, base + 16)
    cursor = base + 32
    sections: list[tuple[str, str, int, int, int]] = []
    symtab = None
    for _ in range(command_count):
        command = u32(data, cursor)
        command_size = u32(data, cursor + 4)
        if command_size < 8 or cursor + command_size > base + size:
            raise PatchError("Invalid Mach-O load command")
        if command == LC_SEGMENT_64:
            section_count = u32(data, cursor + 64)
            section_cursor = cursor + 72
            for _ in range(section_count):
                # MH_OBJECT segment commands carry an empty segment name; the
                # section record itself names the segment it belongs to.
                segment_name = (
                    data[section_cursor + 16 : section_cursor + 32]
                    .split(b"\0")[0]
                    .decode("utf-8")
                )
                section_name = (
                    data[section_cursor : section_cursor + 16]
                    .split(b"\0")[0]
                    .decode("utf-8")
                )
                address = u64(data, section_cursor + 32)
                section_size = u64(data, section_cursor + 40)
                file_offset = u32(data, section_cursor + 48)
                section_header = section_cursor
                relocation_offset = u32(data, section_cursor + 56)
                relocation_count = u32(data, section_cursor + 60)
                sections.append(
                    (
                        segment_name,
                        section_name,
                        address,
                        section_size,
                        file_offset,
                        base + relocation_offset,
                        relocation_count,
                        section_header,
                    )
                )
                section_cursor += 80
        elif command == LC_SYMTAB:
            symtab = (
                u32(data, cursor + 8),
                u32(data, cursor + 12),
                u32(data, cursor + 16),
            )
        cursor += command_size
    if symtab is None:
        raise PatchError("Mach-O object has no symbol table")
    return cpu, sections, symtab


def symbol_file_offset(
    data: bytes, base: int, size: int, symbol: str
) -> tuple[int, int, bytes, tuple, int]:
    """Resolve `symbol` to (file offset, cpu, bytes, section, section offset)."""
    cpu, sections, (symbol_offset, symbol_count, string_offset) = object_sections(
        data, base, size
    )
    text_sections = [
        section
        for section in sections
        if section[0] == "__TEXT" and section[1] == "__text"
    ]
    if not text_sections:
        raise PatchError("Mach-O object has no __TEXT,__text section")
    for index in range(symbol_count):
        entry = base + symbol_offset + 16 * index
        if entry + 16 > base + size:
            raise PatchError("Truncated Mach-O symbol table")
        name_index = u32(data, entry)
        name_type = data[entry + 4]
        if name_type & 0x0E != N_SECT:
            continue
        if cstring(data, base + string_offset + name_index) != symbol:
            continue
        value = u64(data, entry + 8)
        for section in sections:
            segment_name, section_name, address, section_size = section[:4]
            if segment_name != "__TEXT" or section_name != "__text":
                continue
            if address <= value < address + section_size:
                if value + 4 > address + section_size:
                    raise PatchError("Symbol crosses its __text section")
                file_offset = section[4]
                absolute = base + file_offset + (value - address)
                return (
                    absolute,
                    cpu,
                    bytes(data[absolute : absolute + 4]),
                    section,
                    value - address,
                )
        raise PatchError("Symbol " + symbol + " is not inside __TEXT,__text")
    raise PatchError("Missing reviewed symbol: " + symbol)


def assert_no_entry_relocations(
    data: bytes, section: tuple, section_offset: int, length: int
) -> None:
    relocation_offset = section[5]
    relocation_count = struct.unpack_from("<I", data, section[7] + 60)[0]
    for index in range(relocation_count):
        entry = relocation_offset + 8 * index
        address = struct.unpack_from("<i", data, entry)[0]
        if 0 <= address and section_offset <= address < section_offset + length:
            raise PatchError(
                "Relocation still targets a patched entry instruction at "
                + hex(address)
            )


def remove_entry_relocations(
    data: bytearray, section: tuple, section_offset: int, length: int
) -> int:
    """Drop relocations that target the overwritten entry instruction.

    The linker applies every relocation in the object, so leaving e.g. an
    ARM64_RELOC_PAGE21 row on a location that now holds `ret` fails the link
    with "relocation on non-ADRP instruction". The relocation table is compacted
    in place and its section count is reduced.
    """
    relocation_offset = section[5]
    relocation_count = section[6]
    section_header = section[7]
    kept = []
    for index in range(relocation_count):
        entry = relocation_offset + 8 * index
        address = struct.unpack_from("<i", data, entry)[0]
        if 0 <= address and section_offset <= address < section_offset + length:
            continue
        kept.append(bytes(data[entry : entry + 8]))
    removed = relocation_count - len(kept)
    if removed == 0:
        return 0
    for index, entry in enumerate(kept):
        destination = relocation_offset + 8 * index
        data[destination : destination + 8] = entry
    for index in range(len(kept), relocation_count):
        destination = relocation_offset + 8 * index
        data[destination : destination + 8] = b"\0" * 8
    struct.pack_into("<I", data, section_header + 60, len(kept))
    return removed


def patch_thin_archive(
    data: bytearray, base: int, length: int, symbols: list[str]
) -> list[str]:
    """Replace the first instruction of every listed method with `ret`."""
    patched = []
    for symbol in symbols:
        matches = []
        for member_name, member_offset, member_size in archive_members(
            data, base, length
        ):
            try:
                resolved = symbol_file_offset(
                    data, member_offset, member_size, symbol
                )
            except PatchError:
                continue
            matches.append((member_name, resolved))
        if len(matches) != 1:
            raise PatchError(
                "Expected exactly one definition of "
                + symbol
                + ", found "
                + str(len(matches))
            )
        member_name, (absolute, cpu, current, section, section_offset) = matches[0]
        ret = RET_BYTES.get(cpu)
        if ret is None:
            raise PatchError("Unsupported architecture for " + symbol)
        if current == b"\0" * len(current):
            raise PatchError("Reviewed symbol has no code: " + symbol)
        if current != ret:
            data[absolute : absolute + len(ret)] = ret
        remove_entry_relocations(data, section, section_offset, len(ret))
        assert_no_entry_relocations(data, section, section_offset, len(ret))
        patched.append(member_name + ":" + symbol)
    return patched


def patch_library(
    path: Path, spec: dict, symbols: list[str], report_only: bool
) -> tuple[str, str, bool]:
    if path.is_symlink() or not path.is_file():
        raise PatchError("Expected a real static library: " + str(path))
    data = bytearray(path.read_bytes())
    input_hash = digest(data)
    if input_hash == spec["outputSha256"]:
        return input_hash, input_hash, False
    if input_hash != spec["inputSha256"]:
        raise PatchError(
            "Unsupported "
            + path.name
            + " SHA-256; review the new SDK bytes before updating the patch: "
            + input_hash
        )
    if is_fat(data):
        for cpu, offset, size in fat_slices(data):
            if cpu not in RET_BYTES:
                raise PatchError("Unexpected fat archive architecture: " + hex(cpu))
            patch_thin_archive(data, offset, size, symbols)
    else:
        patch_thin_archive(data, 0, len(data), symbols)
    output_hash = digest(data)
    if output_hash != spec["outputSha256"]:
        raise PatchError(
            "Patched "
            + path.name
            + " SHA-256 does not match the reviewed result: "
            + output_hash
        )
    if not report_only:
        temporary = tempfile.NamedTemporaryFile(
            prefix=".onekey-jpush-patch-", dir=path.parent, delete=False
        )
        temporary_path = Path(temporary.name)
        try:
            with temporary:
                temporary.write(data)
                temporary.flush()
            # Close the temporary file before replacing it so the write works
            # on every host platform that can run this build phase.
            try:
                os.chmod(temporary_path, stat.S_IMODE(path.stat().st_mode))
            except OSError:
                pass
            os.replace(temporary_path, path)
        finally:
            try:
                temporary_path.unlink(missing_ok=True)
            except OSError:
                pass
    return input_hash, output_hash, True


def load_manifest(manifest_path: Path | None) -> dict:
    path = manifest_path or Path(__file__).with_suffix(".json")
    manifest = json.loads(path.read_text())
    if manifest.get("schemaVersion") != 1:
        raise PatchError("Unsupported JPush patch manifest schema")
    if not manifest.get("libraries"):
        raise PatchError("JPush patch manifest has no libraries")
    return manifest


def validate_package_version(node_modules: Path, spec: dict) -> None:
    package_json = node_modules / spec["packageJson"]
    version = json.loads(package_json.read_text()).get("version")
    if version != spec["packageVersion"]:
        raise PatchError(
            spec["name"]
            + " version "
            + str(version)
            + " does not match the reviewed "
            + spec["packageVersion"]
            + "; review the new SDK bytes before updating the patch"
        )


def validate_xcframework(root: Path, spec: dict) -> dict:
    if root.is_symlink() or not root.is_dir():
        raise PatchError("Expected a real xcframework directory: " + str(root))
    info = plistlib.loads((root / "Info.plist").read_bytes())
    libraries = {
        item["LibraryIdentifier"]: item for item in info["AvailableLibraries"]
    }
    if set(libraries) != set(spec["slices"]):
        raise PatchError("Unsupported " + spec["name"] + " xcframework slices")
    for identifier, item in libraries.items():
        expected_architectures = EXPECTED_ARCHITECTURES.get(identifier)
        if expected_architectures is None:
            raise PatchError("Unsupported xcframework slice: " + identifier)
        if item.get("SupportedPlatform") != "ios":
            raise PatchError("Unsupported xcframework platform: " + identifier)
        if item.get("SupportedArchitectures") != expected_architectures:
            raise PatchError("Unsupported xcframework architectures: " + identifier)
        expected_variant = None if identifier == "ios-arm64" else "simulator"
        if item.get("SupportedPlatformVariant") != expected_variant:
            raise PatchError("Unsupported xcframework variant: " + identifier)
        if item.get("LibraryPath") != spec["binary"]:
            raise PatchError("Unsupported xcframework library path: " + identifier)
    return libraries


def run(
    node_modules: Path,
    check_only: bool,
    report_only: bool,
    manifest_path: Path | None = None,
) -> int:
    manifest = load_manifest(manifest_path)
    for spec in manifest["libraries"]:
        validate_package_version(node_modules, spec)
        xcframework = node_modules / spec["xcframework"]
        libraries = validate_xcframework(xcframework, spec)
        for identifier, slice_spec in spec["slices"].items():
            library = xcframework / identifier / libraries[identifier]["LibraryPath"]
            # The vendor simulator build stubs some controllers, so a slice may
            # pin the smaller set of methods that actually contain code.
            symbols = slice_spec.get("symbols", spec["symbols"])
            input_hash, output_hash, changed = patch_library(
                library,
                slice_spec,
                symbols,
                report_only or check_only,
            )
            relative = library.relative_to(node_modules)
            if report_only:
                print(
                    "[" + spec["name"] + "] " + str(relative)
                    + " input sha256=" + input_hash
                    + " output sha256=" + output_hash
                )
                continue
            if check_only and changed:
                raise PatchError(
                    "["
                    + spec["name"]
                    + "] remote commands are still present in "
                    + str(relative)
                )
            state = (
                "already patched"
                if input_hash == output_hash
                else ("patched" if changed else "verified")
            )
            print("[" + spec["name"] + "] " + state + " " + str(relative))
    if check_only:
        print(
            "[JPush] Remote pasteboard, in-app, geofence, location-strategy "
            "and log-upload commands are removed"
        )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Remove remote pasteboard, in-app, geofence, location-strategy and "
            "log-upload commands from the pinned JPush/JCore iOS SDKs"
        )
    )
    parser.add_argument("node_modules", type=Path)
    parser.add_argument(
        "--manifest",
        type=Path,
        default=None,
        help="override the reviewed manifest (used by regression tests)",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--check",
        action="store_true",
        help="verify the pinned archives are already patched without writing",
    )
    mode.add_argument(
        "--report-hashes",
        action="store_true",
        help="print reviewed input/output hashes without writing",
    )
    arguments = parser.parse_args()
    try:
        return run(
            arguments.node_modules,
            arguments.check,
            arguments.report_hashes,
            arguments.manifest,
        )
    except (
        KeyError,
        OSError,
        plistlib.InvalidFileException,
        PatchError,
        struct.error,
    ) as error:
        parser.exit(1, "[JPush] Remote command removal failed: " + str(error) + "\n")


if __name__ == "__main__":
    raise SystemExit(main())
