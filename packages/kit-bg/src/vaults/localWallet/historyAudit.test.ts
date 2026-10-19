/* eslint-disable import/first */
jest.mock('@onekeyhq/kit-bg/src/dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import type { IEncodedTxXmr } from '@onekeyhq/core/src/chains/xmr/types';
import { SimpleDbEntityXmr } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityXmr';
import { buildXmrLocalHistoryTx } from '@onekeyhq/kit-bg/src/vaults/impls/xmr/localHistory';
import type { IXmrHistoryItem } from '@onekeyhq/kit-bg/src/vaults/impls/xmr/types';
import XmrVault from '@onekeyhq/kit-bg/src/vaults/impls/xmr/Vault';
import ZcashVault from '@onekeyhq/kit-bg/src/vaults/impls/zcash/Vault';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

const own = 'synthetic-own';
const recipient = 'synthetic-recipient';
const accountId = 'synthetic-account';

async function decodeXmrHistory(
  item: IXmrHistoryItem,
  sentAmount?: { amountAtomic: string; feeAtomic: string },
) {
  return buildXmrLocalHistoryTx({
    item,
    ownAddress: own,
    recipient,
    sentAmount,
    nativeToken: undefined,
    networkId: 'xmr--0',
    accountId,
    accountAddress: own,
    buildTransferAction: async () => ({ type: EDecodedTxActionType.UNKNOWN }),
  });
}

it.each([null, 100])(
  'XMR history at height %s displays the recipient amount instead of amount plus fee',
  async (height) => {
    let recordedOutgoing: string | undefined;
    const api = {
      listAccounts: async () =>
        JSON.stringify({ items: [{ accountId: 7, uuid: accountId }] }),
      verifySignedTransaction: async () => 'synthetic-tx',
      broadcastTransaction: jest.fn(
        async (
          _identity: string,
          _raw: string,
          _tip: string,
          outgoingAtomic?: string,
        ) => {
          recordedOutgoing = outgoingAtomic;
          return JSON.stringify({ txid: 'synthetic-tx' });
        },
      ),
    };
    const encodedTx: IEncodedTxXmr = {
      from: own,
      to: recipient,
      amount: '1',
      amountAtomic: '1000000000000',
      feeAtomic: '30000000',
      changeAtomic: '500000000000',
      chainTip: 100,
      inputCount: 1,
      priority: 'normal',
      signableHex: 'aabb',
    };
    let stored: unknown;
    const entity = new SimpleDbEntityXmr();
    Reflect.set(entity, 'appStorage', {
      getItem: async () => stored,
      setItem: async (_key: string, value: unknown) => {
        stored = value;
      },
    });
    const vault = Object.assign(Object.create(XmrVault.prototype) as XmrVault, {
      accountId,
      networkId: 'xmr--0',
      getXmrRuntimeApi: async () => api,
      getXmrNetwork: async () => 'mainnet',
      backgroundApi: { simpleDb: { xmr: entity } },
    });
    // The runtime fixture records the same field that the Rust wire history returns.
    await vault.broadcastTransaction({
      accountId,
      networkId: 'xmr--0',
      accountAddress: own,
      signedTx: { txid: 'synthetic-tx', rawTx: 'aabb', encodedTx },
    });
    expect(api.broadcastTransaction).toHaveBeenCalledTimes(1);
    expect(recordedOutgoing).toBe('1000030000000');
    const row = await decodeXmrHistory(
      {
        txid: 'synthetic-tx',
        height,
        timestamp: null,
        direction: 'out',
        spentAtomic: '1500030000000',
        receivedAtomic: '0',
        outgoingAtomic: recordedOutgoing,
      },
      (await entity.getSentAmounts({ accountId }))['synthetic-tx'],
    );
    expect(row.decodedTx.totalFeeInNative).toBe('0.00003');
    expect(row.decodedTx.nativeAmountIsUnknown).toBe(false);
    expect(row.decodedTx.nativeAmount).toBe(encodedTx.amount);
  },
);

it('XMR incoming history still displays the received amount', async () => {
  const row = await decodeXmrHistory({
    txid: 'synthetic-incoming',
    height: 100,
    timestamp: 1_700_000_000,
    direction: 'in',
    spentAtomic: '0',
    receivedAtomic: '1000000000000',
  });
  expect(row.decodedTx.nativeAmount).toBe('1');
});

function createZcashRawDetailFixture() {
  const txid = 'synthetic-rotated-receiver-tx';
  const xpub = 'synthetic-selected-account-xpub';
  const post = jest.fn(async (url: string, body: { xpub?: string }) => ({
    data: {
      data: {
        data: url.endsWith('/detail')
          ? { tx: txid, sends: [], receives: [] }
          : [{ tx: txid }].filter(() => body.xpub === xpub),
        tokens: {},
        nfts: {},
        hasMore: false,
      },
    },
  }));
  const vault = Object.assign(
    Object.create(ZcashVault.prototype) as ZcashVault,
    {
      accountId,
      networkId: 'zec--0',
      buildOnChainHistoryTx: async ({
        onChainHistoryTx,
      }: {
        onChainHistoryTx: { tx: string };
      }) => ({
        id: onChainHistoryTx.tx,
        decodedTx: { txid: onChainHistoryTx.tx },
      }),
      backgroundApi: {
        simpleDb: {
          zcash: {
            getPrivacyModeState: async () => ({ intent: 'off' }),
            getAccountMeta: async () => undefined,
          },
        },
        serviceAccount: {
          getDBAccountSafe: async () => ({ id: accountId, address: own, xpub }),
        },
        serviceAccountProfile: { _getWalletTypeHeader: async () => ({}) },
        serviceHistory: {
          getClient: async () => ({ post }),
          getOneKeyIdAuthHeaders: async () => ({}),
        },
        serviceGas: {
          getClient: async () => ({ post }),
          getOneKeyIdAuthHeaders: async () => ({}),
        },
        serviceNetwork: { isCustomNetwork: async () => false },
      },
    },
  );
  return { vault, post, txid, xpub };
}

it('Zcash raw public detail association uses the selected account xpub for rotated receivers', async () => {
  const { vault, post, txid, xpub } = createZcashRawDetailFixture();
  // ServiceHistory intentionally removes accountAddress/xpub from the raw detail request.
  const response = await vault.fetchAccountHistoryDetail({
    accountId,
    networkId: 'zec--0',
    txid,
  });
  expect(response.data.data.data.tx).toBe(txid);
  expect(post.mock.calls[1][1]).not.toHaveProperty('xpub');
  expect(post.mock.calls[1][1]).not.toHaveProperty('accountAddress');
  expect(post).toHaveBeenCalledWith(
    '/wallet/v1/account/history/list',
    expect.objectContaining({ accountAddress: own, xpub }),
    expect.anything(),
  );
});

it('Zcash account-scoped detail finds the rotated-receiver transaction when xpub is present', async () => {
  const { vault, post, txid, xpub } = createZcashRawDetailFixture();
  const result = await vault.fetchAccountHistoryDetail({
    accountId,
    networkId: 'zec--0',
    txid,
    accountAddress: own,
    xpub,
  });
  expect(result.data.data.data.tx).toBe(txid);
  expect(post).toHaveBeenCalledTimes(2);
  expect(post.mock.calls[0][1]).toHaveProperty('xpub', xpub);
  expect(post.mock.calls[1][0]).toBe('/wallet/v1/account/history/detail');
});

it('Zcash stale private detail never discloses its txid to the public indexer', async () => {
  const { vault, post } = createZcashRawDetailFixture();
  const privateTxid = 'synthetic-private-only';
  await expect(
    vault.fetchAccountHistoryDetail({
      accountId,
      networkId: 'zec--0',
      txid: privateTxid,
    }),
  ).rejects.toThrow('transaction not found');
  expect(post).toHaveBeenCalledTimes(1);
  expect(post.mock.calls[0][1]).not.toHaveProperty('txid');
  expect(post.mock.calls[0][0]).toBe('/wallet/v1/account/history/list');
});
