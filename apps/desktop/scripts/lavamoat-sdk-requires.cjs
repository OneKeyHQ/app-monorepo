// cspell:ignore LavaMoat lavamoat trezor

const fs = require('node:fs');
const path = require('node:path');

const { LavaMoatError } = require('../../../development/lavamoat/error.cjs');

function resolveTrezorBleEsmFile() {
  const name = '@onekeyfe/hwk-trezor-connector-electron-ble';
  const directory = path.resolve(
    path.dirname(require.resolve(`${name}/main`)),
    '..',
  );
  const manifest = JSON.parse(
    fs.readFileSync(path.join(directory, 'package.json'), 'utf8'),
  );
  const entry = manifest.exports?.['./main']?.import?.default;
  if (manifest.name !== name || entry !== './dist/main.mjs') {
    throw new LavaMoatError(
      'Unexpected Trezor BLE ESM export; review the native import adapter',
    );
  }
  return fs.realpathSync(path.join(directory, entry));
}

function createTrezorBleStaticRequiresPlugin({
  file = resolveTrezorBleEsmFile(),
} = {}) {
  const expectedFile = fs.realpathSync(file);
  return {
    name: 'explicit-trezor-ble-native-requires',
    setup(build) {
      build.onLoad({ filter: /[/\\]main\.mjs$/ }, (args) => {
        if (fs.realpathSync(args.path) !== expectedFile) return undefined;
        let contents = fs.readFileSync(args.path, 'utf8');
        // These are the two literal lazy imports in the shipped SDK. Making
        // them visible to Webpack preserves their package-level native grants
        // without giving the SDK an unrestricted ambient require function.
        for (const specifier of ['@stoprocent/noble', 'electron']) {
          const search = `__require(${JSON.stringify(specifier)})`;
          if (contents.split(search).length !== 2) {
            throw new LavaMoatError(
              `Unexpected Trezor BLE native import in ${args.path}: ${specifier}`,
            );
          }
          contents = contents.replace(
            search,
            `require(${JSON.stringify(specifier)})`,
          );
        }
        if (/\b__require\s*\(/.test(contents)) {
          throw new LavaMoatError(
            `Unexpected Trezor BLE dynamic native import in ${args.path}`,
          );
        }
        return { contents, loader: 'js' };
      });
    },
  };
}

module.exports = {
  createTrezorBleStaticRequiresPlugin,
  resolveTrezorBleEsmFile,
};
