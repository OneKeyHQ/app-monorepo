const path = require('path');

const outputRoot = path.resolve(__dirname, '../../build/firefox_v3');
const backgroundFiles = [
  'release-meta.js',
  'background-runtime.bundle.js',
  'background-vendor.bundle.js',
  'background.bundle.js',
];

function createOutput() {
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
    [
      'stripe.js',
      'stripe-js-v3:r.p="";webpackChunkStripeJSouter;DANGEROUS_BREAKS_ORIGIN_CHECKING_baseUrl||"https://js.stripe.com/v3/";elements-inner-payment-abc.html',
    ],
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
      filePath ===
      path.resolve(
        __dirname,
        '../../../../packages/shared/src/modules3rdParty/stripe-v3/index.js',
      )
        ? 'r.p="https://js.stripe.com/v3/";x||"https://js.stripe.com/v3/";'
        : (getSource(filePath) ?? realFs.readFileSync(filePath, ...args)),
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
});
