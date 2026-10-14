// cspell:ignore MDMP
// A synthetic MDMP with an exception, two frames, and deliberately sensitive
// text in an unknown stream, module-name/PDB areas, and adjacent stack memory.
export function makeSyntheticDump(cpu = 9, platform = 2): Buffer {
  const dump = Buffer.alloc(2048);
  dump.writeUInt32LE(0x50_4d_44_4d, 0);
  dump.writeUInt32LE(0xa7_93, 4);
  dump.writeUInt32LE(5, 8);
  dump.writeUInt32LE(32, 12);
  [
    [7, 56, 100],
    [6, 168, 200],
    [4, 112, 400],
    [3, 52, 600],
    [0x47_67_00_01, 64, 1700],
  ].forEach(([type, size, rva], index) => {
    dump.writeUInt32LE(type, 32 + index * 12);
    dump.writeUInt32LE(size, 36 + index * 12);
    dump.writeUInt32LE(rva, 40 + index * 12);
  });
  dump.writeUInt16LE(cpu, 100);
  dump.writeUInt32LE(platform, 120);
  dump.writeUInt32LE(42, 200);
  dump.writeUInt32LE(0xc0_00_00_05, 208);
  dump.writeUInt32LE(272, 360);
  dump.writeUInt32LE(800, 364);
  dump.writeUInt32LE(1, 400);
  dump.writeBigUInt64LE(0x10_00_00n, 404);
  dump.writeUInt32LE(0x1_00_00, 412);
  dump.writeUInt32LE(1_234_567, 420);
  dump.writeUInt32LE(1500, 424);
  dump.writeUInt32LE(0xfe_ef_04_bd, 428);
  dump.writeUInt32LE(0x1_00_00, 432);
  dump.writeUInt32LE(0x1_00_02, 436);
  dump.writeUInt32LE(0x3_00_04, 440);
  dump.writeUInt32LE(80, 480);
  dump.writeUInt32LE(1600, 484);
  dump.writeUInt32LE(0x53_44_53_52, 1600);
  dump.fill(0x33, 1604, 1620);
  dump.writeUInt32LE(1, 1620);
  const secret = 'wallet-secret:/Users/private?token=SECRET-SEED';
  dump.write(secret, 1500);
  dump.write(secret, 1624);
  dump.write(secret, 1700);
  dump.writeUInt32LE(1, 600);
  dump.writeUInt32LE(42, 604);
  dump.writeBigUInt64LE(0x20_00_00n, 628);
  dump.writeUInt32LE(128, 636);
  dump.writeUInt32LE(1200, 640);
  if (cpu === 9) {
    dump.writeUInt32LE(0x10_00_03, 848);
    dump.writeBigUInt64LE(0x20_00_00n, 952);
    dump.writeBigUInt64LE(0x20_00_00n, 960);
    dump.writeBigUInt64LE(0x10_01_00n, 1048);
  } else {
    dump.writeUInt32LE(0x40_00_03, 800);
    dump.writeBigUInt64LE(0x20_00_00n, 1040);
    dump.writeBigUInt64LE(0x20_00_00n, 1056);
    dump.writeBigUInt64LE(0x10_01_00n, 1064);
  }
  dump.writeBigUInt64LE(0x20_00_20n, 1200);
  dump.writeBigUInt64LE(0x10_02_00n, 1208);
  dump.write(secret, 1240);
  return dump;
}
