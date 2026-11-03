#!/usr/bin/env python3
"""Remove Intercom 19.9.1 recording capabilities from every shipped iOS slice.

The manifest pins official input hashes, reviewed instruction edits and complete
output hashes. Unknown versions or bytes fail before any framework is modified.
This script requires only Python's standard library and Xcode's dyld_info.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import plistlib
import shutil
import stat
import struct
import subprocess
import tempfile


class MachO:

    def __init__(self, data):
        self.data = bytearray(data)
        self.commands = {}
        self.sections = {}
        self.segments = []
        if self.u32(0) != 0xFEEDFACF:
            raise ValueError('Unexpected pinned Mach-O layout')
        c = 32
        for _ in range(self.u32(16)):
            cmd, size = self.unpack('<II', c)
            if size < 8 or size % 8:
                raise ValueError('Unexpected pinned Mach-O layout')
            if cmd == 0x19:  # LC_SEGMENT_64
                name = self.data[c + 8:c + 24].split(b'\x00')[0].decode()
                vm, vs, fo, fs = self.unpack('<4Q', c + 24)
                self.segments.append((name, vm, vs, fo, fs, c))
                for si in range(self.u32(c + 64)):
                    s = c + 72 + 80 * si
                    sn = self.data[s:s + 16].split(b'\x00')[0].decode()
                    addr, sz = self.unpack('<QQ', s + 32)
                    off = self.u32(s + 48)
                    self.sections[sn] = {'header': s, 'addr': addr, 'size': sz, 'offset': off}
            elif cmd not in [0xC, 0x18, 0x80000018, 0x8000001C]:
                if cmd in self.commands:
                    raise ValueError((hex(cmd), 'duplicate non-segment command'))
            self.commands.setdefault(cmd, []).append(c)
            c += size
        if c != 32 + self.u32(20):
            raise ValueError('Unexpected pinned Mach-O layout')

    def unpack(self, fmt, o):
        return struct.unpack_from(fmt, self.data, o)

    def u32(self, o):
        return self.unpack('<I', o)[0]

    def u64(self, o):
        return self.unpack('<Q', o)[0]

    def put32(self, o, v):
        struct.pack_into('<I', self.data, o, v)

    def put64(self, o, v):
        struct.pack_into('<Q', self.data, o, v)

    def command(self, n):
        if len(self.commands[n]) != 1:
            raise ValueError('Unexpected pinned Mach-O layout')
        return self.commands[n][0]

    def cstr(self, o):
        return bytes(self.data[o:self.data.index(0, o)]).decode()

    def offset(self, addr):
        for _, va, vs, fo, fs, _ in self.segments:
            if va <= addr < va + fs:
                return fo + addr - va
        raise ValueError(('unmapped address', hex(addr)))

    def chain_info(self):
        cmd = self.command(0x80000034)  # LC_DYLD_CHAINED_FIXUPS
        f = self.u32(cmd + 8)
        ver, startsrel, imprel, symrel, count, fmt, symfmt = self.unpack('<7I', f)
        if ver != 0 or fmt != 1 or symfmt != 0:
            raise ValueError('Unexpected pinned Mach-O layout')
        imp = f + imprel
        syms = f + symrel
        records = [self.u32(imp + 4 * i) for i in range(count)]
        names = [self.cstr(syms + (v >> 9)) for v in records]
        starts = f + startsrel
        pages = []
        for si in range(self.u32(starts)):
            rel = self.u32(starts + 4 + si * 4)
            if not rel:
                continue
            c = starts + rel
            size, pgsz, pfmt, segoff, maxv, pgcount = self.unpack('<IHHQIH', c)
            if pfmt != 6:
                raise ValueError('Unexpected pinned Mach-O layout')
            for pi in range(pgcount):
                hp = c + 22 + 2 * pi
                head = self.unpack('<H', hp)[0]
                if head == 0xFFFF:
                    continue
                if head & 0x8000:
                    raise ValueError('Unexpected pinned Mach-O layout')
                page = segoff + pi * pgsz
                va = page + head
                nodes = []
                while True:
                    off = self.offset(va)
                    value = self.u64(off)
                    nodes.append((va, off, value))
                    nxt = value >> 51 & 4095
                    if not nxt:
                        break
                    va += nxt * 4
                    if va >= page + pgsz:
                        raise ValueError('Unexpected pinned Mach-O layout')
                pages.append((hp, page, nodes))
        return {'header': f, 'imp': imp, 'syms': syms, 'count': count, 'records': records, 'names': names, 'pages': pages, 'end': f + self.u32(cmd + 12)}

    @staticmethod
    def rebase(value):
        if value >> 63:
            raise ValueError('Unexpected pinned Mach-O layout')
        return (value & 0xFFFFFFFFF) | ((value >> 36 & 0xFF) << 56)

    def retire(self, imports, selectors):
        """Compact SEL rows and remove orphaned imports while preserving all VM addresses."""
        info = self.chain_info()
        original_fixups = {va: (off, v) for _, _, ns in info['pages'] for va, off, v in ns}
        removed = set()
        updates = {}
        reports = {}
        # Fill retired SEL rows from the table's tail, then shrink the real
        # section. A null row would violate dyld's prebuilt selector traversal.
        sec = self.sections['__objc_selrefs']
        if sec['size'] % 8:
            raise ValueError('Unexpected pinned Mach-O layout')
        rows = []
        for a in range(sec['addr'], sec['addr'] + sec['size'], 8):
            off, v = original_fixups[a]
            target = self.rebase(v)
            rows.append((a, off, target, self.cstr(self.offset(target))))
        targets = [r for r in rows if r[3] in selectors]
        if not ({r[3] for r in targets} == selectors and len(targets) == len(selectors)):
            raise ValueError('Unexpected pinned Mach-O layout')
        donors = rows[-len(targets):]
        if {x[0] for x in donors} & {x[0] for x in targets}:
            raise ValueError('Unexpected pinned Mach-O layout')
        moved = {}
        for target, donor in zip(targets, donors):
            a, off, ptr, name = target
            da, do, dp, dn = donor
            moved[da] = a
            updates[a] = original_fixups[da][1]
            removed.add(da)
        self.put64(sec['header'] + 40, sec['size'] - len(targets) * 8)
        relrefs = []
        methodsec = self.sections['__objc_methlist']
        # The pinned images reference these donor rows only through small
        # method-list relative names; preserve those existing methods exactly.
        for off in range(methodsec['offset'], methodsec['offset'] + methodsec['size'] - 3, 4):
            va = methodsec['addr'] + off - methodsec['offset']
            rel = self.unpack('<i', off)[0]
            if va + rel in moved:
                target = moved[va + rel]
                struct.pack_into('<i', self.data, off, target - va)
                relrefs.append((va, target))
        if not relrefs:
            raise ValueError('Unexpected pinned Mach-O layout')
        for va, (off, val) in original_fixups.items():
            if not val >> 63 and self.rebase(val) in moved:
                raise ValueError('Unexpected absolute selector donor reference')
        if '__objc_stubs' in self.sections:
            st = self.sections['__objc_stubs']
            if st['size'] % 32:
                raise ValueError('Unexpected pinned Mach-O layout')
            retired = []
            for va in range(st['addr'], st['addr'] + st['size'], 32):
                off = self.offset(va)
                a, l = self.unpack('<II', off)
                if not (a & 0x9F00001F == 0x90000001 and l & 0xFFC003FF == 0xF9400021):
                    raise ValueError('Unexpected pinned Mach-O layout')
                imm = a >> 29 & 3 | (a >> 5 & 0x7FFFF) << 2
                imm = imm - (1 << 21) if imm & 1 << 20 else imm
                row = (va & ~4095) + (imm << 12) + (l >> 10 & 4095) * 8
                if row in {r[0] for r in targets}:
                    self.data[off:off + 32] = bytes.fromhex('200020d4') + bytes.fromhex('1f2003d5') * 7
                    retired.append(va)
            if len(retired) != len(selectors):
                raise ValueError('Unexpected pinned Mach-O layout')
            text = self.sections['__text']
            for va in range(text['addr'], text['addr'] + text['size'], 4):
                word = self.u32(self.offset(va))
                if word & 0x7C000000 == 0x14000000:
                    imm = word & 0x3FFFFFF
                    imm = imm - (1 << 26) if imm & 1 << 25 else imm
                    if va + (imm << 2) in retired:
                        raise ValueError(('live branch to retired selector', hex(va)))
            reports['retired_stubs'] = retired
        for a, off, target, name in targets:
            for va, (po, val) in original_fixups.items():
                if va == a:
                    continue
                if not val >> 63 and target <= self.rebase(val) < target + len(name):
                    raise ValueError(('live selector string rebase', name, hex(va)))
            for off2 in range(methodsec['offset'], methodsec['offset'] + methodsec['size'] - 3, 4):
                va2 = methodsec['addr'] + off2 - methodsec['offset']
                rel = self.unpack('<i', off2)[0]
                if target <= va2 + rel < target + len(name):
                    raise ValueError(('live selector spelling', name))
            start = self.offset(target)
            self.data[start:start + len(name)] = bytes(len(name))
        remap = {}
        kept = []
        for i, (rec, name) in enumerate(zip(info['records'], info['names'])):
            if name not in imports:
                remap[i] = len(kept)
                kept.append((rec, name))
        if set(info['names']) & imports != imports:
            raise ValueError('Unexpected pinned Mach-O layout')
        removed_bindings = []
        for va, (off, val) in original_fixups.items():
            if val >> 63 and val & 0xFFFFFF not in remap:
                removed.add(va)
                removed_bindings.append((va, info['names'][val & 0xFFFFFF]))
        # Re-link each page around retired nodes; no removed API remains a
        # dyld binding, and surviving import ordinals follow the compact table.
        for hp, page, nodes in info['pages']:
            keptnodes = [(va, off, updates.get(va, val)) for va, off, val in nodes if va not in removed]
            struct.pack_into('<H', self.data, hp, keptnodes[0][0] - page if keptnodes else 0xFFFF)
            for i, (va, off, val) in enumerate(keptnodes):
                if val >> 63:
                    val = val & ~0xFFFFFF | remap[val & 0xFFFFFF]
                jump = (keptnodes[i + 1][0] - va) // 4 if i + 1 < len(keptnodes) else 0
                if jump >= 4096:
                    raise ValueError('Unexpected pinned Mach-O layout')
                self.put64(off, val & ~(4095 << 51) | jump << 51)
            for va, off, val in nodes:
                if va in removed:
                    self.put64(off, 0)
        self.data[info['imp']:info['syms']] = bytes(info['syms'] - info['imp'])
        pool = bytearray()
        poolmap = {}
        for i, (rec, name) in enumerate(kept):
            if name not in poolmap:
                poolmap[name] = len(pool)
                pool.extend(name.encode() + b'\x00')
            self.put32(info['imp'] + 4 * i, rec & 0x1FF | poolmap[name] << 9)
        if len(pool) > info['end'] - info['syms']:
            raise ValueError('Unexpected pinned Mach-O layout')
        self.data[info['syms']:info['end']] = pool + bytes(info['end'] - info['syms'] - len(pool))
        self.put32(info['header'] + 16, len(kept))
        self.remove_symbols(imports)
        reports.update({'removed_import_bindings': removed_bindings, 'selector_relative_refs': relrefs, 'selector_moves': moved})
        return reports

    def remove_symbols(self, names):
        """Delete real undefined nlist entries, remapping every indirect symbol index."""
        sc = self.command(0x2)  # LC_SYMTAB
        so, n, st, ss = self.unpack('<4I', sc + 8)
        entries = [bytes(self.data[so + 16 * i:so + 16 * (i + 1)]) for i in range(n)]
        oldnames = [self.cstr(st + struct.unpack_from('<I', v)[0]) for v in entries]
        mapping = {}
        new = []
        newnames = []
        removed = []
        for i, (entry, name) in enumerate(zip(entries, oldnames)):
            if name in names:
                if entry[4] & 0xE:
                    raise ValueError('Unexpected pinned Mach-O layout')
                removed.append(i)
            else:
                mapping[i] = len(new)
                new.append(bytearray(entry))
                newnames.append(name)
        if set(oldnames) & names != names:
            raise ValueError('Unexpected pinned Mach-O layout')
        dc = self.command(0xB)  # LC_DYSYMTAB
        iloc, nloc, idef, ndef, iu, nu = self.unpack('<6I', dc + 8)
        if not all((i >= iu for i in removed)):
            raise ValueError('Unexpected pinned Mach-O layout')
        self.put32(dc + 28, nu - len(removed))
        self.put32(sc + 12, len(new))
        io, ni = self.unpack('<II', dc + 56)
        for i in range(ni):
            v = self.u32(io + 4 * i)
            if v & 0xC0000000:
                continue
            # Retired GOT slots are zero local/absolute entries, not imports.
            # Their acquisition and recording callers were physically removed.
            self.put32(io + 4 * i, mapping[v] if v in mapping else 0xC0000000)
        pool = bytearray(b'\x00')
        pm = {'': 0}
        for entry, name in zip(new, newnames):
            if name not in pm:
                pm[name] = len(pool)
                pool.extend(name.encode() + b'\x00')
            struct.pack_into('<I', entry, 0, pm[name])
        if len(pool) > ss:
            raise ValueError('Unexpected pinned Mach-O layout')
        self.data[so:so + 16 * n] = b''.join(new) + bytes(16 * (n - len(new)))
        self.data[st:st + ss] = pool + bytes(ss - len(pool))

    def remove_signature(self):
        """Remove a stale trailing ad-hoc signature before the normal Xcode embed signing."""
        if 0x1D not in self.commands:  # LC_CODE_SIGNATURE
            return
        c = self.command(0x1D)
        start, size = self.unpack('<II', c + 8)
        if start + size != len(self.data):
            raise ValueError('Unexpected pinned Mach-O layout')
        self.data[c:32 + self.u32(20) - 16] = self.data[c + 16:32 + self.u32(20)]
        endcmd = 32 + self.u32(20) - 16
        self.data[endcmd:endcmd + 16] = bytes(16)
        self.put32(16, self.u32(16) - 1)
        self.put32(20, self.u32(20) - 16)
        self.data = self.data[:start]
        for name, va, vs, fo, fs, cmd in self.segments:
            if name == '__LINKEDIT':
                self.put64(cmd + 48, start - fo)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def split_fat(data):
    magic, count = struct.unpack_from('>II', data)
    if magic != 0xCAFEBABE or count != 2:
        raise ValueError('Expected the pinned two-architecture Simulator framework')
    result = []
    for index in range(count):
        cpu, subtype, offset, size, alignment = struct.unpack_from('>5I', data, 8 + 20 * index)
        expected_alignment = 12 if cpu == 0x01000007 else 14
        if alignment != expected_alignment or offset % (1 << alignment) or offset + size > len(data):
            raise ValueError('Unexpected Simulator architecture layout')
        result.append((cpu, subtype, alignment, data[offset:offset + size]))
    if {row[0] for row in result} != {0x01000007, 0x0100000C}:
        raise ValueError('Expected both x86_64 and arm64 Simulator architectures')
    return result


def join_fat(slices):
    result = bytearray(8 + 20 * len(slices))
    struct.pack_into('>II', result, 0, 0xCAFEBABE, len(slices))
    for index, (cpu, subtype, alignment, data) in enumerate(slices):
        offset = (len(result) + (1 << alignment) - 1) & ~((1 << alignment) - 1)
        result.extend(bytes(offset - len(result)))
        result.extend(data)
        struct.pack_into('>5I', result, 8 + 20 * index, cpu, subtype, offset, len(data), alignment)
    return bytes(result)


def patch_slice(data, spec, manifest):
    if digest(data) != spec['inputSha256']:
        raise ValueError('Unsupported Intercom slice SHA-256; review the new SDK before updating this patch')
    macho = MachO(data)
    if macho.u32(4) != spec['cpu']:
        raise ValueError('Intercom slice architecture does not match the pinned manifest')
    for patch in spec['patches']:
        start, end = patch['start'], patch['end']
        replacement = bytes.fromhex(patch['hex'])
        padding = b'\0' if patch.get('padding') == 'zero' else (b'\x90' if spec['cpu'] == 0x01000007 else bytes.fromhex('1f2003d5'))
        if not 0 <= start <= end <= len(data) or len(replacement) > end - start:
            raise ValueError('Invalid pinned code patch range: ' + patch['label'])
        remaining = end - start - len(replacement)
        if remaining % len(padding):
            raise ValueError('Invalid instruction alignment: ' + patch['label'])
        macho.data[start:end] = replacement + padding * (remaining // len(padding))
    macho.retire(set(manifest['imports']), set(manifest['selectors']))
    macho.remove_signature()
    output = bytes(macho.data)
    if digest(output) != spec['outputSha256']:
        raise ValueError('Intercom slice output SHA-256 does not match the reviewed result')
    return output


def validate_binary(data, directory):
    with tempfile.NamedTemporaryFile(prefix='.onekey-intercom-check-', dir=directory) as temporary:
        temporary.write(data)
        temporary.flush()
        result = subprocess.run(['xcrun', 'dyld_info', '-validate_only', temporary.name], capture_output=True, text=True, check=False)
        lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
        if result.returncode or result.stderr.strip() or any(not line.endswith(']:') for line in lines):
            raise ValueError('Apple rejected the patched Intercom Mach-O: ' + result.stdout + result.stderr)


def patch_framework(root):
    if root.is_symlink() or not root.is_dir():
        raise ValueError('Intercom.xcframework must be a real directory')
    manifest = json.loads(Path(__file__).with_suffix('.json').read_text())
    if manifest['schemaVersion'] != 1 or manifest['version'] != '19.9.1':
        raise ValueError('Unsupported Intercom patch manifest')
    info = plistlib.loads((root / 'Info.plist').read_bytes())
    libraries = {item['LibraryIdentifier']: item for item in info['AvailableLibraries']}
    if len(info['AvailableLibraries']) != 2 or set(libraries) != set(manifest['binaries']):
        raise ValueError('Unsupported Intercom XCFramework libraries')
    signatures = [root / '_CodeSignature'] + [root / name / 'Intercom.framework' / '_CodeSignature' for name in libraries]
    for signature in signatures:
        if signature.is_symlink():
            raise ValueError('Refusing to remove a linked Intercom signature')
        if signature.exists() and not signature.is_dir():
            raise ValueError('Intercom signature must be a real directory')
    prepared = []
    for identifier, spec in manifest['binaries'].items():
        item = libraries[identifier]
        if item['LibraryPath'] != 'Intercom.framework' or item['BinaryPath'] != 'Intercom.framework/Intercom':
            raise ValueError('Unsupported Intercom XCFramework library paths')
        expected_architectures = ['arm64'] if identifier == 'ios-arm64' else ['arm64', 'x86_64']
        if item['SupportedArchitectures'] != expected_architectures or item['SupportedPlatform'] != 'ios':
            raise ValueError('Unsupported Intercom XCFramework architectures')
        if item.get('SupportedPlatformVariant') != (None if identifier == 'ios-arm64' else 'simulator'):
            raise ValueError('Unsupported Intercom XCFramework platform variant')
        library = root / identifier
        framework = library / 'Intercom.framework'
        binary = framework / 'Intercom'
        plist = framework / 'Info.plist'
        if library.is_symlink() or framework.is_symlink() or binary.is_symlink() or plist.is_symlink():
            raise ValueError('Refusing to modify a linked Intercom framework')
        if not library.is_dir() or not framework.is_dir() or not binary.is_file() or not plist.is_file():
            raise ValueError('Incomplete Intercom framework directory')
        bundle = plistlib.loads(plist.read_bytes())
        if bundle.get('CFBundleExecutable') != 'Intercom' or bundle.get('CFBundleIdentifier') != 'io.intercom.com.Intercom':
            raise ValueError('Unsupported Intercom framework bundle identity')
        if bundle.get('CFBundleShortVersionString') != manifest['version'] or bundle.get('CFBundleVersion') != manifest['version']:
            raise ValueError('Expected Intercom 19.9.1; the binary patch requires a new review for an SDK upgrade')
        data = binary.read_bytes()
        actual = digest(data)
        if actual == spec['outputSha256']:
            output = data
        elif actual == spec['inputSha256']:
            if identifier == 'ios-arm64':
                output = patch_slice(data, manifest['slices']['device'], manifest)
            else:
                slices = []
                for cpu, subtype, alignment, thin in split_fat(data):
                    name = 'intel' if cpu == 0x01000007 else 'sim'
                    slices.append((cpu, subtype, alignment, patch_slice(thin, manifest['slices'][name], manifest)))
                output = join_fat(slices)
        else:
            raise ValueError('Unsupported Intercom binary SHA-256 for ' + identifier + ': ' + actual)
        if digest(output) != spec['outputSha256']:
            raise ValueError('Intercom framework output SHA-256 does not match the reviewed result')
        prepared.append((binary, output, actual != spec['outputSha256']))
    # Validate both complete binaries before replacing either source file.
    for binary, output, changed in prepared:
        validate_binary(output, binary.parent)
    for binary, output, changed in prepared:
        if changed:
            with tempfile.NamedTemporaryFile(prefix='.onekey-intercom-patch-', dir=binary.parent, delete=False) as temporary:
                temporary_path = Path(temporary.name)
                try:
                    temporary.write(output)
                    temporary.flush()
                    os.fchmod(temporary.fileno(), stat.S_IMODE(binary.stat().st_mode))
                    os.replace(temporary_path, binary)
                finally:
                    temporary_path.unlink(missing_ok=True)
    # The upstream signature covers the original SDK. Xcode's standard embed
    # phase signs the modified framework with the containing application's identity.
    for signature in signatures:
        if signature.exists():
            shutil.rmtree(signature)
    for binary, output, changed in prepared:
        print('[Intercom] 19.9.1 no-recording ' + ('patched ' if changed else 'verified ') + str(binary.relative_to(root)) + ' sha256=' + digest(output))


def main():
    parser = argparse.ArgumentParser(description='Remove recording code and voice UI from the pinned Intercom iOS SDK')
    parser.add_argument('xcframework', type=Path)
    arguments = parser.parse_args()
    try:
        patch_framework(arguments.xcframework)
    except (AssertionError, KeyError, OSError, ValueError, struct.error) as error:
        parser.exit(1, '[Intercom] Recording removal failed: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
