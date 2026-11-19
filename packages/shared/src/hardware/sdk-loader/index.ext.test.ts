import { probeUsbDeviceIdentities as probe } from '@onekeyfe/hd-common-connect-sdk-extension';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  importHardwareSDK,
  importHardwareSDKLowLevel,
  probeUsbDeviceIdentities,
} from './index.ext';

jest.mock('@onekeyfe/hd-web-sdk', () => {
  throw new OneKeyLocalError('Extension UI must not load the iframe SDK');
});
jest.mock('@onekeyfe/hd-common-connect-sdk-extension', () => ({
  probeUsbDeviceIdentities: jest.fn(async () => []),
}));

it('preserves USB identity probing for the existing permission UI', async () => {
  expect(await probeUsbDeviceIdentities({ commType: 'webusb' })).toEqual([]);
  expect(probe).toHaveBeenCalledWith({ commType: 'webusb' });
});

it('keeps hardware SDK initialization out of the extension UI runtime', async () => {
  await expect(importHardwareSDK({})).rejects.toThrow(
    'Hardware SDK is only available in the extension background',
  );
  await expect(importHardwareSDKLowLevel()).rejects.toThrow(
    'Hardware SDK is only available in the extension background',
  );
});
