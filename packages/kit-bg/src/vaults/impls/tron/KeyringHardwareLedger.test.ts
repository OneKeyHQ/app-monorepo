import { ThirdPartyMethodNotSupported } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import { EMessageTypesTron } from '@onekeyhq/shared/types/message';

import { KeyringHardwareLedger } from './KeyringHardwareLedger';

describe('KeyringHardwareLedger.signMessage', () => {
  const dbAccount = {
    id: 'account-1',
    path: "m/44'/195'/0'/0/0",
    relPath: '0/0',
  };

  function buildKeyring(tronSignMessage: jest.Mock, settingsRaw: string) {
    const getAdapterForVendor = jest.fn().mockResolvedValue({
      hw: { tronSignMessage },
    });
    const keyring = Object.assign(
      Object.create(KeyringHardwareLedger.prototype),
      {
        backgroundApi: {
          serviceThirdPartyHardware: { getAdapterForVendor },
        },
        vault: {
          getAccount: jest.fn().mockResolvedValue(dbAccount),
        },
      },
    ) as KeyringHardwareLedger;
    const dbDevice = {
      id: 'ledger-device-1',
      settingsRaw,
      deviceId: 'wallet-id',
      connectId: 'ledger-wallet:test',
      vendor: 'ledger',
    };
    return { keyring, tronSignMessage, getAdapterForVendor, dbDevice };
  }

  it('rejects a V1 message before contacting the device', async () => {
    const tronSignMessage = jest.fn();
    const { keyring, dbDevice } = buildKeyring(tronSignMessage, '{}');

    await expect(
      keyring.signMessage({
        messages: [{ message: 'hello', type: EMessageTypesTron.SIGN_MESSAGE }],
        password: '',
        deviceParams: { dbDevice },
      } as never),
    ).rejects.toBeInstanceOf(ThirdPartyMethodNotSupported);
    expect(tronSignMessage).not.toHaveBeenCalled();
  });

  it('rejects a [V2, V1] batch before signing anything', async () => {
    const tronSignMessage = jest.fn();
    const { keyring, getAdapterForVendor, dbDevice } = buildKeyring(
      tronSignMessage,
      JSON.stringify({ chainFingerprints: { tron: 'aabbccdd' } }),
    );

    await expect(
      keyring.signMessage({
        messages: [
          { message: 'deadbeef', type: EMessageTypesTron.SIGN_MESSAGE_V2 },
          { message: 'hello', type: EMessageTypesTron.SIGN_MESSAGE },
        ],
        password: '',
        deviceParams: { dbDevice },
      } as never),
    ).rejects.toBeInstanceOf(ThirdPartyMethodNotSupported);
    expect(tronSignMessage).not.toHaveBeenCalled();
    expect(getAdapterForVendor).not.toHaveBeenCalled();
  });

  it('signs a V2 message and forwards the signature', async () => {
    const tronSignMessage = jest.fn().mockResolvedValue({
      success: true,
      payload: { signature: 'abcd' },
    });
    const { keyring, dbDevice } = buildKeyring(
      tronSignMessage,
      JSON.stringify({ chainFingerprints: { tron: 'aabbccdd' } }),
    );

    const signatures = await keyring.signMessage({
      messages: [
        { message: 'deadbeef', type: EMessageTypesTron.SIGN_MESSAGE_V2 },
      ],
      password: '',
      deviceParams: { dbDevice },
    } as never);

    expect(tronSignMessage).toHaveBeenCalledWith(
      '',
      'aabbccdd',
      expect.objectContaining({
        path: dbAccount.path,
        messageHex: 'deadbeef',
      }),
    );
    expect(signatures).toEqual(['0xabcd']);
  });
});
