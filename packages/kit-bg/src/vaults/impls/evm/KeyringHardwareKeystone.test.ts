import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import {
  buildSignedTxFromSignatureEvm,
  packUnsignedTxForSignEvm,
} from '@onekeyhq/core/src/chains/evm/sdkEvm';
import { ethers } from '@onekeyhq/core/src/chains/evm/sdkEvm/ethers';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import {
  ThirdPartyDeviceMismatch,
  ThirdPartyUserRejected,
} from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
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
  const accountPrivateKey = `0x${'0a'.repeat(32)}`;
  const otherPrivateKey = `0x${'0b'.repeat(32)}`;
  const encodedTx: IEncodedTxEvm = {
    from: ethers.utils.computeAddress(accountPrivateKey),
    nonce: '0x1',
    gasLimit: '0x5208',
    gasPrice: '0x3b9aca00',
    chainId: '1',
    to: `0x${'aa'.repeat(20)}`,
    value: '0x0',
    data: '0x',
  };

  // Signs the packed tx for real: the keyring recovers the signer from the
  // rebuilt raw tx, so no placeholder v/r/s reaches the return value.
  function signWith(privateKey: string) {
    const { digest } = packUnsignedTxForSignEvm({ encodedTx } as never);
    const { v, r, s } = new ethers.utils.SigningKey(privateKey).signDigest(
      digest,
    );
    return { v, r, s };
  }

  const accountSignature = signWith(accountPrivateKey);

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
    const signature = accountSignature;
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
      payload: accountSignature,
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

  it('rejects a signature that recovers to another address', async () => {
    const evmSignTransaction = jest.fn().mockResolvedValue({
      success: true,
      payload: signWith(otherPrivateKey),
    });
    const { keyring } = buildKeyring(evmSignTransaction);

    await expect(
      keyring.signTransaction({
        unsignedTx: { encodedTx },
        deviceParams: { dbDevice },
      } as never),
    ).rejects.toBeInstanceOf(ThirdPartyDeviceMismatch);
  });

  it('returns the signed tx when the signature recovers to the account', async () => {
    const evmSignTransaction = jest.fn().mockResolvedValue({
      success: true,
      payload: accountSignature,
    });
    const { keyring } = buildKeyring(evmSignTransaction);

    const result = await keyring.signTransaction({
      unsignedTx: { encodedTx },
      deviceParams: { dbDevice },
    } as never);

    expect(
      ethers.utils.parseTransaction(result.rawTx).from?.toLowerCase(),
    ).toBe(encodedTx.from.toLowerCase());
  });
});

describe('KeyringHardwareKeystone.signMessage', () => {
  const dbDevice = {
    connectId: 'keystone-wallet:test',
    deviceId: 'wallet-id',
  };
  const accountPath = "m/44'/60'/0'/0/0";
  const signer = new ethers.Wallet(`0x${'0c'.repeat(32)}`);
  const otherSigner = new ethers.Wallet(`0x${'0d'.repeat(32)}`);

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
          getAccountAddress: jest.fn().mockResolvedValue(signer.address),
        },
      },
    ) as KeyringHardwareKeystone;
    return { keyring, getAdapterForVendor };
  }

  it('hex-encodes a plain personal_sign string and always sets hex:true', async () => {
    const signature = await signer.signMessage('hello');
    const evmSignMessage = jest
      .fn()
      .mockResolvedValue({ success: true, payload: { signature } });
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
    expect(signatures).toEqual([signature]);
  });

  it('passes an already-hex personal_sign message through unchanged', async () => {
    const signature = await signer.signMessage(
      ethers.utils.arrayify('0xdeadbeef'),
    );
    const evmSignMessage = jest
      .fn()
      .mockResolvedValue({ success: true, payload: { signature } });
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
    const typedData = {
      domain: { name: 'Test', chainId: 1 },
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'chainId', type: 'uint256' },
        ],
        Mail: [{ name: 'contents', type: 'string' }],
      },
      primaryType: 'Mail',
      message: { contents: 'hi' },
    };
    const messageJson = stringUtils.stableStringify(typedData);
    const signature = await signer._signTypedData(
      typedData.domain,
      { Mail: typedData.types.Mail },
      typedData.message,
    );
    const evmSignTypedData = jest.fn().mockResolvedValue({
      success: true,
      payload: { signature },
    });
    const { keyring } = buildKeyring({ evmSignTypedData });

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

  it.each([
    ['empty bytes', '0x', new Uint8Array()],
    ['unprefixed hex', 'deadbeef', ethers.utils.arrayify('0xdeadbeef')],
    [
      'Unicode text',
      '你好 Keystone',
      ethers.utils.toUtf8Bytes('你好 Keystone'),
    ],
  ])(
    'accepts a matching personal signature for %s',
    async (_label, message, bytes) => {
      const signature = await signer.signMessage(bytes);
      const evmSignMessage = jest.fn().mockResolvedValue({
        success: true,
        payload: { signature },
      });
      const { keyring } = buildKeyring({ evmSignMessage });
      await expect(
        keyring.signMessage({
          messages: [{ type: EMessageTypesEth.PERSONAL_SIGN, message }],
          deviceParams: { dbDevice },
        } as never),
      ).resolves.toEqual([signature]);
    },
  );

  it.each(['wrong account', 'wrong message', 'malformed signature'])(
    'rejects personal_sign with %s',
    async (scenario) => {
      const signature =
        scenario === 'malformed signature'
          ? '0x00'
          : await (
              scenario === 'wrong account' ? otherSigner : signer
            ).signMessage(
              scenario === 'wrong message' ? 'different message' : 'hello',
            );
      const evmSignMessage = jest.fn().mockResolvedValue({
        success: true,
        payload: { signature },
      });
      const { keyring } = buildKeyring({ evmSignMessage });
      await expect(
        keyring.signMessage({
          messages: [
            { type: EMessageTypesEth.PERSONAL_SIGN, message: 'hello' },
          ],
          deviceParams: { dbDevice },
        } as never),
      ).rejects.toBeInstanceOf(ThirdPartyDeviceMismatch);
    },
  );

  describe.each([
    EMessageTypesEth.TYPED_DATA_V3,
    EMessageTypesEth.TYPED_DATA_V4,
  ])('typed message %s', (type) => {
    const domain = { name: 'Keystone test', chainId: 1 };
    const types = {
      Mail: [
        { name: 'contents', type: 'string' },
        { name: 'amount', type: 'int256' },
      ],
    };
    const contents = 'Keep "9007199254740993" and \\ unchanged';
    const makeData = (amount: string) => ({
      domain,
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'chainId', type: 'uint256' },
        ],
        ...types,
      },
      primaryType: 'Mail',
      message: { contents, amount },
    });

    it.each([
      ['9007199254740993', '9007199254740993'],
      ['-9007199254740993', '-9007199254740993'],
      ['90071992547409930', '9.007199254740993e16'],
    ])(
      'verifies exact unsafe integer %s without changing request JSON',
      async (amount, literal) => {
        const data = makeData(amount);
        const message = stringUtils
          .stableStringify(data)
          .replace(`"${amount}"`, literal);
        const signature = await signer._signTypedData(
          domain,
          types,
          data.message,
        );
        const evmSignTypedData = jest.fn().mockResolvedValue({
          success: true,
          payload: { signature },
        });
        const { keyring } = buildKeyring({ evmSignTypedData });
        await expect(
          keyring.signMessage({
            messages: [{ type, message }],
            deviceParams: { dbDevice },
          } as never),
        ).resolves.toEqual([signature]);
        expect(evmSignTypedData).toHaveBeenCalledWith(
          dbDevice.connectId,
          dbDevice.deviceId,
          expect.objectContaining({ dataJson: message }),
        );
      },
    );

    it.each([
      'matching',
      'wrong account',
      'wrong message',
      'malformed signature',
    ])('handles %s', async (scenario) => {
      const data = makeData('123');
      const signature =
        scenario === 'malformed signature'
          ? '0x00'
          : await (
              scenario === 'wrong account' ? otherSigner : signer
            )._signTypedData(domain, types, {
              ...data.message,
              amount: scenario === 'wrong message' ? '124' : '123',
            });
      const evmSignTypedData = jest.fn().mockResolvedValue({
        success: true,
        payload: { signature },
      });
      const { keyring } = buildKeyring({ evmSignTypedData });
      const result = keyring.signMessage({
        messages: [{ type, message: stringUtils.stableStringify(data) }],
        deviceParams: { dbDevice },
      } as never);
      if (scenario === 'matching') {
        await expect(result).resolves.toEqual([signature]);
      } else {
        await expect(result).rejects.toBeInstanceOf(ThirdPartyDeviceMismatch);
      }
    });
  });

  it('rejects incomplete hex bytes before asking the device to sign', async () => {
    const evmSignMessage = jest.fn();
    const { keyring } = buildKeyring({ evmSignMessage });
    await expect(
      keyring.signMessage({
        messages: [{ type: EMessageTypesEth.PERSONAL_SIGN, message: '0xabc' }],
        deviceParams: { dbDevice },
      } as never),
    ).rejects.toThrow('complete hex bytes');
    expect(evmSignMessage).not.toHaveBeenCalled();
  });

  it('verifies V4 arrays and rejects a signature over rounded integer values', async () => {
    const domain = {};
    const types = { Batch: [{ name: 'amounts', type: 'uint256[]' }] };
    const data = {
      domain,
      types: { EIP712Domain: [], ...types },
      primaryType: 'Batch',
      message: { amounts: ['9007199254740993', '9007199254740995'] },
    };
    const message = stringUtils
      .stableStringify(data)
      .replace('"9007199254740993"', '9007199254740993')
      .replace('"9007199254740995"', '9007199254740995');
    const signature = await signer._signTypedData(domain, types, data.message);
    const roundedSignature = await signer._signTypedData(domain, types, {
      amounts: ['9007199254740992', '9007199254740996'],
    });
    const evmSignTypedData = jest
      .fn()
      .mockResolvedValueOnce({ success: true, payload: { signature } })
      .mockResolvedValueOnce({
        success: true,
        payload: { signature: roundedSignature },
      });
    const { keyring } = buildKeyring({ evmSignTypedData });
    const params = {
      messages: [{ type: EMessageTypesEth.TYPED_DATA_V4, message }],
      deviceParams: { dbDevice },
    };
    await expect(keyring.signMessage(params as never)).resolves.toEqual([
      signature,
    ]);
    await expect(keyring.signMessage(params as never)).rejects.toBeInstanceOf(
      ThirdPartyDeviceMismatch,
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

describe('KeyringHardwareKeystone.batchGetAddresses', () => {
  function buildKeyring() {
    const getAdapterForVendor = jest.fn();
    const keyring = Object.assign(
      Object.create(KeyringHardwareKeystone.prototype),
      {
        hwSdkNetwork: 'evm',
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
