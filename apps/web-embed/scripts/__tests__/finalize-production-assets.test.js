const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  assertNoDeadKaspaWasmBinaries,
  collectDeadKaspaWasmBinaries,
} = require('../finalize-production-assets');

describe('web-embed dead Kaspa wasm binary guard', () => {
  let directory;

  beforeEach(() => {
    directory = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-web-embed-finalize-')),
    );
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('rejects a build that emitted kaspa_bg.wasm.bin', () => {
    const mediaDirectory = path.join(directory, 'static/media');
    fs.mkdirSync(mediaDirectory, { recursive: true });
    const deadBinary = path.join(
      mediaDirectory,
      'web-embed.kaspa_bg.wasm.d8e34999ff3dfd02.bin',
    );
    fs.writeFileSync(deadBinary, 'wasm');

    expect(collectDeadKaspaWasmBinaries(directory)).toEqual([deadBinary]);
    expect(() => assertNoDeadKaspaWasmBinaries(directory)).toThrow(
      /dead Kaspa wasm binary/,
    );
  });

  it('accepts a build that only carries the base64 kaspa_bg.wasm.js', () => {
    const mediaDirectory = path.join(directory, 'static/media');
    fs.mkdirSync(mediaDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(mediaDirectory, 'web-embed.kaspa_bg.wasm.d8e34999ff3dfd02.js'),
      'base64',
    );

    expect(collectDeadKaspaWasmBinaries(directory)).toEqual([]);
    expect(() => assertNoDeadKaspaWasmBinaries(directory)).not.toThrow();
  });

  it('is a no-op when the build directory does not exist', () => {
    expect(
      collectDeadKaspaWasmBinaries(path.join(directory, 'missing')),
    ).toEqual([]);
    expect(() =>
      assertNoDeadKaspaWasmBinaries(path.join(directory, 'missing')),
    ).not.toThrow();
  });
});
