import { ethers } from '@onekeyhq/core/src/chains/evm/sdkEvm/ethers';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { SEND_TX_SERVER_ERROR_CODES } from '@onekeyhq/shared/src/engine/engineConsts';
import { JsonRPCResponseError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { GAS_ACCOUNT_SUBMIT_REJECTED_CODES } from '@onekeyhq/shared/src/errors/utils/gasAccountErrorUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EReplaceTxType } from '@onekeyhq/shared/types/tx';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { ESignedTxBroadcastStatus } from '../../types';

// Importing the vault pulls in the localDb singleton, whose constructor opens
// IndexedDB at module load and crashes under jest's node environment.
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

// eslint-disable-next-line import/first
import EvmVault from './Vault';

// Instantiating the full vault requires a backgroundApi context; the
// buildUnsignedTx nonce-chaining path only touches networkId, so a bare
// prototype instance is enough.
const buildVault = () => {
  const vault = Object.create(EvmVault.prototype) as EvmVault;
  vault.networkId = 'evm--8453';
  return vault;
};

const baseEncodedTx: IEncodedTxEvm = {
  from: '0x1111111111111111111111111111111111111111',
  to: '0x2222222222222222222222222222222222222222',
  value: '0x0',
  data: '0x',
};

describe('EvmVault.buildUnsignedTx nonce chaining', () => {
  it('assigns nonce prevNonce + 1 when prevNonce is 0', async () => {
    const vault = buildVault();
    const unsignedTx = await vault.buildUnsignedTx({
      encodedTx: { ...baseEncodedTx },
      prevNonce: 0,
    });
    expect(unsignedTx.nonce).toBe(1);
    expect((unsignedTx.encodedTx as IEncodedTxEvm).nonce).toBe(1);
  });

  it('assigns nonce prevNonce + 1 when prevNonce is positive', async () => {
    const vault = buildVault();
    const unsignedTx = await vault.buildUnsignedTx({
      encodedTx: { ...baseEncodedTx },
      prevNonce: 5,
    });
    expect(unsignedTx.nonce).toBe(6);
    expect((unsignedTx.encodedTx as IEncodedTxEvm).nonce).toBe(6);
  });

  it('leaves nonce unset when prevNonce is not provided', async () => {
    const vault = buildVault();
    const unsignedTx = await vault.buildUnsignedTx({
      encodedTx: { ...baseEncodedTx },
    });
    expect(unsignedTx.nonce).toBeUndefined();
    expect((unsignedTx.encodedTx as IEncodedTxEvm).nonce).toBeUndefined();
  });
});

// OK-67090: a retry whose earlier broadcast has no verdict may sign again
// only when the chain cannot execute both txs.
describe('EvmVault.isUnsignedTxConflictingWithSignedTx', () => {
  const wallet = ethers.Wallet.createRandom();
  const other = ethers.Wallet.createRandom();

  const signRawTx = (
    signer: typeof wallet,
    tx: { nonce: number; type?: number },
  ) =>
    signer.signTransaction({
      to: baseEncodedTx.to,
      value: 0,
      gasLimit: 21_000,
      chainId: 8453,
      nonce: tx.nonce,
      ...(tx.type === 2
        ? { type: 2, maxFeePerGas: 2, maxPriorityFeePerGas: 1 }
        : { gasPrice: 1 }),
    });

  const check = async (
    rawTx: string,
    encodedTx: Partial<IEncodedTxEvm>,
    nonce?: number,
  ) =>
    buildVault().isUnsignedTxConflictingWithSignedTx({
      unsignedTx: {
        nonce,
        encodedTx: { ...baseEncodedTx, from: wallet.address, ...encodedTx },
      } as IUnsignedTxPro,
      signedTx: { txid: '', rawTx, encodedTx: null },
    });

  it('holds for the same sender and nonce', async () => {
    const rawTx = await signRawTx(wallet, { nonce: 5 });
    await expect(check(rawTx, { nonce: 5 })).resolves.toBe(true);
    // a hex nonce and a lower-cased sender are the same tx slot
    await expect(
      check(rawTx, { nonce: '0x5', from: wallet.address.toLowerCase() }),
    ).resolves.toBe(true);
    // the tx-level nonce is used when the encoded tx carries none
    await expect(check(rawTx, {}, 5)).resolves.toBe(true);
  });

  it('holds for an EIP-1559 payload on the same nonce', async () => {
    const rawTx = await signRawTx(wallet, { nonce: 5, type: 2 });
    await expect(check(rawTx, { nonce: 5 })).resolves.toBe(true);
  });

  it('does not hold for a tx rebuilt on the next nonce', async () => {
    const rawTx = await signRawTx(wallet, { nonce: 5 });
    await expect(check(rawTx, { nonce: 6 })).resolves.toBe(false);
  });

  it('does not hold for another sender on the same nonce', async () => {
    const rawTx = await signRawTx(other, { nonce: 5 });
    await expect(check(rawTx, { nonce: 5 })).resolves.toBe(false);
  });

  it('does not hold when either side cannot be read', async () => {
    const rawTx = await signRawTx(wallet, { nonce: 5 });
    await expect(check('0xnot-a-tx', { nonce: 5 })).resolves.toBe(false);
    await expect(check(rawTx, {})).resolves.toBe(false);
  });
});

describe('EvmVault.checkSignedTxBroadcastStatus', () => {
  const txid = `0x${'ab'.repeat(32)}`;
  const buildVaultWithHistory = (txDetails: unknown) => {
    const fetchHistoryTxDetails = jest.fn(async () => txDetails);
    const vault = buildVault();
    Object.assign(vault, {
      accountId: 'hd-1--0',
      backgroundApi: { serviceHistory: { fetchHistoryTxDetails } },
    });
    return { vault, fetchHistoryTxDetails };
  };
  const check = (vault: EvmVault, signedTxid = txid) =>
    vault.checkSignedTxBroadcastStatus({
      signedTx: { txid: signedTxid, rawTx: '0x', encodedTx: null },
      attemptedAt: 0,
    });

  it('reports a tx the chain can show as broadcast', async () => {
    const { vault, fetchHistoryTxDetails } = buildVaultWithHistory({
      data: {
        tx: txid.toUpperCase().replace('0X', '0x'),
        status: EOnChainHistoryTxStatus.Success,
      },
    });

    await expect(check(vault)).resolves.toBe(
      ESignedTxBroadcastStatus.Broadcast,
    );
    expect(fetchHistoryTxDetails).toHaveBeenCalledWith({
      accountId: 'hd-1--0',
      networkId: 'evm--8453',
      txid,
    });
  });

  it('gives no verdict for a tx the lookup cannot find', async () => {
    // the lookup failed or the tx is in flight: never "not broadcast"
    const { vault } = buildVaultWithHistory(null);
    await expect(check(vault)).resolves.toBe(ESignedTxBroadcastStatus.Unknown);
  });

  it('reports a tx that executed with an error as broadcast', async () => {
    // it consumed its nonce all the same
    const { vault } = buildVaultWithHistory({
      data: { tx: txid, status: EOnChainHistoryTxStatus.Failed },
    });
    await expect(check(vault)).resolves.toBe(
      ESignedTxBroadcastStatus.Broadcast,
    );
  });

  // A custom network answers a lookup that found nothing with a pending
  // placeholder that echoes the requested id. Read as proof, it would replay
  // a tx that never left as sent.
  it('gives no verdict for a pending answer that only echoes the tx id', async () => {
    const { vault } = buildVaultWithHistory({
      data: { tx: txid, status: EOnChainHistoryTxStatus.Pending },
    });
    await expect(check(vault)).resolves.toBe(ESignedTxBroadcastStatus.Unknown);
  });

  it('gives no verdict for an answer without an execution status', async () => {
    const { vault } = buildVaultWithHistory({ data: { tx: txid } });
    await expect(check(vault)).resolves.toBe(ESignedTxBroadcastStatus.Unknown);
  });

  it('gives no verdict when the lookup answers about another tx', async () => {
    const { vault } = buildVaultWithHistory({
      data: {
        tx: `0x${'cd'.repeat(32)}`,
        status: EOnChainHistoryTxStatus.Success,
      },
    });
    await expect(check(vault)).resolves.toBe(ESignedTxBroadcastStatus.Unknown);
  });

  it('gives no verdict without a tx id to look up', async () => {
    const { vault, fetchHistoryTxDetails } = buildVaultWithHistory(null);
    await expect(check(vault, '')).resolves.toBe(
      ESignedTxBroadcastStatus.Unknown,
    );
    expect(fetchHistoryTxDetails).not.toHaveBeenCalled();
  });

  it('skips the lookup for a payload the node already accepted', async () => {
    // such a tx is replayed either way; a batch of them must not cost one
    // request each
    const { vault, fetchHistoryTxDetails } = buildVaultWithHistory({
      data: { tx: txid, status: EOnChainHistoryTxStatus.Success },
    });
    await expect(
      vault.checkSignedTxBroadcastStatus({
        signedTx: { txid, rawTx: '0x', encodedTx: null },
        attemptedAt: 0,
        isAcceptedByNode: true,
      }),
    ).resolves.toBe(ESignedTxBroadcastStatus.Unknown);
    expect(fetchHistoryTxDetails).not.toHaveBeenCalled();
  });
});

describe('EvmVault.isSignedTxRejectedByBroadcast', () => {
  const buildVaultWithCustomRpc = (
    customRpcInfo: { rpc: string; enabled: boolean } | undefined,
  ) => {
    const vault = buildVault();
    Object.assign(vault, {
      backgroundApi: {
        serviceCustomRpc: {
          getCustomRpcForNetwork: jest.fn(async () => customRpcInfo),
        },
        serviceSend: {
          isReplaceTxNonceAlreadyUsedRpcError: (error: Error) =>
            error.message.includes('nonce too low'),
        },
      },
    });
    return vault;
  };
  const serverError = (code: number) => ({
    className: EOneKeyErrorClassNames.OneKeyServerApiError,
    code,
  });

  it('holds for an explicit rejection reported by the server broadcast', async () => {
    const vault = buildVaultWithCustomRpc(undefined);
    await expect(
      vault.isSignedTxRejectedByBroadcast(
        serverError(SEND_TX_SERVER_ERROR_CODES.NONCE_ALREADY_USED),
      ),
    ).resolves.toBe(true);
  });

  it('does not hold for a server error that is not an evaluation of the tx', async () => {
    const vault = buildVaultWithCustomRpc(undefined);
    await expect(
      vault.isSignedTxRejectedByBroadcast(serverError(50_000)),
    ).resolves.toBe(false);
    await expect(
      vault.isSignedTxRejectedByBroadcast(
        new Error('timeout of 10000ms exceeded'),
      ),
    ).resolves.toBe(false);
  });

  // The custom RPC node took the tx before the server was told about it, so
  // a server error there says nothing about the broadcast.
  it('does not hold for a server error when a custom RPC did the broadcast', async () => {
    const vault = buildVaultWithCustomRpc({
      rpc: 'https://rpc.example.test',
      enabled: true,
    });
    await expect(
      vault.isSignedTxRejectedByBroadcast(
        serverError(SEND_TX_SERVER_ERROR_CODES.NONCE_ALREADY_USED),
      ),
    ).resolves.toBe(false);
  });

  // "Use the OneKey RPC this once" on the confirm page: the server did the
  // broadcast although a custom RPC is still enabled, so its rejection is
  // an evaluation of the tx.
  it('holds for a server error when this send was routed to the default RPC', async () => {
    const vault = buildVaultWithCustomRpc({
      rpc: 'https://rpc.example.test',
      enabled: true,
    });
    await expect(
      vault.isSignedTxRejectedByBroadcast(
        serverError(SEND_TX_SERVER_ERROR_CODES.NONCE_ALREADY_USED),
        { useDefaultRpc: true },
      ),
    ).resolves.toBe(true);
    await expect(
      vault.isSignedTxRejectedByBroadcast(serverError(50_000), {
        useDefaultRpc: true,
      }),
    ).resolves.toBe(false);
  });

  it("holds for the custom RPC node's own nonce rejection only", async () => {
    const vault = buildVaultWithCustomRpc({
      rpc: 'https://rpc.example.test',
      enabled: true,
    });
    await expect(
      vault.isSignedTxRejectedByBroadcast(
        new JsonRPCResponseError('nonce too low'),
      ),
    ).resolves.toBe(true);
    await expect(
      vault.isSignedTxRejectedByBroadcast(
        new JsonRPCResponseError('already known'),
      ),
    ).resolves.toBe(false);
  });

  // A sponsor quote is bound to one nonce. A send the backend refused at
  // admission (40209: the nonce no longer matches the quote) was never
  // executed, so the tx the user corrected on the confirm page may be signed
  // instead of the refused payload being sent again.
  it.each(GAS_ACCOUNT_SUBMIT_REJECTED_CODES)(
    'holds for a sponsored send refused at admission (%s)',
    async (code) => {
      const vault = buildVaultWithCustomRpc(undefined);
      await expect(
        vault.isSignedTxRejectedByBroadcast(serverError(code)),
      ).resolves.toBe(true);
    },
  );

  // Execute and transport failures: the tx may already be on chain.
  it.each([40_203, 90_200, 90_205, 90_219, 400])(
    'does not hold for a sponsored send whose result is unknown (%s)',
    async (code) => {
      const vault = buildVaultWithCustomRpc(undefined);
      await expect(
        vault.isSignedTxRejectedByBroadcast(serverError(code)),
      ).resolves.toBe(false);
    },
  );

  it('does not hold for an admission refusal when a custom RPC did the broadcast', async () => {
    const vault = buildVaultWithCustomRpc({
      rpc: 'https://rpc.example.test',
      enabled: true,
    });
    await expect(
      vault.isSignedTxRejectedByBroadcast(serverError(40_209)),
    ).resolves.toBe(false);
  });
});

// OK-67032: an access list is part of the signed bytes, so fee estimation
// and replacement must describe the same transaction that gets signed.
describe('EvmVault access list', () => {
  const accessList = [
    {
      address: `0x${'00'.repeat(20)}`,
      storageKeys: [`0x${'22'.repeat(32)}`, `0x${'11'.repeat(32)}`],
    },
  ];
  const sentTx: IEncodedTxEvm = {
    ...baseEncodedTx,
    data: '0x12345678',
    nonce: 3,
    gasLimit: '0x5208',
    maxFeePerGas: '0x77359400',
    maxPriorityFeePerGas: '0x3b9aca00',
  };

  describe('buildEstimateFeeParams', () => {
    it('sends the access list with the fee estimate', async () => {
      const { encodedTx } = await buildVault().buildEstimateFeeParams({
        encodedTx: { ...sentTx, accessList },
      });
      expect(encodedTx?.accessList).toEqual(accessList);
    });

    it('leaves out an empty access list', async () => {
      const { encodedTx } = await buildVault().buildEstimateFeeParams({
        encodedTx: { ...sentTx, accessList: [] },
      });
      expect(encodedTx).not.toHaveProperty('accessList');
    });

    // The estimate has to price the transaction the signer will send, and
    // these two never carry the list.
    it('leaves out the access list for a QR wallet, which signs without it', async () => {
      const vault = buildVault();
      vault.walletId = 'qr-00000000-0000-0000-0000-000000000000';
      const { encodedTx } = await vault.buildEstimateFeeParams({
        encodedTx: { ...sentTx, accessList },
      });
      expect(encodedTx).not.toHaveProperty('accessList');
    });

    it('leaves out the access list on a chain that rejects access lists', async () => {
      const vault = buildVault();
      vault.networkId = 'evm--324';
      const { encodedTx } = await vault.buildEstimateFeeParams({
        encodedTx: { ...sentTx, accessList },
      });
      expect(encodedTx).not.toHaveProperty('accessList');
    });
  });

  describe('buildReplaceEncodedTx', () => {
    const buildDecodedTx = (encodedTx: IEncodedTxEvm) =>
      ({ encodedTx, nonce: 3 }) as unknown as IDecodedTx;

    it('keeps the access list when speeding up', async () => {
      const replacement = await buildVault().buildReplaceEncodedTx({
        decodedTx: buildDecodedTx({ ...sentTx, accessList }),
        replaceType: EReplaceTxType.SpeedUp,
      });
      expect(replacement.accessList).toEqual(accessList);
    });

    it('takes the access list from the encrypted original when one is stored', async () => {
      const vault = buildVault();
      vault.backgroundApi = {
        servicePassword: {
          decryptByInstanceId: jest
            .fn()
            .mockResolvedValue(JSON.stringify({ ...sentTx, accessList })),
        },
      } as unknown as EvmVault['backgroundApi'];

      const replacement = await vault.buildReplaceEncodedTx({
        decodedTx: {
          ...buildDecodedTx({
            ...sentTx,
            accessList: [{ address: `0x${'99'.repeat(20)}`, storageKeys: [] }],
          }),
          encodedTxEncrypted: 'encrypted',
        },
        replaceType: EReplaceTxType.SpeedUp,
      });
      expect(replacement.accessList).toEqual(accessList);
    });

    it('drops the access list when cancelling', async () => {
      const replacement = await buildVault().buildReplaceEncodedTx({
        decodedTx: buildDecodedTx({ ...sentTx, accessList }),
        replaceType: EReplaceTxType.Cancel,
      });
      expect(replacement).not.toHaveProperty('accessList');
    });
  });
});
