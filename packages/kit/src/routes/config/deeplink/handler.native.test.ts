import * as Linking from 'expo-linking';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { registerHandler } from './handler.native';

jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(),
  getLinkingURL: jest.fn(),
  clearInitialURL: jest.fn(),
  addEventListener: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  isNativeIOS: true,
}));

const getInitialURL = jest.mocked(Linking.getInitialURL);
const getLinkingURL = jest.mocked(Linking.getLinkingURL);
const clearInitialURL = jest.mocked(Linking.clearInitialURL);
const addEventListener = jest.mocked(Linking.addEventListener);
let linkingURLCache: string | null = null;

beforeEach(() => {
  jest.clearAllMocks();
  getInitialURL.mockResolvedValue(null);
  linkingURLCache = null;
  getLinkingURL.mockImplementation(() => linkingURLCache);
  clearInitialURL.mockImplementation(() => {
    linkingURLCache = null;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('uses the React Native initial URL once when both sources have a URL', async () => {
  const url = 'onekey-wallet://swap';
  getInitialURL.mockResolvedValue(url);
  linkingURLCache = 'onekey-wallet://market';
  const handleDeepLinkUrl = jest.fn();

  registerHandler(handleDeepLinkUrl);
  await Promise.resolve();

  expect(handleDeepLinkUrl).toHaveBeenCalledTimes(1);
  expect(handleDeepLinkUrl).toHaveBeenCalledWith({ url });
  expect(linkingURLCache).toBe('onekey-wallet://market');
  expect(clearInitialURL).not.toHaveBeenCalled();
});

it('uses the iOS scene URL when a background host has no initial URL', async () => {
  const url = 'onekey-wallet://market';
  linkingURLCache = url;
  const handleDeepLinkUrl = jest.fn();

  registerHandler(handleDeepLinkUrl);
  await Promise.resolve();

  expect(handleDeepLinkUrl).toHaveBeenCalledTimes(1);
  expect(handleDeepLinkUrl).toHaveBeenCalledWith({ url });
  expect(linkingURLCache).toBeNull();
  expect(clearInitialURL).toHaveBeenCalledTimes(1);

  registerHandler(handleDeepLinkUrl);
  await Promise.resolve();
  expect(handleDeepLinkUrl).toHaveBeenCalledTimes(1);
});

it('does not replay a warm URL after registering the handler again', async () => {
  const url = 'onekey-wallet://market_detail?coinGeckoId=bitcoin';
  const handleDeepLinkUrl = jest.fn();

  registerHandler(handleDeepLinkUrl);
  await Promise.resolve();
  linkingURLCache = url;
  addEventListener.mock.calls[0]?.[1]({ url });

  expect(handleDeepLinkUrl).toHaveBeenCalledTimes(1);
  expect(linkingURLCache).toBeNull();
  expect(clearInitialURL).toHaveBeenCalledTimes(1);

  registerHandler(handleDeepLinkUrl);
  await Promise.resolve();
  expect(handleDeepLinkUrl).toHaveBeenCalledTimes(1);
});

it('keeps a newer pending URL while handling another warm URL', async () => {
  const handleDeepLinkUrl = jest.fn();
  registerHandler(handleDeepLinkUrl);
  await Promise.resolve();
  linkingURLCache = 'onekey-wallet://market';

  addEventListener.mock.calls[0]?.[1]({ url: 'onekey-wallet://swap' });

  expect(handleDeepLinkUrl).toHaveBeenCalledWith({
    url: 'onekey-wallet://swap',
  });
  expect(linkingURLCache).toBe('onekey-wallet://market');
  expect(clearInitialURL).not.toHaveBeenCalled();
});

it('does not dispatch when neither iOS source has a URL', async () => {
  const handleDeepLinkUrl = jest.fn();

  registerHandler(handleDeepLinkUrl);
  await Promise.resolve();

  expect(handleDeepLinkUrl).not.toHaveBeenCalled();
});

it('does not read the scene fallback on Android', async () => {
  jest.replaceProperty(platformEnv, 'isNativeIOS', false);
  getLinkingURL.mockReturnValue('onekey-wallet://market');
  const handleDeepLinkUrl = jest.fn();

  registerHandler(handleDeepLinkUrl);
  await Promise.resolve();

  expect(getLinkingURL).not.toHaveBeenCalled();
  expect(clearInitialURL).not.toHaveBeenCalled();
  expect(handleDeepLinkUrl).not.toHaveBeenCalled();

  addEventListener.mock.calls[0]?.[1]({ url: 'onekey-wallet://market' });
  expect(handleDeepLinkUrl).toHaveBeenCalledWith({
    url: 'onekey-wallet://market',
  });
  expect(getLinkingURL).not.toHaveBeenCalled();
  expect(clearInitialURL).not.toHaveBeenCalled();
});
