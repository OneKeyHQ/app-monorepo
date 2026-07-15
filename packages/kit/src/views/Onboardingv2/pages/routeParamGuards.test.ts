import { EDeviceType } from '@onekeyfe/hd-shared';

import { ENCODE_TEXT_PREFIX } from '@onekeyhq/shared/src/utils/sensitiveTextUtils';
import { EConnectDeviceChannel } from '@onekeyhq/shared/types/connectDevice';

import {
  isValidCheckAndUpdateRouteParams,
  isValidConnectYourDeviceRouteParams,
  isValidRecoveryPhraseRouteParams,
} from './routeParamGuards';

describe('onboarding route parameter guards', () => {
  it('requires encoded recovery phrase state and a wallet id', () => {
    expect(
      isValidRecoveryPhraseRouteParams({
        mnemonic: `${ENCODE_TEXT_PREFIX.aes}ciphertext`,
        walletId: 'wallet-id',
      }),
    ).toBe(true);
    expect(
      isValidRecoveryPhraseRouteParams({
        mnemonic: 'unencoded words',
        walletId: 'wallet-id',
      }),
    ).toBe(false);
    expect(isValidRecoveryPhraseRouteParams({ walletId: 'wallet-id' })).toBe(
      false,
    );
  });

  it('rejects URL-shaped device type strings', () => {
    expect(
      isValidConnectYourDeviceRouteParams({
        deviceType: [EDeviceType.Pro],
      }),
    ).toBe(true);
    expect(
      isValidConnectYourDeviceRouteParams({ deviceType: EDeviceType.Pro }),
    ).toBe(false);
    expect(isValidConnectYourDeviceRouteParams({ deviceType: [] })).toBe(false);
  });

  it('requires a connected device object and channel', () => {
    expect(
      isValidCheckAndUpdateRouteParams({
        deviceData: { device: { connectId: 'device-id' } },
        tabValue: EConnectDeviceChannel.usbOrBle,
      }),
    ).toBe(true);
    expect(
      isValidCheckAndUpdateRouteParams({
        deviceData: {},
        tabValue: EConnectDeviceChannel.usbOrBle,
      }),
    ).toBe(false);
  });
});
