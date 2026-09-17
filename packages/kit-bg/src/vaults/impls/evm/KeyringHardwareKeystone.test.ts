import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import {
  buildSignedTxFromSignatureEvm,
  packUnsignedTxForSignEvm,
} from '@onekeyhq/core/src/chains/evm/sdkEvm';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import { ThirdPartyUserRejected } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import { KeyringHardwareKeystone } from './KeyringHardwareKeystone';

describe('KeyringHardwareKeystone.buildHwAllNetworkPrepareAccountsParams', () => {
  it('forwards the derived path and resolved numeric chain id', async () => {
    const keyring = Object.assign(
      Object.create(KeyringHardwareKeystone.prototype),
      {
        hwSdkNetwork: 'evm',
        getNetworkChainId: jest.fn().mockResolvedValue('137'),
      },
    ) as KeyringHardwareKeystone;

    await expect(
      keyring.buildHwAllNetworkPrepareAccountsParams({
        path: "m/44'/60'/0'/0/0",
        template: "m/44'/60'/0'/0/{index}",
        index: 0,
      } as never),
    ).resolves.toEqual({
      network: 'evm',
      path: "m/44'/60'/0'/0/0",
      showOnOneKey: false,
      chainName: '137',
    });
  });
});

describe('KeyringHardwareKeystone.signTransaction', () => {
  const dbAccount = { path: "m/44'/60'/0'/0/0" };
  const dbDevice = {
    connectId: 'keystone-wallet:test',
    deviceId: 'wallet-id',
  };
  const encodedTx: IEncodedTxEvm = {
    from: `0x${'11'.repeat(20)}`,
    nonce: '0x1',
    gasLimit: '0x5208',
    gasPrice: '0x3b9aca00',
    chainId: '1',
    to: `0x${'aa'.repeat(20)}`,
    value: '0x0',
    data: '0x',
  };

  function buildKeyring(evmSignTransaction: jest.Mock) {
    const getAdapterForVendor = jest
      .fn()
      .mockResolvedValue({ hw: { evmSignTransaction } });
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

  it('rebuilds the raw transaction from the device-returned v/r/s', async () => {
    const signature = {
      v: '0x1c',
      r: `0x${'11'.repeat(32)}`,
      s: `0x${'22'.repeat(32)}`,
    };
    const evmSignTransaction = jest.fn().mockResolvedValue({
      success: true,
      payload: signature,
    });
    const { keyring } = buildKeyring(evmSignTransaction);

    const result = await keyring.signTransaction({
      unsignedTx: { encodedTx },
      deviceParams: { dbDevice },
    } as never);

    const { tx, serializedTx } = packUnsignedTxForSignEvm({
      encodedTx,
    } as never);
    expect(evmSignTransaction).toHaveBeenCalledWith(
      dbDevice.connectId,
      dbDevice.deviceId,
      expect.objectContaining({
        path: dbAccount.path,
        serializedTx,
      }),
    );
    const expected = buildSignedTxFromSignatureEvm({ tx, signature });
    expect(result.rawTx).toBe(expected.rawTx);
    expect(result.txid).toBe(expected.txid);
    expect(result.encodedTx).toEqual(encodedTx);
  });

  it('uses the operationId instead of connectId when one is supplied', async () => {
    const evmSignTransaction = jest.fn().mockResolvedValue({
      success: true,
      payload: {
        v: '0x1b',
        r: `0x${'33'.repeat(32)}`,
        s: `0x${'44'.repeat(32)}`,
      },
    });
    const { keyring } = buildKeyring(evmSignTransaction);

    await keyring.signTransaction({
      unsignedTx: { encodedTx },
      deviceParams: {
        dbDevice,
        deviceCommonParams: { operationId: 'hwk-op-1' },
      },
    } as never);

    expect(evmSignTransaction).toHaveBeenCalledWith(
      'hwk-op-1',
      dbDevice.deviceId,
      expect.objectContaining({ operationId: 'hwk-op-1' }),
    );
  });

  it('rejects when the adapter reports a device-side rejection', async () => {
    const evmSignTransaction = jest.fn().mockResolvedValue({
      success: false,
      payload: {
        error: 'rejected on device',
        code: HardwareErrorCode.UserRejected,
      },
    });
    const { keyring } = buildKeyring(evmSignTransaction);

    await expect(
      keyring.signTransaction({
        unsignedTx: { encodedTx },
        deviceParams: { dbDevice },
      } as never),
    ).rejects.toBeInstanceOf(ThirdPartyUserRejected);
    expect(evmSignTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('KeyringHardwareKeystone.signMessage', () => {
  const dbDevice = {
    connectId: 'keystone-wallet:test',
    deviceId: 'wallet-id',
  };
  const accountPath = "m/44'/60'/0'/0/0";

  function buildKeyring(hw: Record<string, jest.Mock>) {
    const getAdapterForVendor = jest.fn().mockResolvedValue({ hw });
    const keyring = Object.assign(
      Object.create(KeyringHardwareKeystone.prototype),
      {
        backgroundApi: {
          serviceThirdPartyHardware: { getAdapterForVendor },
        },
        vault: {
          getAccountPath: jest.fn().mockResolvedValue(accountPath),
        },
      },
    ) as KeyringHardwareKeystone;
    return { keyring, getAdapterForVendor };
  }

  it('hex-encodes a plain personal_sign string and always sets hex:true', async () => {
    const evmSignMessage = jest
      .fn()
      .mockResolvedValue({ success: true, payload: { signature: '0xsig' } });
    const { keyring } = buildKeyring({ evmSignMessage });

    const signatures = await keyring.signMessage({
      messages: [{ type: EMessageTypesEth.PERSONAL_SIGN, message: 'hello' }],
      deviceParams: { dbDevice },
    } as never);

    expect(evmSignMessage).toHaveBeenCalledWith(
      dbDevice.connectId,
      dbDevice.deviceId,
      expect.objectContaining({
        path: accountPath,
        message: Buffer.from('hello', 'utf-8').toString('hex'),
        hex: true,
      }),
    );
    expect(signatures).toEqual(['0xsig']);
  });

  it('passes an already-hex personal_sign message through unchanged', async () => {
    const evmSignMessage = jest
      .fn()
      .mockResolvedValue({ success: true, payload: { signature: '0xsig' } });
    const { keyring } = buildKeyring({ evmSignMessage });

    await keyring.signMessage({
      messages: [
        { type: EMessageTypesEth.PERSONAL_SIGN, message: '0xdeadbeef' },
      ],
      deviceParams: { dbDevice },
    } as never);

    expect(evmSignMessage).toHaveBeenCalledWith(
      dbDevice.connectId,
      dbDevice.deviceId,
      expect.objectContaining({ message: '0xdeadbeef', hex: true }),
    );
  });

  it('sends the full EIP-712 struct plus the original dApp JSON for typed data v4', async () => {
    const evmSignTypedData = jest
      .fn()
      .mockResolvedValue({ success: true, payload: { signature: '0xsig' } });
    const { keyring } = buildKeyring({ evmSignTypedData });
    const typedData = {
      domain: { name: 'Test', chainId: 1 },
      types: {
        EIP712Domain: [],
        Mail: [{ name: 'contents', type: 'string' }],
      },
      primaryType: 'Mail',
      message: { contents: 'hi' },
    };
    const messageJson = JSON.stringify(typedData);

    await keyring.signMessage({
      messages: [
        { type: EMessageTypesEth.TYPED_DATA_V4, message: messageJson },
      ],
      deviceParams: { dbDevice },
    } as never);

    expect(evmSignTypedData).toHaveBeenCalledWith(
      dbDevice.connectId,
      dbDevice.deviceId,
      expect.objectContaining({
        path: accountPath,
        data: typedData,
        dataJson: messageJson,
      }),
    );
  });

  it('rejects ETH_SIGN as not implemented without invoking any sign method', async () => {
    const evmSignMessage = jest.fn();
    const evmSignTypedData = jest.fn();
    const { keyring } = buildKeyring({ evmSignMessage, evmSignTypedData });

    await expect(
      keyring.signMessage({
        messages: [{ type: EMessageTypesEth.ETH_SIGN, message: '0x00' }],
        deviceParams: { dbDevice },
      } as never),
    ).rejects.toBeInstanceOf(NotImplemented);
    expect(evmSignMessage).not.toHaveBeenCalled();
    expect(evmSignTypedData).not.toHaveBeenCalled();
  });

  it('rejects when the adapter reports a device-side rejection for personal_sign', async () => {
    const evmSignMessage = jest.fn().mockResolvedValue({
      success: false,
      payload: {
        error: 'rejected on device',
        code: HardwareErrorCode.UserRejected,
      },
    });
    const { keyring } = buildKeyring({ evmSignMessage });

    await expect(
      keyring.signMessage({
        messages: [{ type: EMessageTypesEth.PERSONAL_SIGN, message: 'hello' }],
        deviceParams: { dbDevice },
      } as never),
    ).rejects.toBeInstanceOf(ThirdPartyUserRejected);
  });
});
