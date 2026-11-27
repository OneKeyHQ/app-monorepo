// cspell:ignore LavaMoat lavamoat trezor

const fs = require('node:fs');
const path = require('node:path');

const { LavaMoatError } = require('../../../development/lavamoat/error.cjs');

function resolveDesktopNobleBleEsmFile() {
  const name = '@onekeyfe/hwk-desktop-noble-ble';
  const directory = path.resolve(path.dirname(require.resolve(name)), '..');
  const manifest = JSON.parse(
    fs.readFileSync(path.join(directory, 'package.json'), 'utf8'),
  );
  const entry = manifest.exports?.['.']?.import?.default;
  if (manifest.name !== name || entry !== './dist/index.mjs') {
    throw new LavaMoatError(
      'Unexpected desktop Noble BLE ESM export; review the native import adapter',
    );
  }
  return fs.realpathSync(path.join(directory, entry));
}

function createDesktopNobleBleStaticRequiresPlugin({
  file = resolveDesktopNobleBleEsmFile(),
} = {}) {
  const expectedFile = fs.realpathSync(file);
  return {
    name: 'explicit-desktop-noble-ble-native-requires',
    setup(build) {
      build.onLoad({ filter: /[/\\]index\.mjs$/ }, (args) => {
        if (fs.realpathSync(args.path) !== expectedFile) return undefined;
        let contents = fs.readFileSync(args.path, 'utf8');
        // These are the two literal lazy imports in the shipped SDK. Making
        // them visible to Webpack preserves their package-level native grants
        // without giving the SDK an unrestricted ambient require function.
        for (const specifier of ['@stoprocent/noble', 'electron']) {
          const search = `__require(${JSON.stringify(specifier)})`;
          if (contents.split(search).length !== 2) {
            throw new LavaMoatError(
              `Unexpected desktop Noble BLE native import in ${args.path}: ${specifier}`,
            );
          }
          contents = contents.replace(
            search,
            `require(${JSON.stringify(specifier)})`,
          );
        }
        if (/\b__require\s*\(/.test(contents)) {
          throw new LavaMoatError(
            `Unexpected desktop Noble BLE dynamic native import in ${args.path}`,
          );
        }
        return { contents, loader: 'js' };
      });
    },
  };
}

module.exports = {
  createDesktopNobleBleStaticRequiresPlugin,
  resolveDesktopNobleBleEsmFile,
};
