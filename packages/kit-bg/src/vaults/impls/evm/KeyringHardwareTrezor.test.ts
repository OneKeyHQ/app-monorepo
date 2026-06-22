import { ThirdPartyMethodNotSupported } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import {
  KeyringHardwareTrezor,
  buildTrezorEvmSignMessageParams,
  buildTrezorEvmSignTransactionPayload,
} from './KeyringHardwareTrezor';

describe('buildTrezorEvmSignTransactionPayload', () => {
  it('builds flat Trezor connector params instead of Ledger serializedTx params', () => {
    const { txParams } = buildTrezorEvmSignTransactionPayload({
      chainId: 1,
      unsignedTx: {
        encodedTx: {
          from: '0x1111111111111111111111111111111111111111',
          to: '0x2222222222222222222222222222222222222222',
          value: '0x0',
          data: '0x',
          nonce: 1,
          gasLimit: '21000',
          gasPrice: '1000000000',
        },
      } as any,
    });

    expect(txParams).toMatchObject({
      to: '0x2222222222222222222222222222222222222222',
      value: '0x0',
      data: '0x',
      chainId: 1,
      nonce: '0x1',
      gasLimit: '0x5208',
      gasPrice: '0x3b9aca00',
    });
    expect('serializedTx' in txParams).toBe(false);
    expect('transaction' in txParams).toBe(false);
  });

  it('builds flat EIP-1559 fields for Trezor connector signing', () => {
    const { txParams } = buildTrezorEvmSignTransactionPayload({
      chainId: 1,
      unsignedTx: {
        encodedTx: {
          from: '0x1111111111111111111111111111111111111111',
          to: '0x2222222222222222222222222222222222222222',
          value: '0x0',
          data: '0x',
          nonce: 1,
          gasLimit: '21000',
          maxFeePerGas: '2000000000',
          maxPriorityFeePerGas: '1000000000',
          accessList: [
            {
              address: '0x3333333333333333333333333333333333333333',
              storageKeys: [],
            },
          ],
        },
      } as any,
    });

    expect(txParams).toMatchObject({
      chainId: 1,
      gasPrice: undefined,
      maxFeePerGas: '0x77359400',
      maxPriorityFeePerGas: '0x3b9aca00',
      accessList: [
        {
          address: '0x3333333333333333333333333333333333333333',
          storageKeys: [],
        },
      ],
    });
    expect('serializedTx' in txParams).toBe(false);
    expect('transaction' in txParams).toBe(false);
  });

  it('preserves SLIP-24 payment request metadata for Trezor connector signing', () => {
    const paymentRequest = {
      nonce: 'nonce-1',
      recipientName: 'Merchant',
      amount: '100000',
      signature: 'ab'.repeat(64),
      memos: [{ textMemo: { text: 'order #1' } }],
    };
    const { txParams } = buildTrezorEvmSignTransactionPayload({
      chainId: 1,
      unsignedTx: {
        encodedTx: {
          from: '0x1111111111111111111111111111111111111111',
          to: '0x2222222222222222222222222222222222222222',
          value: '0x0',
          data: '0x',
          nonce: 1,
          gasLimit: '21000',
          gasPrice: '1000000000',
          paymentRequest,
        },
      } as any,
    });

    expect(txParams).toMatchObject({
      paymentRequest,
    });
  });

  it('preserves static Ethereum definitions for Trezor connector signing', () => {
    const ethereumDefinitions = {
      encodedNetwork: '0a0101',
      encodedToken: '0a020202',
    };
    const { txParams } = buildTrezorEvmSignTransactionPayload({
      chainId: 1,
      unsignedTx: {
        encodedTx: {
          from: '0x1111111111111111111111111111111111111111',
          to: '0x2222222222222222222222222222222222222222',
          value: '0x0',
          data: '0x',
          nonce: 1,
          gasLimit: '21000',
          gasPrice: '1000000000',
          ethereumDefinitions,
        },
      } as any,
    });

    expect(txParams).toMatchObject({
      ethereumDefinitions,
    });
  });
});

describe('buildTrezorEvmSignMessageParams', () => {
  it('marks utf-8 personal_sign payloads as hex for the Trezor connector', () => {
    expect(buildTrezorEvmSignMessageParams('hello')).toEqual({
      message: '68656c6c6f',
      hex: true,
    });
  });

  it('strips the 0x prefix from hex personal_sign payloads', () => {
    expect(buildTrezorEvmSignMessageParams('0x68656c6c6f')).toEqual({
      message: '68656c6c6f',
      hex: true,
    });
  });
});

describe('KeyringHardwareTrezor personal message signing', () => {
  it('passes the network chainId so Trezor can resolve Ethereum definitions', async () => {
    const evmSignMessage = jest.fn().mockResolvedValue({
      success: true,
      payload: { signature: 'abcd' },
    });
    const keyring = Object.assign(
      Object.create(KeyringHardwareTrezor.prototype),
      {
        backgroundApi: {
          serviceThirdPartyHardware: {
            requestTrezorBleConnectIdForDevice: jest.fn(),
          },
        },
        getBleFallbackOptions: jest.fn(() => ({})),
        getNetworkChainId: jest.fn().mockResolvedValue('1'),
      },
    ) as KeyringHardwareTrezor;

    const result = await (
      keyring as unknown as {
        _signPersonalMessage: (...args: unknown[]) => Promise<string>;
      }
    )._signPersonalMessage(
      { hw: { evmSignMessage } },
      {
        connectId: 'USB_ID',
        deviceId: 'FEATURES_DEVICE_ID',
      },
      "m/44'/60'/0'/0/0",
      {
        type: EMessageTypesEth.PERSONAL_SIGN,
        message: 'hello',
      },
      {
        dbDevice: {
          connectId: 'USB_ID',
          deviceId: 'FEATURES_DEVICE_ID',
        },
      },
    );

    expect(result).toBe('0xabcd');
    expect(evmSignMessage).toHaveBeenCalledWith(
      'USB_ID',
      'FEATURES_DEVICE_ID',
      expect.objectContaining({
        path: "m/44'/60'/0'/0/0",
        chainId: 1,
        message: '68656c6c6f',
        hex: true,
      }),
    );
  });
});

describe('KeyringHardwareTrezor unsupported message signing', () => {
  it.each([EMessageTypesEth.ETH_SIGN, EMessageTypesEth.TYPED_DATA_V1])(
    'rejects %s with a third-party unsupported error and device-facing reason',
    async (type) => {
      const keyring = Object.assign(
        Object.create(KeyringHardwareTrezor.prototype),
        {
          backgroundApi: {
            serviceThirdPartyHardware: {
              getAdapterForVendor: jest.fn().mockResolvedValue({ hw: {} }),
            },
          },
          vault: {
            getAccountPath: jest.fn().mockResolvedValue("m/44'/60'/0'/0/0"),
          },
        },
      ) as KeyringHardwareTrezor;

      const signPromise = (
        keyring as unknown as {
          _handleSignMessage: (...args: unknown[]) => Promise<string>;
        }
      )._handleSignMessage(
        { type, message: 'hello' },
        {
          dbDevice: {
            connectId: 'USB_ID',
            deviceId: 'FEATURES_DEVICE_ID',
          },
        },
      );

      await expect(signPromise).rejects.toBeInstanceOf(
        ThirdPartyMethodNotSupported,
      );
      await expect(signPromise).rejects.toMatchObject({
        name: 'ThirdPartyHardwareError',
        code: 10_004,
        message: expect.stringContaining(
          `Trezor does not support EVM ${type} message signing`,
        ),
        payload: expect.objectContaining({
          message: expect.stringContaining(
            `Trezor does not support EVM ${type} message signing`,
          ),
        }),
      });
    },
  );
});

describe('KeyringHardwareTrezor typed-data signing', () => {
  it('sends parsed typed data and metamask v4 compatibility to the Trezor adapter', async () => {
    const typedData = {
      types: {
        EIP712Domain: [{ name: 'name', type: 'string' }],
        Mail: [{ name: 'contents', type: 'string' }],
      },
      primaryType: 'Mail',
      domain: { name: 'Ether Mail' },
      message: { contents: 'Hello' },
    };
    const evmSignTypedData = jest.fn().mockResolvedValue({
      success: true,
      payload: { signature: 'abcd' },
    });
    const keyring = Object.assign(
      Object.create(KeyringHardwareTrezor.prototype),
      {
        backgroundApi: {
          serviceThirdPartyHardware: {
            requestTrezorBleConnectIdForDevice: jest.fn(),
          },
        },
        getBleFallbackOptions: jest.fn(() => ({})),
        getNetworkChainId: jest.fn().mockResolvedValue('1'),
      },
    ) as KeyringHardwareTrezor;

    const result = await (
      keyring as unknown as {
        _signTypedData: (...args: unknown[]) => Promise<string>;
      }
    )._signTypedData(
      { hw: { evmSignTypedData } },
      {
        connectId: 'USB_ID',
        deviceId: 'FEATURES_DEVICE_ID',
      },
      "m/44'/60'/0'/0/0",
      {
        type: EMessageTypesEth.TYPED_DATA_V4,
        message: JSON.stringify(typedData),
      },
      {
        dbDevice: {
          connectId: 'USB_ID',
          deviceId: 'FEATURES_DEVICE_ID',
        },
      },
    );

    expect(result).toBe('0xabcd');
    expect(evmSignTypedData).toHaveBeenCalledWith(
      'USB_ID',
      'FEATURES_DEVICE_ID',
      expect.objectContaining({
        path: "m/44'/60'/0'/0/0",
        chainId: 1,
        data: typedData,
        metamaskV4Compat: true,
        domainSeparatorHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
        messageHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
      }),
    );
  });
});
