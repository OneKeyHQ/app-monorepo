import { ethers } from '@onekeyhq/core/src/chains/evm/sdkEvm/ethers';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { SEND_TX_SERVER_ERROR_CODES } from '@onekeyhq/shared/src/engine/engineConsts';
import { JsonRPCResponseError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';

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
      data: { tx: txid.toUpperCase().replace('0X', '0x') },
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

  it('gives no verdict when the lookup answers about another tx', async () => {
    const { vault } = buildVaultWithHistory({
      data: { tx: `0x${'cd'.repeat(32)}` },
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
      data: { tx: txid },
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
});
