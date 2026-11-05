const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const { build } = require('esbuild');

test('static desktop translation keys do not emit the full enum', async () => {
  const external = [
    'electron',
    'electron-log/main',
    'lodash',
    './libs/store',
    '@onekeyhq/shared/src/locale/localeJsonMap',
  ];
  const result = await build({
    stdin: {
      contents: [
        'import { ElectronTranslations, i18nText } from "./i18n";',
        'export const label = i18nText(ElectronTranslations.global_copy);',
      ].join('\n'),
      resolveDir: path.join(__dirname, '../app'),
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    target: 'node16',
    format: 'cjs',
    external,
    metafile: true,
    write: false,
  });
  const compiledModule = { exports: {} };
  vm.runInNewContext(result.outputFiles[0].text, {
    module: compiledModule,
    exports: compiledModule.exports,
    require: (name) => {
      assert.ok(external.includes(name), `Unexpected runtime import: ${name}`);
      return {};
    },
  });
  assert.equal(compiledModule.exports.label, 'global.copy');

  const enumBytes = Object.values(result.metafile.outputs).reduce(
    (total, output) =>
      total +
      Object.entries(output.inputs).reduce(
        (bytes, [source, input]) =>
          source
            .replaceAll('\\', '/')
            .endsWith('packages/shared/src/locale/enum/translations.ts')
            ? bytes + input.bytesInOutput
            : bytes,
        0,
      ),
    0,
  );
  assert.equal(
    enumBytes,
    0,
    'Static keys must not retain the translation enum',
  );
});
