const path = require('path');

const { build } = require('esbuild');

const {
  electronSource,
  getDesktopMainEsbuildResolveOptions,
} = require('./desktopMainEsbuildConfig');

// Smoke check for the experimental desktop Native Messaging host.
//
// `appEntry.ts` reaches the host only through a dynamic `import('./
// nativeMessagingHost')`, and the host pulls in its safeStorage crypto helper
// (`nativeMessagingSafeStorage.ts`). If any import in that branch fails to
// resolve under the real desktop main esbuild config, the production build
// still succeeds for everything else and the breakage only surfaces at runtime
// as Chrome reporting "native host has exited" — never as a build failure.
//
// This test bundles `appEntry.ts` with the exact resolution config the shipped
// bundle uses (shared via desktopMainEsbuildConfig.js) and asserts the host
// branch is actually present in the output, so a future unresolvable import in
// the host chain fails CI here instead of silently shipping a dead host.
const HOST_ENTRY_SYMBOLS = [
  'runDesktopNativeMessagingHost',
  'encryptDesktopSafeStorageString',
  'decryptDesktopSafeStorageString',
];

const HOST_BRANCH_INPUT_SUFFIXES = [
  'apps/desktop/app/nativeMessagingHost.ts',
  'apps/desktop/app/nativeMessagingSafeStorage.ts',
];

describe('desktop native messaging host bundling', () => {
  jest.setTimeout(120 * 1000);

  it('bundles the host branch into appEntry under the real esbuild config', async () => {
    let result;
    try {
      result = await build({
        ...getDesktopMainEsbuildResolveOptions(),
        entryPoints: [path.join(electronSource, 'appEntry.ts')],
        write: false,
        metafile: true,
        logLevel: 'silent',
      });
    } catch (error) {
      const details = (error && error.errors ? error.errors : [])
        .map((e) => `${e.text}${e.location ? ` (${e.location.file})` : ''}`)
        .join('\n');
      throw new Error(
        `appEntry failed to bundle (Native Messaging host branch likely unresolvable):\n${details}`,
      );
    }

    const inputs = Object.keys(result.metafile.inputs);
    HOST_BRANCH_INPUT_SUFFIXES.forEach((suffix) => {
      expect(inputs.some((input) => input.endsWith(suffix))).toBe(true);
    });

    const code = result.outputFiles
      .map((file) => Buffer.from(file.contents).toString('utf8'))
      .join('\n');
    HOST_ENTRY_SYMBOLS.forEach((symbol) => {
      expect(code).toContain(symbol);
    });
  });
});
