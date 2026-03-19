// Font consistency check
//
// iOS can unload custom fonts registered at runtime (via CTFontManagerRegisterGraphicsFont)
// under memory pressure when the app is backgrounded. To prevent this, we register fonts
// natively via Info.plist UIAppFonts, which lets iOS manage font lifecycle and auto-restore
// them after memory purge.
//
// This lint script ensures all three font registration points stay in sync:
//   1. useLoadCustomFonts.ts — runtime font loading (expo-font, source of truth)
//   2. Info.plist UIAppFonts — native iOS font registration
//   3. Podfile font_files   — copies font files into the Xcode project during pod install
//
// It also verifies that each font file's internal PostScript name matches the JS key used
// by expo-font, because iOS UIAppFonts registers fonts by PostScript name. A mismatch would
// cause the native-registered font and the expo-font-registered font to have different names,
// making the native registration ineffective.

const path = require('path');
const fs = require('fs');
const { exit } = require('process');

const getTimestamp = () => new Date().toLocaleTimeString();
const startTime = Date.now();

console.log(`[${getTimestamp()}] Font consistency check started...`);

const rootDir = path.resolve(__dirname, '../..');

// Source of truth: useLoadCustomFonts.ts (the fonts actually used at runtime)
const useLoadCustomFontsPath = path.join(
  rootDir,
  'packages/components/src/hocs/Provider/hooks/useLoadCustomFonts.ts',
);
const fontsSrcDir = path.join(
  rootDir,
  'packages/components/src/hocs/Provider/fonts',
);
const infoPlistPath = path.join(
  rootDir,
  'apps/mobile/ios/OneKeyWallet/Info.plist',
);
const podfilePath = path.join(rootDir, 'apps/mobile/ios/Podfile');

let hasError = false;

function error(msg) {
  console.error(`  ✖ ${msg}`);
  hasError = true;
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

// Parse PostScript name (nameID=6) from a TTF file's name table
function getPostScriptName(ttfPath) {
  const buf = fs.readFileSync(ttfPath);
  const numTables = buf.readUInt16BE(4);

  // Find 'name' table
  let nameTableOffset = 0;
  for (let i = 0; i < numTables; i += 1) {
    const tag = buf.toString('ascii', 12 + i * 16, 12 + i * 16 + 4);
    if (tag === 'name') {
      nameTableOffset = buf.readUInt32BE(12 + i * 16 + 8);
      break;
    }
  }
  if (!nameTableOffset) return null;

  const count = buf.readUInt16BE(nameTableOffset + 2);
  const stringOffset = buf.readUInt16BE(nameTableOffset + 4);

  for (let i = 0; i < count; i += 1) {
    const recordOffset = nameTableOffset + 6 + i * 12;
    const platformID = buf.readUInt16BE(recordOffset);
    const encodingID = buf.readUInt16BE(recordOffset + 2);
    const nameID = buf.readUInt16BE(recordOffset + 6);
    const length = buf.readUInt16BE(recordOffset + 8);
    const offset = buf.readUInt16BE(recordOffset + 10);

    // nameID 6 = PostScript name, prefer platformID 3 (Windows) encodingID 1 (Unicode BMP)
    if (nameID === 6 && platformID === 3 && encodingID === 1) {
      const strBuf = buf.slice(
        nameTableOffset + stringOffset + offset,
        nameTableOffset + stringOffset + offset + length,
      );
      // UTF-16BE decoding
      let result = '';
      for (let j = 0; j < strBuf.length; j += 2) {
        result += String.fromCharCode(strBuf.readUInt16BE(j));
      }
      return result;
    }
  }

  // Fallback: try platformID 1 (Macintosh)
  for (let i = 0; i < count; i += 1) {
    const recordOffset = nameTableOffset + 6 + i * 12;
    const platformID = buf.readUInt16BE(recordOffset);
    const nameID = buf.readUInt16BE(recordOffset + 6);
    const length = buf.readUInt16BE(recordOffset + 8);
    const offset = buf.readUInt16BE(recordOffset + 10);

    if (nameID === 6 && platformID === 1) {
      return buf.toString(
        'ascii',
        nameTableOffset + stringOffset + offset,
        nameTableOffset + stringOffset + offset + length,
      );
    }
  }

  return null;
}

// 1. Extract registered fonts from useLoadCustomFonts.ts: { jsKey -> fileName }
const useLoadContent = fs.readFileSync(useLoadCustomFontsPath, 'utf-8');
const fontEntryPattern = /'([^']+)':\s*require\('\.\.\/fonts\/([^']+\.ttf)'\)/g;
const fontEntries = []; // { jsKey, fileName }
let match;
while ((match = fontEntryPattern.exec(useLoadContent)) !== null) {
  fontEntries.push({ jsKey: match[1], fileName: match[2] });
}
fontEntries.sort((a, b) => a.fileName.localeCompare(b.fileName));

if (fontEntries.length === 0) {
  error('No fonts found in useLoadCustomFonts.ts');
  exit(1);
}

const registeredFonts = fontEntries.map((e) => e.fileName);

console.log(
  `\nSource of truth: ${fontEntries.length} fonts registered in useLoadCustomFonts.ts`,
);

// 2. Check font files exist on disk + JS key matches PostScript name
console.log('\nChecking font files and PostScript name consistency...');
for (const { jsKey, fileName } of fontEntries) {
  const filePath = path.join(fontsSrcDir, fileName);
  if (!fs.existsSync(filePath)) {
    error(
      `${fileName} registered in useLoadCustomFonts.ts but file is MISSING`,
    );
  } else {
    ok(`${fileName} exists`);

    const psName = getPostScriptName(filePath);
    if (!psName) {
      error(`${fileName} could not read PostScript name from font file`);
    } else if (psName !== jsKey) {
      error(
        `${fileName} PostScript name "${psName}" does NOT match JS key "${jsKey}" — iOS UIAppFonts will register as "${psName}" but expo-font uses "${jsKey}"`,
      );
    } else {
      ok(`${fileName} PostScript name "${psName}" matches JS key`);
    }
  }
}

// 3. Check Info.plist UIAppFonts
console.log('\nChecking Info.plist UIAppFonts...');
const plistContent = fs.readFileSync(infoPlistPath, 'utf-8');
const uiAppFontsMatch = plistContent.match(
  /<key>UIAppFonts<\/key>\s*<array>([\s\S]*?)<\/array>/,
);

if (!uiAppFontsMatch) {
  error('UIAppFonts key not found in Info.plist');
} else {
  const stringPattern = /<string>([^<]+)<\/string>/g;
  const plistFonts = [];
  let m;
  while ((m = stringPattern.exec(uiAppFontsMatch[1])) !== null) {
    plistFonts.push(m[1]);
  }

  for (const fontFile of registeredFonts) {
    if (plistFonts.includes(fontFile)) {
      ok(`${fontFile} declared in UIAppFonts`);
    } else {
      error(`${fontFile} MISSING from Info.plist UIAppFonts`);
    }
  }

  for (const plistFont of plistFonts) {
    if (!registeredFonts.includes(plistFont)) {
      error(
        `${plistFont} in Info.plist UIAppFonts but not registered in useLoadCustomFonts.ts`,
      );
    }
  }
}

// 4. Check Podfile font_files list
console.log('\nChecking Podfile font_files...');
const podfileContent = fs.readFileSync(podfilePath, 'utf-8');
const podfileFontMatch = podfileContent.match(
  /font_files\s*=\s*%w\[([^\]]+)\]/,
);

if (!podfileFontMatch) {
  error('font_files list not found in Podfile');
} else {
  const podfileFonts = podfileFontMatch[1].trim().split(/\s+/);

  for (const fontFile of registeredFonts) {
    if (podfileFonts.includes(fontFile)) {
      ok(`${fontFile} listed in Podfile`);
    } else {
      error(`${fontFile} MISSING from Podfile font_files`);
    }
  }

  for (const podFont of podfileFonts) {
    if (!registeredFonts.includes(podFont)) {
      error(
        `${podFont} in Podfile font_files but not registered in useLoadCustomFonts.ts`,
      );
    }
  }
}

// Summary
const duration = ((Date.now() - startTime) / 1000).toFixed(2);
console.log('');

if (hasError) {
  console.error(
    `[${getTimestamp()}] Font consistency check FAILED. (${duration}s)`,
  );
  console.error('\nAll fonts in useLoadCustomFonts.ts must:');
  console.error(
    "  1. Have a JS key that matches the font file's PostScript name",
  );
  console.error('  2. Be declared in Info.plist UIAppFonts');
  console.error('  3. Be listed in Podfile font_files');
  exit(1);
} else {
  console.log(
    `[${getTimestamp()}] Font consistency check passed. (${duration}s)`,
  );
}
