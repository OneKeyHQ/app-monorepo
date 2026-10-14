import { BLANK_ICON_BASE64 } from '@onekeyhq/shared/src/consts';

import {
  EXT_NOTIFICATION_DEFAULT_ICON_PATH,
  resolveExtNotificationIconUrl,
} from './resolveExtNotificationIconUrl';

const EXTENSION_ORIGIN = 'chrome-extension://onekey-test-id';
const packagedIconUrl = `${EXTENSION_ORIGIN}/${EXT_NOTIFICATION_DEFAULT_ICON_PATH}`;
const originalChrome = globalThis.chrome;
const getURL = jest.fn((path: string) => `${EXTENSION_ORIGIN}/${path}`);

beforeEach(() => {
  getURL.mockClear();
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: {
      runtime: {
        getURL,
      },
    },
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: originalChrome,
  });
});

describe('resolveExtNotificationIconUrl', () => {
  it('keeps a payload icon when present', () => {
    expect(
      resolveExtNotificationIconUrl(
        'https://uni.onekey-asset.com/static/token.png',
      ),
    ).toBe('https://uni.onekey-asset.com/static/token.png');
    expect(getURL).not.toHaveBeenCalled();
  });

  it('uses the packaged OneKey icon when the payload has no usable icon', () => {
    expect(resolveExtNotificationIconUrl()).toBe(packagedIconUrl);
    expect(resolveExtNotificationIconUrl('')).toBe(packagedIconUrl);
    expect(resolveExtNotificationIconUrl()).not.toBe(BLANK_ICON_BASE64);
    expect(getURL).toHaveBeenCalledWith(EXT_NOTIFICATION_DEFAULT_ICON_PATH);
  });
});
