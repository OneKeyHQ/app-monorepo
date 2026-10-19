import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';
import TronWeb from 'tronweb';

import { ethers } from '@onekeyhq/core/src/chains/evm/sdkEvm/ethers';
import type { IEncodedTxTron } from '@onekeyhq/core/src/chains/tron/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  ThirdPartyDeviceMismatch,
  ThirdPartyMethodNotSupported,
  ThirdPartyUserRejected,
} from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { EMessageTypesTron } from '@onekeyhq/shared/types/message';

import { KeyringHardwareKeystone } from './KeyringHardwareKeystone';

const signerKey = '0e'.repeat(32);
const otherKey = '0f'.repeat(32);
const signerAddress = TronWeb.utils.crypto.pkToAddress(signerKey);
const signRawTransaction = (rawHex: string, key = signerKey) =>
  TronWeb.utils.crypto.signBytes(key, Buffer.from(rawHex, 'hex'));
const signMessage = (hex: string, key = signerKey) =>
  TronWeb.utils.message.signMessage(Buffer.from(hex, 'hex'), key).slice(2);

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
    txID: ethers.utils.sha256('0xdeadbeef').slice(2),
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
          getAccountAddress: jest.fn().mockResolvedValue(signerAddress),
        },
      },
    ) as KeyringHardwareKeystone;
    return { keyring, getAdapterForVendor };
  }

  it('signs raw_data_hex and folds the device signature back into the tx', async () => {
    const tronSignTransaction = jest.fn().mockResolvedValue({
      success: true,
      payload: { signature: signRawTransaction(encodedTx.raw_data_hex) },
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
    expect(result.txid).toBe(encodedTx.txID);
    expect(result.encodedTx).toEqual(encodedTx);
    expect(result.rawTx).toBe(
      stringUtils.stableStringify({
        ...encodedTx,
        signature: [signRawTransaction(encodedTx.raw_data_hex)],
      }),
    );
  });

  it.each([
    ['one byte', '00'],
    ['invalid hex', 'zz'.repeat(65)],
    [
      'invalid recovery value',
      `${signRawTransaction('deadbeef').slice(0, -2)}ff`,
    ],
    ['wrong signer', signRawTransaction('deadbeef', otherKey)],
    ['wrong transaction', signRawTransaction('deadbeee')],
  ])('rejects a transaction signature with %s', async (_label, signature) => {
    const tronSignTransaction = jest.fn().mockResolvedValue({
      success: true,
      payload: { signature },
    });
    const { keyring } = buildKeyring(tronSignTransaction);
    await expect(
      keyring.signTransaction({
        unsignedTx: { encodedTx },
        deviceParams: { dbDevice },
      } as never),
    ).rejects.toBeInstanceOf(ThirdPartyDeviceMismatch);
  });

  it.each([0, 27])(
    'accepts transaction recovery values starting at %s',
    async (base) => {
      const original = signRawTransaction(encodedTx.raw_data_hex);
      const recovery = Number.parseInt(original.slice(-2), 16) - 27 + base;
      const signature = `${original.slice(0, -2)}${recovery.toString(16).padStart(2, '0')}`;
      const tronSignTransaction = jest.fn().mockResolvedValue({
        success: true,
        payload: { signature },
      });
      const { keyring } = buildKeyring(tronSignTransaction);
      await expect(
        keyring.signTransaction({
          unsignedTx: { encodedTx },
          deviceParams: { dbDevice },
        } as never),
      ).resolves.toMatchObject({ txid: encodedTx.txID });
    },
  );

  it('rejects a transaction ID inconsistent with the exact signing bytes before signing', async () => {
    const tronSignTransaction = jest.fn();
    const { keyring } = buildKeyring(tronSignTransaction);
    await expect(
      keyring.signTransaction({
        unsignedTx: { encodedTx: { ...encodedTx, txID: '00'.repeat(32) } },
        deviceParams: { dbDevice },
      } as never),
    ).rejects.toThrow('transaction ID does not match');
    expect(tronSignTransaction).not.toHaveBeenCalled();
  });

  it('verifies the selected permission key even when the transaction owner differs', async () => {
    const permissionTx = {
      ...encodedTx,
      raw_data: {
        contract: [
          {
            type: 'TransferContract',
            Permission_id: 2,
            parameter: {
              type_url: 'type.googleapis.com/protocol.TransferContract',
              value: {
                owner_address: TronWeb.utils.address.toHex(
                  TronWeb.utils.crypto.pkToAddress(otherKey),
                ),
                to_address: TronWeb.utils.address.toHex(signerAddress),
                amount: 1,
              },
            },
          },
        ],
        ref_block_bytes: '0a95',
        ref_block_hash: '81a16498bf36d557',
        expiration: 1_697_179_737_000,
        timestamp: 1_697_179_677_393,
      },
    };
    const pb: unknown = TronWeb.utils.transaction.txJsonToPb(permissionTx);
    permissionTx.raw_data_hex = TronWeb.utils.transaction.txPbToRawDataHex(pb);
    permissionTx.txID = TronWeb.utils.transaction
      .txPbToTxID(pb)
      .replace(/^0x/, '');
    const signature = signRawTransaction(permissionTx.raw_data_hex);
    const tronSignTransaction = jest
      .fn()
      .mockResolvedValueOnce({ success: true, payload: { signature } })
      .mockResolvedValueOnce({
        success: true,
        payload: {
          signature: signRawTransaction(permissionTx.raw_data_hex, otherKey),
        },
      });
    const { keyring } = buildKeyring(tronSignTransaction);
    const params = {
      unsignedTx: { encodedTx: permissionTx },
      deviceParams: { dbDevice },
    };
    const result = await keyring.signTransaction(params as never);
    expect(result.rawTx).toBe(
      stringUtils.stableStringify({ ...permissionTx, signature: [signature] }),
    );
    await expect(
      keyring.signTransaction(params as never),
    ).rejects.toBeInstanceOf(ThirdPartyDeviceMismatch);
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
  const dbAccount = {
    id: 'account-1',
    path: "m/44'/195'/0'/0/0",
    address: signerAddress,
  };
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
      jest.fn().mockResolvedValue({
        success: true,
        payload: { signature: signMessage('deadbeef') },
      }),
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
    expect(signatures).toEqual([`0x${signMessage('deadbeef')}`]);
  });

  it.each([
    ['one byte', '00'],
    ['invalid recovery value', `${signMessage('deadbeef').slice(0, -2)}ff`],
    ['wrong signer', signMessage('deadbeef', otherKey)],
    ['wrong message', signMessage('deadbeee')],
  ])('rejects a V2 message signature with %s', async (_label, signature) => {
    const { keyring } = buildKeyring(
      jest.fn().mockResolvedValue({ success: true, payload: { signature } }),
    );
    await expect(
      keyring.signMessage({
        messages: [
          { message: 'deadbeef', type: EMessageTypesTron.SIGN_MESSAGE_V2 },
        ],
        deviceParams: { dbDevice },
      } as never),
    ).rejects.toBeInstanceOf(ThirdPartyDeviceMismatch);
  });

  it.each([
    '0x',
    '0xdeadbeef',
    Buffer.from('你好 Tron', 'utf8').toString('hex'),
  ])('verifies exact V2 message bytes for %s', async (message) => {
    const signature = signMessage(message.replace(/^0x/, ''));
    const { keyring } = buildKeyring(
      jest.fn().mockResolvedValue({ success: true, payload: { signature } }),
    );
    await expect(
      keyring.signMessage({
        messages: [{ message, type: EMessageTypesTron.SIGN_MESSAGE_V2 }],
        deviceParams: { dbDevice },
      } as never),
    ).resolves.toEqual([`0x${signature}`]);
  });

  it.each(['abc', 'zz'])(
    'rejects malformed bytes %s before starting a batch',
    async (message) => {
      const { keyring, tronSignMessage } = buildKeyring(jest.fn());
      await expect(
        keyring.signMessage({
          messages: [
            { message: 'deadbeef', type: EMessageTypesTron.SIGN_MESSAGE_V2 },
            { message, type: EMessageTypesTron.SIGN_MESSAGE_V2 },
          ],
          deviceParams: { dbDevice },
        } as never),
      ).rejects.toThrow('complete hex bytes');
      expect(tronSignMessage).not.toHaveBeenCalled();
    },
  );

  it('stops a message batch at the first invalid signature', async () => {
    const tronSignMessage = jest
      .fn()
      .mockResolvedValue({ success: true, payload: { signature: '00' } });
    const { keyring } = buildKeyring(tronSignMessage);
    await expect(
      keyring.signMessage({
        messages: [
          { message: 'aa', type: EMessageTypesTron.SIGN_MESSAGE_V2 },
          { message: 'bb', type: EMessageTypesTron.SIGN_MESSAGE_V2 },
        ],
        deviceParams: { dbDevice },
      } as never),
    ).rejects.toBeInstanceOf(ThirdPartyDeviceMismatch);
    expect(tronSignMessage).toHaveBeenCalledTimes(1);
  });

  it('signs each message in a batch in order', async () => {
    const tronSignMessage = jest
      .fn()
      .mockResolvedValueOnce({
        success: true,
        payload: { signature: signMessage('aa') },
      })
      .mockResolvedValueOnce({
        success: true,
        payload: { signature: signMessage('bb') },
      });
    const { keyring } = buildKeyring(tronSignMessage);

    const signatures = await keyring.signMessage({
      messages: [
        { message: 'aa', type: EMessageTypesTron.SIGN_MESSAGE_V2 },
        { message: 'bb', type: EMessageTypesTron.SIGN_MESSAGE_V2 },
      ],
      deviceParams: { dbDevice },
    } as never);

    expect(tronSignMessage).toHaveBeenCalledTimes(2);
    expect(signatures).toEqual([
      `0x${signMessage('aa')}`,
      `0x${signMessage('bb')}`,
    ]);
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
