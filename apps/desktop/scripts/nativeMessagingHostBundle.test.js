const path = require('path');

const { build } = require('esbuild');

const {
  electronSource,
  getDesktopMainEsbuildResolveOptions,
} = require('./desktopMainEsbuildConfig');

// Smoke check for the experimental desktop Native Messaging host.
//
// `appBootstrap.ts` (the desktop main entry → dist/app.js) reaches the host only
// through a dynamic `import('./nativeMessagingHost')` guarded by
// `process.env.NODE_ENV !== 'production'`, and the host pulls in its safeStorage
// crypto helper (`nativeMessagingSafeStorage.ts`). The feature is dev-only, so
// the design has two halves that this test pins down by bundling
// `appBootstrap.ts` with the exact resolution config the shipped bundle uses
// (shared via desktopMainEsbuildConfig.js):
//
//  1. Dev build (NODE_ENV !== 'production'): the host branch MUST resolve and be
//     present. Otherwise an unresolvable import in the host chain would only
//     surface at runtime as Chrome reporting "native host has exited", never as
//     a build failure — because the host is loaded via a dynamic import.
//  2. Production build (NODE_ENV === 'production'): the host branch MUST be
//     dead-code-eliminated out entirely, so the safeStorage crypto never ships
//     in a production bundle (build-time defense in depth on top of the
//     dev-gated manifest install and the host's own runtime guard).

// safeStorage crypto exports — these only appear when the host module is
// actually bundled (unlike `runDesktopNativeMessagingHost`, whose name lingers
// in the `if (false)` dead-code stub of the production build).
const HOST_CRYPTO_SYMBOLS = [
  'encryptDesktopSafeStorageString',
  'decryptDesktopSafeStorageString',
];

const HOST_BRANCH_INPUT_SUFFIXES = [
  'apps/desktop/app/nativeMessagingHost.ts',
  'apps/desktop/app/nativeMessagingSafeStorage.ts',
];

async function bundleAppEntry(nodeEnv) {
  // If any import in the host branch is unresolvable, esbuild rejects here with
  // a descriptive "Could not resolve ..." error and the test fails — no manual
  // re-throw needed (and `throw new Error` is banned by lint anyway).
  const result = await build({
    ...getDesktopMainEsbuildResolveOptions(),
    entryPoints: [path.join(electronSource, 'appBootstrap.ts')],
    write: false,
    metafile: true,
    logLevel: 'silent',
    // Mirror build.js, which defines process.env.NODE_ENV so esbuild can fold
    // the dev-only guard at build time.
    define: { 'process.env.NODE_ENV': JSON.stringify(nodeEnv) },
  });
  return {
    inputs: Object.keys(result.metafile.inputs),
    code: result.outputFiles
      .map((file) => Buffer.from(file.contents).toString('utf8'))
      .join('\n'),
  };
}

describe('desktop native messaging host bundling', () => {
  jest.setTimeout(120 * 1000);

  it('includes the host branch in a development bundle', async () => {
    const { inputs, code } = await bundleAppEntry('development');

    HOST_BRANCH_INPUT_SUFFIXES.forEach((suffix) => {
      expect(inputs.some((input) => input.endsWith(suffix))).toBe(true);
    });
    HOST_CRYPTO_SYMBOLS.forEach((symbol) => {
      expect(code).toContain(symbol);
    });
  });

  it('excludes the host branch from a production bundle', async () => {
    const { inputs, code } = await bundleAppEntry('production');

    HOST_BRANCH_INPUT_SUFFIXES.forEach((suffix) => {
      expect(inputs.some((input) => input.endsWith(suffix))).toBe(false);
    });
    HOST_CRYPTO_SYMBOLS.forEach((symbol) => {
      expect(code).not.toContain(symbol);
    });
  });
});
