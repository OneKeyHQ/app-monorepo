import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import type { IEncodedTxTron } from '@onekeyhq/core/src/chains/tron/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  ThirdPartyMethodNotSupported,
  ThirdPartyUserRejected,
} from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { EMessageTypesTron } from '@onekeyhq/shared/types/message';

import { KeyringHardwareKeystone } from './KeyringHardwareKeystone';

describe('KeyringHardwareKeystone.buildHwAllNetworkPrepareAccountsParams', () => {
  it('forwards the derived path without a chain id', async () => {
    const keyring = Object.assign(
      Object.create(KeyringHardwareKeystone.prototype),
      { hwSdkNetwork: 'tron' },
    ) as KeyringHardwareKeystone;

    await expect(
      keyring.buildHwAllNetworkPrepareAccountsParams({
        path: "m/44'/195'/0'/0/0",
        template: "m/44'/195'/0'/0/{index}",
        index: 0,
      } as never),
    ).resolves.toEqual({
      network: 'tron',
      path: "m/44'/195'/0'/0/0",
      showOnOneKey: false,
    });
  });
});

describe('KeyringHardwareKeystone.signTransaction', () => {
  const dbAccount = { path: "m/44'/195'/0'/0/0" };
  const dbDevice = {
    connectId: 'keystone-wallet:test',
    deviceId: 'wallet-id',
  };
  const encodedTx = {
    txID: 'txid-hex',
    raw_data_hex: 'deadbeef',
    raw_data: {},
  } as unknown as IEncodedTxTron;

  function buildKeyring(tronSignTransaction: jest.Mock) {
    const getAdapterForVendor = jest
      .fn()
      .mockResolvedValue({ hw: { tronSignTransaction } });
    const keyring = Object.assign(
      Object.create(KeyringHardwareKeystone.prototype),
      {
        backgroundApi: {
          serviceThirdPartyHardware: { getAdapterForVendor },
        },
        vault: {
          getAccountPath: jest.fn().mockResolvedValue(dbAccount.path),
        },
      },
    ) as KeyringHardwareKeystone;
    return { keyring, getAdapterForVendor };
  }

  it('signs raw_data_hex and folds the device signature back into the tx', async () => {
    const tronSignTransaction = jest.fn().mockResolvedValue({
      success: true,
      payload: { signature: 'aa11bb22' },
    });
    const { keyring } = buildKeyring(tronSignTransaction);

    const result = await keyring.signTransaction({
      unsignedTx: { encodedTx },
      deviceParams: { dbDevice },
    } as never);

    expect(tronSignTransaction).toHaveBeenCalledWith(
      dbDevice.connectId,
      dbDevice.deviceId,
      expect.objectContaining({
        path: dbAccount.path,
        rawTxHex: 'deadbeef',
      }),
    );
    expect(result.txid).toBe('txid-hex');
    expect(result.encodedTx).toEqual(encodedTx);
    expect(result.rawTx).toBe(
      stringUtils.stableStringify({
        ...encodedTx,
        signature: ['aa11bb22'],
      }),
    );
  });

  it('throws before contacting the device when raw_data_hex is missing', async () => {
    const tronSignTransaction = jest.fn();
    const { keyring } = buildKeyring(tronSignTransaction);

    await expect(
      keyring.signTransaction({
        unsignedTx: {
          encodedTx: { txID: 'txid-hex' } as unknown as IEncodedTxTron,
        },
        deviceParams: { dbDevice },
      } as never),
    ).rejects.toBeInstanceOf(OneKeyLocalError);
    expect(tronSignTransaction).not.toHaveBeenCalled();
  });

  it('rejects when the adapter reports a device-side rejection', async () => {
    const tronSignTransaction = jest.fn().mockResolvedValue({
      success: false,
      payload: {
        error: 'rejected on device',
        code: HardwareErrorCode.UserRejected,
      },
    });
    const { keyring } = buildKeyring(tronSignTransaction);

    await expect(
      keyring.signTransaction({
        unsignedTx: { encodedTx },
        deviceParams: { dbDevice },
      } as never),
    ).rejects.toBeInstanceOf(ThirdPartyUserRejected);
    expect(tronSignTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('KeyringHardwareKeystone.signMessage', () => {
  const dbAccount = { id: 'account-1', path: "m/44'/195'/0'/0/0" };
  const dbDevice = {
    connectId: 'keystone-wallet:test',
    deviceId: 'wallet-id',
  };

  function buildKeyring(tronSignMessage: jest.Mock) {
    const getAdapterForVendor = jest
      .fn()
      .mockResolvedValue({ hw: { tronSignMessage } });
    const keyring = Object.assign(
      Object.create(KeyringHardwareKeystone.prototype),
      {
        backgroundApi: {
          serviceThirdPartyHardware: { getAdapterForVendor },
        },
        vault: { getAccount: jest.fn().mockResolvedValue(dbAccount) },
      },
    ) as KeyringHardwareKeystone;
    return { keyring, tronSignMessage, getAdapterForVendor };
  }

  it('rejects a V1 message before contacting the device', async () => {
    const { keyring, tronSignMessage } = buildKeyring(jest.fn());

    await expect(
      keyring.signMessage({
        messages: [{ message: 'hello', type: EMessageTypesTron.SIGN_MESSAGE }],
        deviceParams: { dbDevice },
      } as never),
    ).rejects.toBeInstanceOf(ThirdPartyMethodNotSupported);
    expect(tronSignMessage).not.toHaveBeenCalled();
  });

  it('rejects a [V2, V1] batch before signing anything', async () => {
    const { keyring, tronSignMessage, getAdapterForVendor } = buildKeyring(
      jest.fn(),
    );

    await expect(
      keyring.signMessage({
        messages: [
          { message: 'deadbeef', type: EMessageTypesTron.SIGN_MESSAGE_V2 },
          { message: 'hello', type: EMessageTypesTron.SIGN_MESSAGE },
        ],
        deviceParams: { dbDevice },
      } as never),
    ).rejects.toBeInstanceOf(ThirdPartyMethodNotSupported);
    expect(tronSignMessage).not.toHaveBeenCalled();
    expect(getAdapterForVendor).not.toHaveBeenCalled();
  });

  it('signs a V2 message with the account path and hex-prefixes the signature', async () => {
    const { keyring, tronSignMessage } = buildKeyring(
      jest
        .fn()
        .mockResolvedValue({ success: true, payload: { signature: 'abcd' } }),
    );

    const signatures = await keyring.signMessage({
      messages: [
        { message: 'deadbeef', type: EMessageTypesTron.SIGN_MESSAGE_V2 },
      ],
      deviceParams: { dbDevice },
    } as never);

    expect(tronSignMessage).toHaveBeenCalledWith(
      dbDevice.connectId,
      dbDevice.deviceId,
      expect.objectContaining({
        path: dbAccount.path,
        messageHex: 'deadbeef',
        messageType: 'V2',
      }),
    );
    expect(signatures).toEqual(['0xabcd']);
  });

  it('signs each message in a batch in order', async () => {
    const tronSignMessage = jest
      .fn()
      .mockResolvedValueOnce({ success: true, payload: { signature: '11' } })
      .mockResolvedValueOnce({ success: true, payload: { signature: '22' } });
    const { keyring } = buildKeyring(tronSignMessage);

    const signatures = await keyring.signMessage({
      messages: [
        { message: 'aa', type: EMessageTypesTron.SIGN_MESSAGE_V2 },
        { message: 'bb', type: EMessageTypesTron.SIGN_MESSAGE_V2 },
      ],
      deviceParams: { dbDevice },
    } as never);

    expect(tronSignMessage).toHaveBeenCalledTimes(2);
    expect(signatures).toEqual(['0x11', '0x22']);
  });

  it('rejects when the adapter reports a device-side rejection', async () => {
    const { keyring, tronSignMessage } = buildKeyring(
      jest.fn().mockResolvedValue({
        success: false,
        payload: {
          error: 'rejected on device',
          code: HardwareErrorCode.UserRejected,
        },
      }),
    );

    await expect(
      keyring.signMessage({
        messages: [
          { message: 'deadbeef', type: EMessageTypesTron.SIGN_MESSAGE_V2 },
        ],
        deviceParams: { dbDevice },
      } as never),
    ).rejects.toBeInstanceOf(ThirdPartyUserRejected);
    expect(tronSignMessage).toHaveBeenCalledTimes(1);
  });
});

describe('KeyringHardwareKeystone.batchGetAddresses', () => {
  function buildKeyring() {
    const getAdapterForVendor = jest.fn();
    const keyring = Object.assign(
      Object.create(KeyringHardwareKeystone.prototype),
      {
        hwSdkNetwork: 'tron',
        backgroundApi: {
          serviceThirdPartyHardware: { getAdapterForVendor },
        },
      },
    ) as KeyringHardwareKeystone;
    return { keyring, getAdapterForVendor };
  }

  it('refuses a device verification instead of returning a locally derived address', async () => {
    const { keyring, getAdapterForVendor } = buildKeyring();

    await expect(
      keyring.batchGetAddresses({
        indexes: [0],
        isVerifyAddressAction: true,
      } as never),
    ).rejects.toThrow('manual derivation-path confirmation');
    expect(getAdapterForVendor).not.toHaveBeenCalled();
  });

  it('offers no local candidates for a normal create flow', async () => {
    const { keyring, getAdapterForVendor } = buildKeyring();

    await expect(
      keyring.batchGetAddresses({ indexes: [0] } as never),
    ).resolves.toEqual([]);
    expect(getAdapterForVendor).not.toHaveBeenCalled();
  });
});
