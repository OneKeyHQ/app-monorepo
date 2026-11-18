const fs = require('fs');
const path = require('path');

for (const [arch, machine] of [
  ['x64', 0x86_64],
  ['arm64', 0xaa_64],
]) {
  const file = path.join(
    __dirname,
    '..',
    'public/static/bin/ble-pair',
    `win-${arch}`,
    'onekey-ble-pair.exe',
  );
  const bytes = fs.readFileSync(file);
  const pe = bytes.readUInt32LE(0x3c);
  if (
    bytes.toString('ascii', 0, 2) !== 'MZ' ||
    bytes.readUInt32LE(pe) !== 0x00_00_45_50 ||
    bytes.readUInt16LE(pe + 4) !== machine
  ) {
    process.stderr.write(`Invalid Windows pairing helper for ${arch}\n`);
    process.exit(1);
  }
}
