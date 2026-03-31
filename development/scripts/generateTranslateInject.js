const fs = require('fs');
const path = require('path');

const srcPath = path.resolve(
  __dirname,
  '../../packages/kit/src/components/WebView/translateInject.text-js',
);
const destPath = path.resolve(
  __dirname,
  '../../packages/kit/src/components/WebView/translateInjectCode.ts',
);

const content = fs.readFileSync(srcPath, 'utf-8');
const tsContent = `// AUTO-GENERATED from translateInject.text-js — do not edit directly\n// Run: node development/scripts/generateTranslateInject.js\nexport default ${JSON.stringify(content)};\n`;

const existing = fs.existsSync(destPath)
  ? fs.readFileSync(destPath, 'utf-8')
  : '';
if (existing !== tsContent) {
  fs.writeFileSync(destPath, tsContent);
  const version = (content.match(/VERSION = '([^']+)'/) || [])[1];
  console.log(
    `[generateTranslateInject] Updated translateInjectCode.ts (v${version})`,
  );
} else {
  console.log('[generateTranslateInject] translateInjectCode.ts is up to date');
}
