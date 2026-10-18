// cspell:ignore piconero
/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import type { IXmrRuntimeApi } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';

import Vault from './Vault';

import type { IEncodedTxXmr } from './types';

/**
 * The Monero send path, pinned at its three seams.
 *
 * What is worth testing here is not the cryptography — that lives in the Rust
 * runtime and is tested there. It is the *handoff*: which object carries the
 * fee, what reaches the runtime at broadcast, and whether the amount the user
 * confirmed is the amount that gets signed. Every bug in that list is silent:
 * the screen still renders, the transaction still goes out, and the number is
 * wrong.
 */

const ACCOUNT_ID = "hd-1--m/44'/128'/0'";
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
  recordSentRecipient?: () => Promise<void>;
}) {
  const prepared: IFakeRuntime['prepared'] = [];

  const runtime = {
    prepared,
    listAccounts: () =>
      JSON.stringify({ items: [{ accountId: 7, uuid: ACCOUNT_ID }] }),
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
    broadcastTransaction:
      options?.broadcast ??
      (async () => JSON.stringify({ txid: 'deadbeef', sizeBytes: 1500 })),
  } as unknown as IFakeRuntime;

  const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
    accountId: ACCOUNT_ID,
    networkId: 'xmr--0',
    backgroundApi: {
      simpleDb: {
        xmr: {
          recordSentRecipient: jest.fn(
            options?.recordSentRecipient ?? (async () => undefined),
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

  /**
   * Piconero, not a float. Monero's supply is six orders of magnitude past
   * `Number.MAX_SAFE_INTEGER`, so a number here loses precision without
   * throwing.
   */
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

  /**
   * A fee shown for a transaction that has not been built is a guess, and a
   * guess the user then confirms is worse than an error.
   */
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
  /**
   * The amount the user typed for a max send is only a ceiling: the real
   * figure is `spendable - fee`, and the fee is not known until the
   * transaction is built. Keeping the typed value would show one number and
   * send another.
   */
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

describe('xmr send: broadcast', () => {
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

  /**
   * A network error cannot tell "the node never got it" from "the node got it
   * and the reply was lost". Releasing on the second case lets the next send
   * pick the same inputs and double spend.
   */
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
    const { vault } = createVault({ broadcast });
    await vault.broadcastTransaction({
      signedTx: {
        txid: 'deadbeef',
        rawTx: '00ff',
        encodedTx: {
          signableHex: 'aabb',
          chainTip: 3_767_827,
          amountAtomic: '1000000000000',
          feeAtomic: '30000000',
          changeAtomic: '500000000000',
        } as IEncodedTxXmr,
      },
    } as never);
    expect(broadcast).toHaveBeenCalledWith(
      expect.anything(),
      '00ff',
      '3767827',
      '1000030000000',
      '500000000000',
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
            signableHex: 'aabb',
            chainTip: 3_767_827,
          } as IEncodedTxXmr,
        },
      } as never),
    ).rejects.toThrow(/unexpected transaction id/);
  });

  /**
   * The broadcast already happened and cannot be taken back. If the
   * bookkeeping write fails afterwards, reporting an error would tell the user
   * their send failed while the money is on its way -- the one message that is
   * worse than no message.
   */
  it('still reports success when recording the recipient fails', async () => {
    const { vault } = createVault({
      recordSentRecipient: () => Promise.reject(new Error('disk full')),
    });
    await expect(
      vault.broadcastTransaction({
        signedTx: {
          txid: 'deadbeef',
          rawTx: '00ff',
          encodedTx: {
            to: RECIPIENT,
            signableHex: 'aabb',
            chainTip: 3_767_827,
          } as IEncodedTxXmr,
        },
      } as never),
    ).resolves.toMatchObject({ txid: 'deadbeef' });
  });

  /**
   * Nothing on chain links a Monero transaction to the address it paid, so
   * broadcast is the last moment this can be written down.
   */
  it('records who was paid, so the history row is not "sent to Monero"', async () => {
    const { vault } = createVault();
    await vault.broadcastTransaction({
      signedTx: {
        txid: 'deadbeef',
        rawTx: '00ff',
        encodedTx: {
          to: RECIPIENT,
          signableHex: 'aabb',
          chainTip: 3_767_827,
        } as IEncodedTxXmr,
      },
    } as never);
    expect(
      vault.backgroundApi.simpleDb.xmr.recordSentRecipient,
    ).toHaveBeenCalledWith({
      accountId: ACCOUNT_ID,
      txid: 'deadbeef',
      recipient: RECIPIENT,
    });
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
  /**
   * `signableHex` is the transaction. Editing the fee or the amount after it
   * exists would leave the two describing different transactions, and the
   * signed one always wins.
   */
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
