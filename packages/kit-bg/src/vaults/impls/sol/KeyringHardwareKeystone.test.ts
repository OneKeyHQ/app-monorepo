import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';
import {
  Keypair,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

import { parseToNativeTx } from '@onekeyhq/core/src/chains/sol/sdkSol/parse';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  ThirdPartyDeviceMismatch,
  ThirdPartyMethodNotSupported,
  ThirdPartyUserRejected,
} from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';

import { EDBAccountType } from '../../../dbs/local/consts';

import { KeyringHardwareKeystone } from './KeyringHardwareKeystone';

describe('KeyringHardwareKeystone.buildHwAllNetworkPrepareAccountsParams', () => {
  it('forwards the derived path without a chain id', async () => {
    const keyring = Object.assign(
      Object.create(KeyringHardwareKeystone.prototype),
      { hwSdkNetwork: 'sol' },
    ) as KeyringHardwareKeystone;

    await expect(
      keyring.buildHwAllNetworkPrepareAccountsParams({
        path: "m/44'/501'/0'/0'",
        template: "m/44'/501'/{index}'/0'",
        index: 0,
      } as never),
    ).resolves.toEqual({
      network: 'sol',
      path: "m/44'/501'/0'/0'",
      showOnOneKey: false,
    });
  });
});

describe('KeyringHardwareKeystone.prepareAccounts multi-network bundle', () => {
  it('dispatches each index to the sol bucket of a shared all-network bundle', async () => {
    // Simulates one all-network batch response keyed by hwSdkNetwork + path;
    // only the sol bucket should be consulted, and each index must resolve to its own entry, not another chain's entry sharing that index.
    const bundle: Record<string, Record<string, { address: string }>> = {
      evm: {
        "m/44'/60'/0'/0/0": { address: 'evm-address-0' },
        "m/44'/60'/0'/0/1": { address: 'evm-address-1' },
      },
      sol: {
        "m/44'/501'/0'/0'": { address: 'sol-address-0' },
        "m/44'/501'/1'/0'": { address: 'sol-address-1' },
      },
    };
    const getItem = jest.fn(
      async ({
        path,
        hwSdkNetwork,
      }: {
        path: string;
        hwSdkNetwork: string;
      }) => {
        const item = bundle[hwSdkNetwork]?.[path];
        return item
          ? {
              success: true,
              path,
              network: hwSdkNetwork,
              payload: { address: item.address },
            }
          : {
              success: false,
              path,
              network: hwSdkNetwork,
              payload: { error: 'no such account' },
            };
      },
    );
    const validateAddress = jest.fn(async (address: string) => ({
      normalizedAddress: `normalized-${address}`,
    }));

    // prepareAccounts, basePrepareHdNormalAccounts, and
    // getAllNetworkPrepareAccounts are real here; only the adapter boundary (getItem) and vault.validateAddress are mocked.
    const keyring = Object.assign(
      Object.create(KeyringHardwareKeystone.prototype),
      {
        walletId: 'hw-wallet-id',
        hwSdkNetwork: 'sol',
        getVaultSettings: jest.fn().mockResolvedValue({
          accountType: EDBAccountType.SIMPLE,
          impl: 'sol',
        }),
        vault: { validateAddress },
      },
    ) as KeyringHardwareKeystone;

    const result = await keyring.prepareAccounts({
      indexes: [0, 1],
      deriveInfo: {
        coinType: '501',
        // accountUtils.buildPathFromTemplate() substitutes the literal
        // $$INDEX$$ placeholder, not a "{index}" token.
        template: "m/44'/501'/$$INDEX$$'/0'",
        namePrefix: 'SOL',
      },
      hwAllNetworkPrepareAccountsResponse: {
        getItem,
        getFirstErrorItem: jest.fn(),
      },
    } as never);

    expect(result).toEqual([
      expect.objectContaining({
        path: "m/44'/501'/0'/0'",
        address: 'normalized-sol-address-0',
      }),
      expect.objectContaining({
        path: "m/44'/501'/1'/0'",
        address: 'normalized-sol-address-1',
      }),
    ]);
    expect(getItem).toHaveBeenCalledTimes(2);
    for (const call of getItem.mock.calls) {
      expect(call[0]).toEqual(expect.objectContaining({ hwSdkNetwork: 'sol' }));
    }
    expect(getItem).not.toHaveBeenCalledWith(
      expect.objectContaining({ hwSdkNetwork: 'evm' }),
    );
  });
});

describe('KeyringHardwareKeystone.signTransaction', () => {
  const dbDevice = {
    connectId: 'keystone-wallet:test',
    deviceId: 'wallet-id',
  };
  const accountPath = "m/44'/501'/0'/0'";

  function buildUnsignedTransaction() {
    const feePayer = Keypair.generate();
    const recipient = Keypair.generate();
    const tx = new Transaction();
    tx.feePayer = feePayer.publicKey;
    tx.recentBlockhash = bs58.encode(Buffer.alloc(32, 7));
    tx.add(
      SystemProgram.transfer({
        fromPubkey: feePayer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1000,
      }),
    );
    const encodedTx = bs58.encode(
      tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
    );
    return { feePayer, encodedTx };
  }

  function buildUnsignedVersionedTransaction() {
    const feePayer = Keypair.generate();
    const recipient = Keypair.generate();
    const message = new TransactionMessage({
      payerKey: feePayer.publicKey,
      recentBlockhash: bs58.encode(Buffer.alloc(32, 7)),
      instructions: [
        SystemProgram.transfer({
          fromPubkey: feePayer.publicKey,
          toPubkey: recipient.publicKey,
          lamports: 1000,
        }),
      ],
    }).compileToV0Message();
    const encodedTx = bs58.encode(
      new VersionedTransaction(message).serialize(),
    );
    return { feePayer, encodedTx };
  }

  function buildKeyring(solSignTransaction: jest.Mock) {
    const getAdapterForVendor = jest
      .fn()
      .mockResolvedValue({ hw: { solSignTransaction } });
    const keyring = Object.assign(
      Object.create(KeyringHardwareKeystone.prototype),
      {
        backgroundApi: {
          serviceThirdPartyHardware: { getAdapterForVendor },
        },
        vault: { getAccountPath: jest.fn().mockResolvedValue(accountPath) },
      },
    ) as KeyringHardwareKeystone;
    return { keyring, getAdapterForVendor };
  }

  it('signs the parsed message and produces a verifiable signed transaction', async () => {
    const { feePayer, encodedTx } = buildUnsignedTransaction();
    const parsed = parseToNativeTx(encodedTx) as Transaction;
    const expectedSerializedTx = parsed.serializeMessage().toString('hex');
    const signature = nacl.sign.detached(
      parsed.serializeMessage(),
      feePayer.secretKey,
    );
    const signatureHex = Buffer.from(signature).toString('hex');
    const solSignTransaction = jest.fn().mockResolvedValue({
      success: true,
      payload: { signature: signatureHex },
    });
    const { keyring } = buildKeyring(solSignTransaction);

    const result = await keyring.signTransaction({
      unsignedTx: {
        encodedTx,
        payload: { feePayer: feePayer.publicKey.toBase58() },
      },
      deviceParams: { dbDevice },
    } as never);

    expect(solSignTransaction).toHaveBeenCalledWith(
      dbDevice.connectId,
      dbDevice.deviceId,
      expect.objectContaining({
        path: accountPath,
        serializedTx: expectedSerializedTx,
      }),
    );
    expect(result.txid).toBe(bs58.encode(signature));

    const finalTx = Transaction.from(Buffer.from(result.rawTx, 'base64'));
    expect(finalTx.verifySignatures()).toBe(true);
    expect(finalTx.feePayer?.toBase58()).toBe(feePayer.publicKey.toBase58());
  });

  it('signs a versioned transaction and keeps the device signature', async () => {
    const { feePayer, encodedTx } = buildUnsignedVersionedTransaction();
    const parsed = parseToNativeTx(encodedTx) as VersionedTransaction;
    const messageBytes = parsed.message.serialize();
    const signature = nacl.sign.detached(messageBytes, feePayer.secretKey);
    const solSignTransaction = jest.fn().mockResolvedValue({
      success: true,
      payload: { signature: Buffer.from(signature).toString('hex') },
    });
    const { keyring } = buildKeyring(solSignTransaction);

    const result = await keyring.signTransaction({
      unsignedTx: {
        encodedTx,
        payload: { feePayer: feePayer.publicKey.toBase58() },
      },
      deviceParams: { dbDevice },
    } as never);

    expect(solSignTransaction).toHaveBeenCalledWith(
      dbDevice.connectId,
      dbDevice.deviceId,
      expect.objectContaining({
        serializedTx: Buffer.from(messageBytes).toString('hex'),
      }),
    );
    expect(result.txid).toBe(bs58.encode(signature));
    const finalTx = VersionedTransaction.deserialize(
      Buffer.from(result.rawTx, 'base64'),
    );
    expect(Buffer.from(finalTx.signatures[0])).toEqual(Buffer.from(signature));
  });

  it('rejects a signature produced by another key instead of returning it', async () => {
    const { feePayer, encodedTx } = buildUnsignedTransaction();
    const parsed = parseToNativeTx(encodedTx) as Transaction;
    // A different Keystone device or account answering the same scan.
    const foreignSigner = Keypair.generate();
    const signature = nacl.sign.detached(
      parsed.serializeMessage(),
      foreignSigner.secretKey,
    );
    const solSignTransaction = jest.fn().mockResolvedValue({
      success: true,
      payload: { signature: Buffer.from(signature).toString('hex') },
    });
    const { keyring } = buildKeyring(solSignTransaction);

    await expect(
      keyring.signTransaction({
        unsignedTx: {
          encodedTx,
          payload: { feePayer: feePayer.publicKey.toBase58() },
        },
        deviceParams: { dbDevice },
      } as never),
    ).rejects.toBeInstanceOf(ThirdPartyDeviceMismatch);
    expect(solSignTransaction).toHaveBeenCalledTimes(1);
  });

  it('rejects a versioned-transaction signature produced by another key', async () => {
    const { feePayer, encodedTx } = buildUnsignedVersionedTransaction();
    const parsed = parseToNativeTx(encodedTx) as VersionedTransaction;
    const foreignSigner = Keypair.generate();
    const signature = nacl.sign.detached(
      parsed.message.serialize(),
      foreignSigner.secretKey,
    );
    const solSignTransaction = jest.fn().mockResolvedValue({
      success: true,
      payload: { signature: Buffer.from(signature).toString('hex') },
    });
    const { keyring } = buildKeyring(solSignTransaction);

    await expect(
      keyring.signTransaction({
        unsignedTx: {
          encodedTx,
          payload: { feePayer: feePayer.publicKey.toBase58() },
        },
        deviceParams: { dbDevice },
      } as never),
    ).rejects.toBeInstanceOf(ThirdPartyDeviceMismatch);
  });

  it('rejects a signature over a different message', async () => {
    const { feePayer, encodedTx } = buildUnsignedTransaction();
    // Correct signer, wrong payload: the device answered for another tx.
    const signature = nacl.sign.detached(
      Buffer.from('another transaction message'),
      feePayer.secretKey,
    );
    const solSignTransaction = jest.fn().mockResolvedValue({
      success: true,
      payload: { signature: Buffer.from(signature).toString('hex') },
    });
    const { keyring } = buildKeyring(solSignTransaction);

    await expect(
      keyring.signTransaction({
        unsignedTx: {
          encodedTx,
          payload: { feePayer: feePayer.publicKey.toBase58() },
        },
        deviceParams: { dbDevice },
      } as never),
    ).rejects.toBeInstanceOf(ThirdPartyDeviceMismatch);
  });

  it('rejects when parsing the encoded transaction fails', async () => {
    const solSignTransaction = jest.fn();
    const { keyring } = buildKeyring(solSignTransaction);
    const feePayer = Keypair.generate();

    await expect(
      keyring.signTransaction({
        unsignedTx: {
          encodedTx: '',
          payload: { feePayer: feePayer.publicKey.toBase58() },
        },
        deviceParams: { dbDevice },
      } as never),
    ).rejects.toBeInstanceOf(OneKeyLocalError);
    expect(solSignTransaction).not.toHaveBeenCalled();
  });

  it('rejects when the adapter reports a device-side rejection', async () => {
    const { encodedTx, feePayer } = buildUnsignedTransaction();
    const solSignTransaction = jest.fn().mockResolvedValue({
      success: false,
      payload: {
        error: 'rejected on device',
        code: HardwareErrorCode.UserRejected,
      },
    });
    const { keyring } = buildKeyring(solSignTransaction);

    await expect(
      keyring.signTransaction({
        unsignedTx: {
          encodedTx,
          payload: { feePayer: feePayer.publicKey.toBase58() },
        },
        deviceParams: { dbDevice },
      } as never),
    ).rejects.toBeInstanceOf(ThirdPartyUserRejected);
    expect(solSignTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('KeyringHardwareKeystone.signMessage', () => {
  it('keeps unverified off-chain message signing disabled', async () => {
    const keyring = Object.create(
      KeyringHardwareKeystone.prototype,
    ) as KeyringHardwareKeystone;

    await expect(keyring.signMessage({} as never)).rejects.toBeInstanceOf(
      ThirdPartyMethodNotSupported,
    );
  });
});

describe('KeyringHardwareKeystone.batchGetAddresses', () => {
  function buildKeyring() {
    const getAdapterForVendor = jest.fn();
    const keyring = Object.assign(
      Object.create(KeyringHardwareKeystone.prototype),
      {
        hwSdkNetwork: 'sol',
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
