const path = require('path');

const outputRoot = path.resolve(__dirname, '../../build/firefox_v3');
const backgroundFiles = [
  'release-meta.js',
  'background-runtime.bundle.js',
  'background-vendor.bundle.js',
  'background.bundle.js',
];

function createOutput() {
  const vendoredRuntime = (filename) =>
    jest
      .requireActual('fs')
      .readFileSync(
        path.resolve(
          __dirname,
          '../../../../packages/shared/src/modules3rdParty/stripe-v3',
          filename,
        ),
        'utf8',
      )
      .replace(/(\.p\s*=\s*)(["'])https:\/\/js\.stripe\.com\/v3\/\2/g, '$1$2$2')
      .replaceAll('https://maps.googleapis.com/maps/api/js', '');
  const sources = new Map([
    ['release-meta.js', 'globalThis.__ONEKEY_RELEASE_ENV__={};'],
    ['background-runtime.bundle.js', 'rspackChunkonekey_ext_background'],
    ['background.bundle.js', 'rspackChunkonekey_ext_background'],
    ['background-vendor.bundle.js', '/* background vendor */'],
    [
      'content-script-runtime.bundle.js',
      'rspackChunkonekey_ext_content_script',
    ],
    ['content-script.bundle.js', 'rspackChunkonekey_ext_content_script'],
    ['preload-html-head.js', '/* preload */'],
    ['extra.js', '/* extra background code */'.repeat(20)],
    ['stripe.js', vendoredRuntime('index.js')],
    ['stripe-faulty.js', vendoredRuntime('faulty-before-13914.js')],
    [
      'manifest.json',
      JSON.stringify({
        manifest_version: 2,
        background: { page: 'background.html' },
        content_scripts: [
          {
            js: [
              'release-meta.js',
              'content-script-runtime.bundle.js',
              'content-script-vendor.bundle.js',
              'content-script.bundle.js',
            ],
          },
        ],
      }),
    ],
    ['content-script-vendor.bundle.js', '/* content script vendor */'],
  ]);
  const scripts = [
    backgroundFiles[0],
    'preload-html-head.js?v=1',
    ...backgroundFiles.slice(1),
    'extra.js?v=1',
    'extra.js?v=2#cached',
  ];
  sources.set(
    'background.html',
    scripts.map((file) => `<script src="/${file}"></script>`).join(''),
  );
  const baselineBytes = [...backgroundFiles, 'preload-html-head.js'].reduce(
    (total, file) => total + Buffer.byteLength(sources.get(file)),
    0,
  );
  return {
    sources,
    baselineBytes,
    extraBytes: Buffer.byteLength(sources.get('extra.js')),
  };
}

function runCheck(sources, budget) {
  const realFs = jest.requireActual('fs');
  const getSource = (filePath) =>
    sources.get(path.relative(outputRoot, filePath));
  jest.doMock('fs', () => ({
    ...realFs,
    existsSync: (filePath) =>
      getSource(filePath) !== undefined || realFs.existsSync(filePath),
    readFileSync: (filePath, ...args) =>
      getSource(filePath) ?? realFs.readFileSync(filePath, ...args),
    statSync: (filePath) =>
      getSource(filePath) === undefined
        ? realFs.statSync(filePath)
        : { size: Buffer.byteLength(getSource(filePath)) },
    readdirSync: (directory, options) =>
      directory === outputRoot
        ? [...sources.keys()].map((name) => ({
            name,
            isFile: () => true,
            isDirectory: () => false,
          }))
        : realFs.readdirSync(directory, options),
  }));
  process.argv = ['node', 'check-build-output.js', '--browser', 'firefox'];
  process.env.EXT_BUILD_MAX_BACKGROUND_BYTES = String(budget);
  jest.isolateModules(() => require('../check-build-output'));
}

describe('Firefox background entrypoint budget', () => {
  let originalArgv;
  let originalBudget;
  let log;

  beforeEach(() => {
    originalArgv = process.argv;
    originalBudget = process.env.EXT_BUILD_MAX_BACKGROUND_BYTES;
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    if (originalBudget === undefined)
      delete process.env.EXT_BUILD_MAX_BACKGROUND_BYTES;
    else process.env.EXT_BUILD_MAX_BACKGROUND_BYTES = originalBudget;
    log.mockRestore();
    jest.dontMock('fs');
  });

  it('counts preload and extra scripts once after removing URL queries and fragments', () => {
    const { sources, baselineBytes, extraBytes } = createOutput();
    runCheck(sources, baselineBytes + extraBytes);
    const summary = JSON.parse(log.mock.calls[0][0]);
    expect(summary.backgroundBytes).toBe(baselineBytes + extraBytes);
  });

  it('rejects an extra script that exceeds the background budget', () => {
    const { sources, baselineBytes, extraBytes } = createOutput();
    expect(() => runCheck(sources, baselineBytes + extraBytes - 1)).toThrow(
      'Background entrypoint exceeds size budget',
    );
  });

  it('validates both the current and historical vendored Stripe runtimes', () => {
    const { sources, baselineBytes, extraBytes } = createOutput();
    expect(() => runCheck(sources, baselineBytes + extraBytes)).not.toThrow();
  });

  it.each(['stripe.js', 'stripe-faulty.js'])(
    'requires the supported runtime %s to be present',
    (filename) => {
      const { sources } = createOutput();
      sources.delete(filename);
      expect(() => runCheck(sources, Number.MAX_SAFE_INTEGER)).toThrow(
        'Missing vendored Stripe v3 runtime',
      );
    },
  );

  it('rejects duplicate runtimes instead of accepting an arbitrary runtime count', () => {
    const { sources } = createOutput();
    sources.set('duplicate-stripe.js', sources.get('stripe.js'));
    expect(() => runCheck(sources, Number.MAX_SAFE_INTEGER)).toThrow(
      'Duplicate vendored Stripe v3 runtime',
    );
  });

  it('rejects an unknown runtime version', () => {
    const { sources } = createOutput();
    sources.set(
      'stripe-faulty.js',
      sources
        .get('stripe-faulty.js')
        .replaceAll(
          /elements-inner-payment-[a-f0-9]+\.html/g,
          'elements-inner-payment-bad.html',
        ),
    );
    expect(() => runCheck(sources, Number.MAX_SAFE_INTEGER)).toThrow(
      'Unknown vendored Stripe v3 runtime',
    );
  });

  it.each(['stripe.js', 'stripe-faulty.js'])(
    'rejects a remote webpack public path in %s',
    (filename) => {
      const { sources } = createOutput();
      sources.set(
        filename,
        sources
          .get(filename)
          .replace(/\.p\s*=\s*(["'])\1/, '.p="https://js.stripe.com/v3/"'),
      );
      expect(() => runCheck(sources, Number.MAX_SAFE_INTEGER)).toThrow(
        'Stripe v3 webpack public path must be empty',
      );
    },
  );

  it('rejects a locally emitted payment iframe for the historical runtime', () => {
    const { sources } = createOutput();
    sources.set(
      'elements-inner-payment-0eb8f51ef43e813487d91f6e011d427f.html',
      '<html></html>',
    );
    expect(() => runCheck(sources, Number.MAX_SAFE_INTEGER)).toThrow(
      'Stripe v3 payment iframe must remain remote',
    );
  });

  it('rejects unexpected Stripe remote URLs outside the known runtimes', () => {
    const { sources } = createOutput();
    sources.set('unexpected.js', '"https://js.stripe.com/v3/remote.js"');
    expect(() => runCheck(sources, Number.MAX_SAFE_INTEGER)).toThrow(
      'Unexpected Stripe v3 remote URL',
    );
  });

  it.each(['stripe.js', 'stripe-faulty.js'])(
    'still rejects forbidden remote-code references in %s',
    (filename) => {
      const { sources } = createOutput();
      sources.set(
        filename,
        `${sources.get(filename)};"https://maps.googleapis.com/maps/api/js"`,
      );
      expect(() => runCheck(sources, Number.MAX_SAFE_INTEGER)).toThrow(
        'Forbidden remote-code reference',
      );
    },
  );
});
