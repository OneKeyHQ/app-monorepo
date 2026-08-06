import assert from 'node:assert/strict';
import test from 'node:test';

process.env.FIRMWARE_CATALOG_SKIP_MAIN = '1';

const { assertHttpsUrl, collectReleaseUrls, selectConfig } =
  await import('./generateFirmwareCatalog.mjs');

function createStableManifest() {
  const fieldsByModel = {
    classic: ['firmware', 'firmware-v2', 'firmware-v8', 'ble'],
    classic1s: ['firmware-v8', 'firmware-btc-v8', 'ble'],
    classicpure: ['firmware-v8', 'firmware-btc-v8', 'ble'],
    mini: ['firmware', 'firmware-v2', 'firmware-v8'],
    touch: ['firmware-v8', 'ble'],
    pro: ['firmware-v8', 'firmware-btc-v8', 'ble'],
  };
  return Object.fromEntries(
    Object.entries(fieldsByModel).map(([model, fields]) => [
      model,
      Object.fromEntries(
        fields.map((field, index) => [
          field,
          [
            {
              version: [1, 0, index],
              url: `https://firmware.onekey.test/${model}/${field}.bin`,
            },
          ],
        ]),
      ),
    ]),
  );
}

test('accepts only plain HTTPS artifact URLs', () => {
  assert.equal(
    assertHttpsUrl('https://firmware.onekey.test/firmware.bin', 'artifact'),
    'https://firmware.onekey.test/firmware.bin',
  );
  assert.throws(
    () =>
      assertHttpsUrl('http://firmware.onekey.test/firmware.bin', 'artifact'),
    /plain HTTPS URL/,
  );
  assert.throws(() => assertHttpsUrl('', 'artifact'), /non-empty URL/);
});

test('treats empty optional URLs as absent', () => {
  assert.deepEqual(
    collectReleaseUrls(
      {
        version: [1, 0, 0],
        url: 'https://firmware.onekey.test/firmware.bin',
        resource: '',
      },
      'firmware',
    ),
    [
      {
        url: 'https://firmware.onekey.test/firmware.bin',
        role: 'firmware',
        logicalName: undefined,
      },
    ],
  );
});

test('uses protocol V2 components instead of the release URL alias', () => {
  const url = 'https://firmware.onekey.test/application-p1.okpkg';
  assert.deepEqual(
    collectReleaseUrls(
      {
        version: [1, 0, 0],
        url,
        components: {
          applicationP1: { url },
        },
      },
      'firmware-v1',
    ),
    [
      {
        url,
        role: 'component',
        logicalName: 'applicationP1',
      },
    ],
  );
});

test('rejects duplicate releases in one device field', () => {
  const manifest = createStableManifest();
  manifest.classic.firmware.push({
    version: [1, 0, 0],
    url: 'https://firmware.onekey.test/classic/duplicate.bin',
  });
  assert.throws(() => selectConfig(manifest, 'stable'), /duplicate release/);
});

test('rejects one URL assigned to conflicting artifact roles', () => {
  const manifest = createStableManifest();
  manifest.classic.ble[0].url = manifest.classic.firmware[0].url;
  assert.throws(() => selectConfig(manifest, 'stable'), /conflicting roles/);
});
