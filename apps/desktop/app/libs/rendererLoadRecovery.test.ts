import { shouldReloadAppShellAfterFailedLoad } from './rendererLoadRecovery';

const APP_SHELL_URL = 'file:///index.html';
const ERR_FILE_NOT_FOUND = -6;

function check(
  overrides: Partial<Parameters<typeof shouldReloadAppShellAfterFailedLoad>[0]>,
) {
  return shouldReloadAppShellAfterFailedLoad({
    validatedURL: 'file:///market',
    isMainFrame: true,
    errorCode: ERR_FILE_NOT_FOUND,
    appShellUrl: APP_SHELL_URL,
    ...overrides,
  });
}

describe('rendererLoadRecovery', () => {
  it('recovers route URLs whose query carries dots', () => {
    expect(
      check({
        validatedURL:
          'file:///market/stock/JNJ?stockPreviewSymbol=JNJ&stockPreviewLogoUrl=https%3A%2F%2Funi.onekey-asset.com%2Fstock%2Fjnj.png',
      }),
    ).toBe(true);
    expect(
      check({
        validatedURL:
          'file:///market/0xabc?isNative=false&legacyTokenPreview=%7B%22price%22%3A%221.23%22%7D',
      }),
    ).toBe(true);
  });

  it('recovers route URLs whose path segment carries dots', () => {
    expect(check({ validatedURL: 'file:///market/stock/BRK.B' })).toBe(true);
  });

  it('recovers plain route URLs', () => {
    expect(check({ validatedURL: 'file:///' })).toBe(true);
    expect(check({ validatedURL: 'file:///market' })).toBe(true);
    expect(check({ validatedURL: 'file:///perps?token=INJ' })).toBe(true);
  });

  it('never reloads the app shell with itself', () => {
    expect(check({ validatedURL: APP_SHELL_URL })).toBe(false);
    expect(check({ validatedURL: `${APP_SHELL_URL}?t=1` })).toBe(false);
    expect(check({ validatedURL: `${APP_SHELL_URL}#/market` })).toBe(false);
  });

  it('ignores sub-frame, aborted and non-file failures', () => {
    expect(check({ isMainFrame: false })).toBe(false);
    expect(check({ errorCode: -3 })).toBe(false);
    expect(check({ validatedURL: 'https://app.onekey.so/market' })).toBe(false);
  });
});
