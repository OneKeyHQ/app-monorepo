const fs = require('fs');

function findTable(buf, tableTag) {
  const numTables = buf.readUInt16BE(4);
  for (let i = 0; i < numTables; i += 1) {
    const tag = buf.toString('ascii', 12 + i * 16, 12 + i * 16 + 4);
    if (tag === tableTag) {
      return buf.readUInt32BE(12 + i * 16 + 8);
    }
  }
  return 0;
}

// Reads a name table string, preferring Windows Unicode (UTF-16BE) records.
function getNameString(ttfPath, targetNameID) {
  const buf = fs.readFileSync(ttfPath);
  const nameTableOffset = findTable(buf, 'name');
  if (!nameTableOffset) return null;

  const count = buf.readUInt16BE(nameTableOffset + 2);
  const stringOffset = buf.readUInt16BE(nameTableOffset + 4);
  const readRecord = (i) => {
    const recordOffset = nameTableOffset + 6 + i * 12;
    const start =
      nameTableOffset + stringOffset + buf.readUInt16BE(recordOffset + 10);
    return {
      platformID: buf.readUInt16BE(recordOffset),
      encodingID: buf.readUInt16BE(recordOffset + 2),
      nameID: buf.readUInt16BE(recordOffset + 6),
      bytes: buf.subarray(start, start + buf.readUInt16BE(recordOffset + 8)),
    };
  };

  // Prefer platformID 3 (Windows) encodingID 1 (Unicode BMP, UTF-16BE).
  for (let i = 0; i < count; i += 1) {
    const r = readRecord(i);
    if (r.nameID === targetNameID && r.platformID === 3 && r.encodingID === 1) {
      let result = '';
      for (let j = 0; j < r.bytes.length; j += 2) {
        result += String.fromCharCode(r.bytes.readUInt16BE(j));
      }
      return result;
    }
  }
  // Fallback: platformID 1 (Macintosh, ASCII).
  for (let i = 0; i < count; i += 1) {
    const r = readRecord(i);
    if (r.nameID === targetNameID && r.platformID === 1) {
      return r.bytes.toString('ascii');
    }
  }
  return null;
}

// PostScript name (nameID=6); iOS UIAppFonts registers faces by it.
function getPostScriptName(ttfPath) {
  return getNameString(ttfPath, 6);
}

// License description (nameID=13).
function getLicenseDescription(ttfPath) {
  return getNameString(ttfPath, 13);
}

// OS/2 usWeightClass, e.g. 400 for Regular and 700 for Bold.
function getWeightClass(ttfPath) {
  const buf = fs.readFileSync(ttfPath);
  const os2Offset = findTable(buf, 'OS/2');
  return os2Offset ? buf.readUInt16BE(os2Offset + 4) : null;
}

module.exports = {
  getLicenseDescription,
  getPostScriptName,
  getWeightClass,
};
