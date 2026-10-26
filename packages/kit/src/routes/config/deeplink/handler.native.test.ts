import * as Linking from 'expo-linking';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { registerHandler } from './handler.native';

jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(),
  getLinkingURL: jest.fn(),
  addEventListener: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  isNativeIOS: true,
}));

const getInitialURL = jest.mocked(Linking.getInitialURL);
const getLinkingURL = jest.mocked(Linking.getLinkingURL);

beforeEach(() => {
  jest.clearAllMocks();
  getInitialURL.mockResolvedValue(null);
  getLinkingURL.mockReturnValue(null);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('uses the React Native initial URL once when both sources have a URL', async () => {
  const url = 'onekey-wallet://swap';
  getInitialURL.mockResolvedValue(url);
  getLinkingURL.mockReturnValue('onekey-wallet://market');
  const handleDeepLinkUrl = jest.fn();

  registerHandler(handleDeepLinkUrl);
  await Promise.resolve();

  expect(handleDeepLinkUrl).toHaveBeenCalledTimes(1);
  expect(handleDeepLinkUrl).toHaveBeenCalledWith({ url });
  expect(getLinkingURL).not.toHaveBeenCalled();
});

it('uses the iOS scene URL when a background host has no initial URL', async () => {
  const url = 'onekey-wallet://market';
  getLinkingURL.mockReturnValue(url);
  const handleDeepLinkUrl = jest.fn();

  registerHandler(handleDeepLinkUrl);
  await Promise.resolve();

  expect(handleDeepLinkUrl).toHaveBeenCalledTimes(1);
  expect(handleDeepLinkUrl).toHaveBeenCalledWith({ url });
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
  expect(handleDeepLinkUrl).not.toHaveBeenCalled();
});
