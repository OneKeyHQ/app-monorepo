// cspell:ignore piconero
/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import type { IXmrRuntimeApi } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { getViewingKeyFingerprint } from '../../localWallet/viewingKeyFingerprint';

import Vault from './Vault';

import type { IEncodedTxXmr } from './types';

// The send path's handoffs (fee carrier, broadcast payload, confirmed amount);
// the cryptography is tested in the Rust runtime.

const ACCOUNT_ID = "hd-1--m/44'/128'/0'";
const VIEWING_KEY = 'aa:bb';
// The runtime names the identity by the stored key's fingerprint.
const VK_FP = getViewingKeyFingerprint({
  networkId: 'xmr--0',
  viewingKey: VIEWING_KEY,
});
const privacyChainKeys = {
  getKey: async () => ({
    networkId: 'xmr--0',
    vkFp: VK_FP,
    sealed: { format: 'plain', value: VIEWING_KEY },
  }),
};
const PRIMARY =
  '468bCTr2Sa9AR2hJ4aBuQu4JkQtLWx6qe6NZWxW7wkcCVG7rLxNagUPdcsB4DJZi3t5TY8grqUfmaW38vHxQimo9SV2g7TZ';
const RECIPIENT =
  '4AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skxNgYeYTRj5UzqtReoS44qo9mtmXCqY45DJ852K5Jv2684Rge';

type IFakeRuntime = IXmrRuntimeApi & {
  prepared: {
    maxSend: boolean;
    recipientsJson: string;
  }[];
};

const LIVE_TIP = 3_767_827;

function createVault(options?: {
  prepare?: (args: { maxSend: boolean }) => Record<string, unknown>;
  broadcast?: () => Promise<string>;
  recordXmrSent?: () => Promise<void>;
}) {
  const prepared: IFakeRuntime['prepared'] = [];

  const runtime = {
    prepared,
    listAccounts: () =>
      JSON.stringify({ items: [{ accountId: 7, uuid: VK_FP }] }),
    chainTip: async () => JSON.stringify({ height: 3_767_827 }),
    prepareTransaction: async (
      _accountId: string,
      recipientsJson: string,
      maxSend: boolean,
    ) => {
      prepared.push({ maxSend, recipientsJson });
      const requested = (
        JSON.parse(recipientsJson) as { amountAtomic: string }[]
      )[0].amountAtomic;
      return JSON.stringify({
        signableHex: 'aabb',
        feeAtomic: '30000000',
        // Max-send is solved inside the runtime, so it comes back different
        // from what was asked for.
        amountAtomic: maxSend ? '970000000' : requested,
        changeAtomic: maxSend ? '0' : '5000000',
        inputCount: 2,
        ...options?.prepare?.({ maxSend }),
      });
    },
    verifyTransaction: jest.fn(async () => undefined),
    verifySignedTransaction: jest.fn(async () => 'deadbeef'),
    broadcastTransaction:
      options?.broadcast ??
      (async () => JSON.stringify({ txid: 'deadbeef', sizeBytes: 1500 })),
  } as unknown as IFakeRuntime;

  const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
    accountId: ACCOUNT_ID,
    networkId: 'xmr--0',
    backgroundApi: {
      simpleDb: {
        privacyChainKeys,
        privacyChainJournal: {
          recordXmrSent: jest.fn(
            options?.recordXmrSent ?? (async () => undefined),
          ),
        },
      },
      serviceToken: {
        getNativeToken: async () => ({
          address: '',
          name: 'Monero',
          symbol: 'XMR',
          logoURI: '',
        }),
      },
    },
  });

  jest.spyOn(vault, 'getXmrRuntimeApi').mockResolvedValue(runtime);
  // Caught up with the node, unless a test says otherwise.
  jest.spyOn(vault, 'getLocalWalletCapability').mockReturnValue({
    syncPolicy: { sendMaxBlocksLeft: 100 },
    getSyncProgress: async () => ({
      isBackfillComplete: true,
      backfillScannedHeight: LIVE_TIP,
      backfillTargetHeight: LIVE_TIP,
      tipScannedHeight: LIVE_TIP,
      chainTip: LIVE_TIP,
      tipLag: 0,
    }),
  } as never);
  jest.spyOn(vault, 'getAccount').mockResolvedValue({
    address: PRIMARY,
  } as never);
  jest.spyOn(vault, 'getNetwork').mockResolvedValue({
    decimals: 12,
    symbol: 'XMR',
    isTestnet: false,
    feeMeta: { decimals: 12, symbol: 'XMR' },
  } as never);
  jest.spyOn(vault, 'validateAddress').mockImplementation(async (address) => ({
    isValid: address.startsWith('4'),
    normalizedAddress: address,
    displayAddress: address,
  }));
  jest
    .spyOn(vault, 'buildTxTransferAssetAction')
    .mockImplementation(async ({ transfers }) => ({ transfers }) as never);

  return { vault, runtime };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('xmr send: building', () => {
  it('uses the existing send i18n key when unlocked funds are insufficient', async () => {
    const { vault, runtime } = createVault();
    jest.spyOn(runtime, 'prepareTransaction').mockRejectedValue(
      new Error(
        JSON.stringify({
          code: 'TRANSACTION_BUILD_ERROR',
          params: { reason: 'insufficientUnlockedFunds' },
        }),
      ),
    );
    await expect(
      vault.buildUnsignedTx({
        transfersInfo: [{ from: PRIMARY, to: RECIPIENT, amount: '0.001' }],
      } as never),
    ).rejects.toMatchObject({
      key: ETranslations.send_error_insufficient_balance,
      info: { token: 'XMR' },
    });
  });

  it('refuses a recipient that is not a Monero address on this network', async () => {
    const { vault } = createVault();
    await expect(
      vault.buildEncodedTx({
        transfersInfo: [{ from: PRIMARY, to: '9notmainnet', amount: '1' }],
      } as never),
    ).rejects.toThrow(/address_invalid|Invalid address/);
  });

  it('refuses a batch rather than silently sending only the first transfer', async () => {
    const { vault } = createVault();
    await expect(
      vault.buildEncodedTx({
        transfersInfo: [
          { from: PRIMARY, to: RECIPIENT, amount: '1' },
          { from: PRIMARY, to: RECIPIENT, amount: '2' },
        ],
      } as never),
    ).rejects.toThrow(/Batch transfer/);
  });

  // Piconero amounts exceed Number.MAX_SAFE_INTEGER.
  it('carries the amount as an integer string of piconero', async () => {
    const { vault } = createVault();
    const encodedTx = await vault.buildEncodedTx({
      transfersInfo: [{ from: PRIMARY, to: RECIPIENT, amount: '0.0001' }],
    } as never);
    expect(encodedTx.amountAtomic).toBe('100000000');
  });
});

// Cake Wallet refuses to build while 100 or more blocks are left to scan.
describe('xmr send waits for the wallet to catch up', () => {
  function withProgress(
    vault: Vault,
    {
      backfill = 0,
      tipLag,
      displayTip = LIVE_TIP,
      scanning = true,
    }: {
      backfill?: number;
      tipLag: number;
      displayTip?: number;
      scanning?: boolean;
    },
  ) {
    jest.spyOn(vault, 'getLocalWalletCapability').mockReturnValue({
      syncPolicy: { sendMaxBlocksLeft: 100 },
      getSyncProgress: async () =>
        scanning
          ? {
              isBackfillComplete: backfill === 0,
              backfillScannedHeight: 2_000_000 - backfill,
              backfillTargetHeight: 2_000_000,
              tipScannedHeight: displayTip - tipLag,
              chainTip: displayTip,
              tipLag,
            }
          : undefined,
    } as never);
  }

  // Scanning off still leaves the account's outputs in the runtime, frozen
  // at the height it stopped; building from them would pick spent ones.
  it('refuses while scanning is off', async () => {
    const { vault } = createVault();
    withProgress(vault, { tipLag: 0, scanning: false });
    await expect(
      vault.buildEncodedTx({
        transfersInfo: [{ from: PRIMARY, to: RECIPIENT, amount: '0.0001' }],
      } as never),
    ).rejects.toMatchObject({ code: 'XMR_NOT_SYNCED' });
  });

  // A paused chain stops refreshing the display tip, so progress reads
  // "caught up" against a tip that is long past.
  it('measures the lag against the live tip, not the display tip', async () => {
    const { vault } = createVault();
    withProgress(vault, { tipLag: 0, displayTip: LIVE_TIP - 500 });
    await expect(
      vault.buildEncodedTx({
        transfersInfo: [{ from: PRIMARY, to: RECIPIENT, amount: '0.0001' }],
      } as never),
    ).rejects.toMatchObject({ code: 'XMR_NOT_SYNCED' });
  });

  it('refuses while far behind the node', async () => {
    const { vault } = createVault();
    withProgress(vault, { tipLag: 150 });
    await expect(
      vault.buildEncodedTx({
        transfersInfo: [{ from: PRIMARY, to: RECIPIENT, amount: '0.0001' }],
      } as never),
    ).rejects.toMatchObject({ code: 'XMR_NOT_SYNCED' });
  });

  // Backfill counts as much as the tip lag.
  it('counts unfinished backfill together with the tip lag', async () => {
    const { vault } = createVault();
    withProgress(vault, { backfill: 60, tipLag: 40 });
    await expect(
      vault.buildEncodedTx({
        transfersInfo: [{ from: PRIMARY, to: RECIPIENT, amount: '0.0001' }],
      } as never),
    ).rejects.toMatchObject({ code: 'XMR_NOT_SYNCED' });
  });

  it('builds once fewer than 100 blocks are left', async () => {
    const { vault } = createVault();
    withProgress(vault, { tipLag: 50 });
    await expect(
      vault.buildEncodedTx({
        transfersInfo: [{ from: PRIMARY, to: RECIPIENT, amount: '0.0001' }],
      } as never),
    ).resolves.toMatchObject({ amountAtomic: '100000000' });
  });
});

describe('xmr send: the fee comes from the built transaction', () => {
  it('attaches the runtime fee and the built transaction', async () => {
    const { vault, runtime } = createVault();
    const unsignedTx = await vault.buildUnsignedTx({
      transfersInfo: [{ from: PRIMARY, to: RECIPIENT, amount: '0.001' }],
    } as never);
    const encodedTx = unsignedTx.encodedTx as IEncodedTxXmr;

    expect(encodedTx.feeAtomic).toBe('30000000');
    expect(encodedTx.signableHex).toBe('aabb');
    expect(encodedTx.inputCount).toBe(2);
    expect(encodedTx.chainTip).toBe(3_767_827);
    // The review is verified once, by the runtime, right before signing.
    expect(runtime.verifyTransaction).not.toHaveBeenCalled();
  });

  it('reports that fee and nothing else, rather than estimating one', async () => {
    const { vault } = createVault();
    const fee = await vault.estimateFee({
      encodedTx: { feeAtomic: '30000000' } as IEncodedTxXmr,
    } as never);
    expect(fee.data.data.feeUTXO?.[0].feeValue).toBe('0.00003');
  });

  it('refuses to report a fee before the transaction exists', async () => {
    const { vault } = createVault();
    await expect(
      vault.estimateFee({ encodedTx: { amountAtomic: '1' } } as never),
    ).rejects.toThrow(/not been built/);
  });

  it('shows the fee and amount on the decoded transaction', async () => {
    const { vault } = createVault();
    const unsignedTx = await vault.buildUnsignedTx({
      transfersInfo: [{ from: PRIMARY, to: RECIPIENT, amount: '0.001' }],
    } as never);
    const decoded = await vault.buildDecodedTx({ unsignedTx } as never);
    expect(decoded.totalFeeInNative).toBe('0.00003');
    expect(decoded.nativeAmountValue).toBe('1000000000');
  });

  it('snapshots the confirmed payment before awaiting metadata', async () => {
    const { vault } = createVault();
    const unsignedTx = await vault.buildUnsignedTx({
      transfersInfo: [{ from: PRIMARY, to: RECIPIENT, amount: '0.001' }],
    } as never);
    const encodedTx = unsignedTx.encodedTx as IEncodedTxXmr;
    const pending = vault.buildDecodedTx({ unsignedTx });
    encodedTx.to = 'changed-recipient';
    encodedTx.amount = '2';
    encodedTx.amountAtomic = '2000000000000';
    const decoded = await pending;
    expect(decoded.nativeAmountValue).toBe('1000000000');
    expect(decoded.to).toBe(RECIPIENT);
    expect(decoded.encodedTx).not.toBe(encodedTx);
  });
});

describe('xmr send: max', () => {
  // For max send the real amount is `spendable - fee`, known only after build.
  it('takes the resolved amount back from the runtime', async () => {
    const { vault, runtime } = createVault();
    const unsignedTx = await vault.buildUnsignedTx({
      transfersInfo: [{ from: PRIMARY, to: RECIPIENT, amount: '1' }],
      transferPayload: { isMaxSend: true },
    } as never);
    const encodedTx = unsignedTx.encodedTx as IEncodedTxXmr;

    expect(runtime.prepared[0].maxSend).toBe(true);
    expect(encodedTx.amountAtomic).toBe('970000000');
    expect(encodedTx.amount).toBe('0.00097');
  });
});

const broadcastEncodedTx: IEncodedTxXmr = {
  from: PRIMARY,
  to: RECIPIENT,
  amount: '1',
  amountAtomic: '1000000000000',
  feeAtomic: '30000000',
  changeAtomic: '500000000000',
  inputCount: 2,
  priority: 'normal',
  signableHex: 'aabb',
  chainTip: LIVE_TIP,
};

describe('xmr send: broadcast', () => {
  it('does not broadcast when signed transaction verification fails', async () => {
    const broadcast = jest.fn(async () => JSON.stringify({ txid: 'deadbeef' }));
    const { vault, runtime } = createVault({ broadcast });
    jest
      .mocked(runtime.verifySignedTransaction)
      .mockRejectedValue(new Error('signed output mismatch'));
    await expect(
      vault.broadcastTransaction({
        signedTx: {
          txid: 'deadbeef',
          rawTx: '00ff',
          encodedTx: broadcastEncodedTx,
        },
      } as never),
    ).rejects.toThrow('signed output mismatch');
    expect(broadcast).not.toHaveBeenCalled();
  });

  it('does not broadcast when the verified transaction id differs', async () => {
    const broadcast = jest.fn(async () => JSON.stringify({ txid: 'deadbeef' }));
    const { vault, runtime } = createVault({ broadcast });
    jest.mocked(runtime.verifySignedTransaction).mockResolvedValue('cafebabe');
    await expect(
      vault.broadcastTransaction({
        signedTx: {
          txid: 'deadbeef',
          rawTx: '00ff',
          encodedTx: broadcastEncodedTx,
        },
      } as never),
    ).rejects.toThrow('unexpected transaction id before broadcast');
    expect(broadcast).not.toHaveBeenCalled();
  });

  it('does not broadcast through an older runtime without signed verification', async () => {
    const broadcast = jest.fn(async () => JSON.stringify({ txid: 'deadbeef' }));
    const { vault, runtime } = createVault({ broadcast });
    Reflect.deleteProperty(runtime, 'verifySignedTransaction');
    await expect(
      vault.broadcastTransaction({
        signedTx: {
          txid: 'deadbeef',
          rawTx: '00ff',
          encodedTx: broadcastEncodedTx,
        },
      } as never),
    ).rejects.toThrow();
    expect(broadcast).not.toHaveBeenCalled();
  });

  it('rejects malformed bookkeeping amounts before verifying or broadcasting', async () => {
    const broadcast = jest.fn(async () => JSON.stringify({ txid: 'deadbeef' }));
    const { vault, runtime } = createVault({ broadcast });
    await expect(
      vault.broadcastTransaction({
        signedTx: {
          txid: 'deadbeef',
          rawTx: '00ff',
          encodedTx: { ...broadcastEncodedTx, changeAtomic: '01' },
        },
      } as never),
    ).rejects.toThrow('invalid transaction review');
    expect(runtime.verifySignedTransaction).not.toHaveBeenCalled();
    expect(broadcast).not.toHaveBeenCalled();
  });

  // Inputs are not reserved, so going back and rebuilding simply prepares again.
  it('rebuilds from scratch when the review is opened again', async () => {
    const { vault, runtime } = createVault();
    const first = (
      await vault.buildUnsignedTx({
        transfersInfo: [{ from: PRIMARY, to: RECIPIENT, amount: '0.001' }],
      } as never)
    ).encodedTx as IEncodedTxXmr;

    await vault.buildUnsignedTx({
      encodedTx: first,
    } as never);

    expect(runtime.prepared).toHaveLength(2);
  });

  // A lost reply may mean the node has it; releasing inputs could double spend.
  it('reports an unknown outcome when the broadcast call itself is lost', async () => {
    const { vault } = createVault({
      broadcast: () => Promise.reject(new Error('socket closed')),
    });
    await expect(
      vault.broadcastTransaction({
        signedTx: {
          txid: 'deadbeef',
          rawTx: '00ff',
          encodedTx: {
            ...broadcastEncodedTx,
            signableHex: 'aabb',
            chainTip: 3_767_827,
          } as IEncodedTxXmr,
        },
      } as never),
    ).rejects.toThrow(ETranslations.privacy_error_broadcast_unknown__msg);
  });

  // The runtime recorded it as pending; resending would pick other inputs and
  // could pay twice, so the send is reported as submitted.
  it('reports an unknown network outcome as submitted', async () => {
    const { vault } = createVault({
      broadcast: async () =>
        JSON.stringify({
          txid: 'deadbeef',
          sizeBytes: 1500,
          broadcast: 'unknown',
          error: { code: 'NETWORK_ERROR' },
        }),
    });
    await expect(
      vault.broadcastTransaction({
        signedTx: {
          txid: 'deadbeef',
          rawTx: '00ff',
          encodedTx: {
            ...broadcastEncodedTx,
            signableHex: 'aabb',
            chainTip: 3_767_827,
          } as IEncodedTxXmr,
        },
      } as never),
    ).resolves.toMatchObject({ txid: 'deadbeef' });
  });

  // The pending row needs the amount, and the total its change (wallet2
  // counts it, locked, until the send is mined).
  it('hands the runtime amount plus fee and the change for the pending row', async () => {
    const broadcast = jest.fn(async () =>
      JSON.stringify({ txid: 'deadbeef', sizeBytes: 1500 }),
    );
    const { vault, runtime } = createVault({ broadcast });
    await vault.broadcastTransaction({
      signedTx: {
        txid: 'deadbeef',
        rawTx: '00ff',
        encodedTx: {
          ...broadcastEncodedTx,
          signableHex: 'aabb',
          chainTip: 3_767_827,
          amountAtomic: '1000000000000',
          feeAtomic: '30000000',
          changeAtomic: '500000000000',
        } as IEncodedTxXmr,
      },
    } as never);
    const reviewJson = stringUtils.stableStringify({
      network: 'mainnet',
      fromAddress: PRIMARY,
      toAddress: RECIPIENT,
      amountAtomic: '1000000000000',
      feeAtomic: '30000000',
      changeAtomic: '500000000000',
      isMaxSend: false,
    });
    expect(runtime.verifySignedTransaction).toHaveBeenCalledWith(
      'aabb',
      reviewJson,
      '00ff',
    );
    expect(
      jest.mocked(runtime.verifySignedTransaction).mock.invocationCallOrder[0],
    ).toBeLessThan(broadcast.mock.invocationCallOrder[0]);
    expect(broadcast).toHaveBeenCalledWith(
      expect.anything(),
      '00ff',
      '3767827',
      '1000030000000',
      '500000000000',
      'aabb',
      reviewJson,
    );
  });

  it('rejects a broadcast that returns a different transaction id', async () => {
    const { vault } = createVault({
      broadcast: async () => JSON.stringify({ txid: 'cafebabe' }),
    });
    await expect(
      vault.broadcastTransaction({
        signedTx: {
          txid: 'deadbeef',
          rawTx: '00ff',
          encodedTx: {
            ...broadcastEncodedTx,
            signableHex: 'aabb',
            chainTip: 3_767_827,
          } as IEncodedTxXmr,
        },
      } as never),
    ).rejects.toThrow(/unexpected transaction id/);
  });

  // The broadcast already happened; a failed bookkeeping write must not report failure.
  it('still reports success when recording the recipient fails', async () => {
    const { vault } = createVault({
      recordXmrSent: () => Promise.reject(new Error('disk full')),
    });
    await expect(
      vault.broadcastTransaction({
        signedTx: {
          txid: 'deadbeef',
          rawTx: '00ff',
          encodedTx: {
            ...broadcastEncodedTx,
            to: RECIPIENT,
            signableHex: 'aabb',
            chainTip: 3_767_827,
          } as IEncodedTxXmr,
        },
      } as never),
    ).resolves.toMatchObject({ txid: 'deadbeef' });
  });

  // Nothing on chain links a Monero tx to its recipient.
  it('records who was paid, so the history row is not "sent to Monero"', async () => {
    const { vault } = createVault();
    await vault.broadcastTransaction({
      signedTx: {
        txid: 'deadbeef',
        rawTx: '00ff',
        encodedTx: {
          ...broadcastEncodedTx,
          to: RECIPIENT,
          signableHex: 'aabb',
          chainTip: 3_767_827,
        } as IEncodedTxXmr,
      },
    } as never);
    expect(
      vault.backgroundApi.simpleDb.privacyChainJournal.recordXmrSent,
    ).toHaveBeenCalledWith({
      accountId: ACCOUNT_ID,
      txid: 'deadbeef',
      recipient: RECIPIENT,
      amountAtomic: '1000000000000',
      feeAtomic: '30000000',
    });
  });

  // customRpcEnabled routes a saved node's sends here; the base class would
  // throw NotImplemented.
  it('broadcasts through the runtime when a custom node is set', async () => {
    const broadcast = jest.fn(async () =>
      JSON.stringify({ txid: 'deadbeef', sizeBytes: 1500 }),
    );
    const { vault } = createVault({ broadcast });
    await expect(
      vault.broadcastTransactionFromCustomRpc({
        customRpcInfo: { rpc: 'https://node.example' },
        signedTx: {
          txid: 'deadbeef',
          rawTx: '00ff',
          encodedTx: {
            ...broadcastEncodedTx,
            to: RECIPIENT,
            signableHex: 'aabb',
            chainTip: 3_767_827,
          } as IEncodedTxXmr,
        },
      } as never),
    ).resolves.toMatchObject({ txid: 'deadbeef' });
    expect(broadcast).toHaveBeenCalledTimes(1);
  });

  it('refuses to broadcast something that was never prepared', async () => {
    const { vault } = createVault();
    await expect(
      vault.broadcastTransaction({
        signedTx: { txid: '', rawTx: '00ff', encodedTx: {} },
      } as never),
    ).rejects.toThrow(ETranslations.privacy_error_review_expired__msg);
  });
});

describe('xmr send: nothing is adjustable after review', () => {
  // `signableHex` is the transaction; a later fee/amount edit would diverge from it.
  it('returns the reviewed transaction unchanged', async () => {
    const { vault } = createVault();
    const unsignedTx = await vault.buildUnsignedTx({
      transfersInfo: [{ from: PRIMARY, to: RECIPIENT, amount: '0.001' }],
    } as never);
    await expect(
      vault.updateUnsignedTx({
        unsignedTx,
        feeInfo: { feeUTXO: { feeValue: '99' } },
      } as never),
    ).resolves.toBe(unsignedTx);
  });
});
