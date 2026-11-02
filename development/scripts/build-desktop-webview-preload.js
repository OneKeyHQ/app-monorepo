const fs = require('fs');
const path = require('path');

const { buildSync } = require('esbuild');

function buildDesktopWebviewPreload(providerSource) {
  const result = buildSync({
    entryPoints: [
      path.join(__dirname, '../../apps/desktop/rendererPreload/captcha.ts'),
    ],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'iife',
    globalName: 'onekeyCaptchaPreload',
    target: 'es2020',
    external: ['electron'],
  });
  return `(function () {\n${result.outputFiles[0].text}\nif (onekeyCaptchaPreload.installCaptchaBridge()) return;\n${providerSource}\n})();\n`;
}

function writeDesktopWebviewPreload() {
  const root = path.join(__dirname, '../..');
  const source = fs.readFileSync(
    path.join(
      root,
      'node_modules/@onekeyfe/cross-inpage-provider-injected/dist/injected/injectedDesktopPreload.js',
    ),
    'utf8',
  );
  fs.writeFileSync(
    path.join(root, 'apps/desktop/public/static/preload.js'),
    buildDesktopWebviewPreload(source),
  );
}

module.exports = { buildDesktopWebviewPreload, writeDesktopWebviewPreload };

if (require.main === module) {
  writeDesktopWebviewPreload();
}
