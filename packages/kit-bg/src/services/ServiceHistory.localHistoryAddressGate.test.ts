/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/background/backgroundDecorators')
  >('@onekeyhq/shared/src/background/backgroundDecorators');
  const passthrough =
    () => (_target: unknown, _key?: string, descriptor?: PropertyDescriptor) =>
      descriptor;
  return {
    ...actual,
    backgroundClass: passthrough,
    backgroundMethod: passthrough,
  };
});

jest.mock('../vaults/localWallet/historyAddressGate', () => {
  const actual = jest.requireActual<
    typeof import('../vaults/localWallet/historyAddressGate')
  >('../vaults/localWallet/historyAddressGate');
  return {
    ...actual,
    getLocalWalletHistoryAddressGate: jest.fn(
      actual.getLocalWalletHistoryAddressGate,
    ),
  };
});

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

import { getLocalWalletHistoryAddressGate } from '../vaults/localWallet/historyAddressGate';
import { getVaultSettings } from '../vaults/settings';

const ServiceHistory = require('./ServiceHistory')
  .default as typeof import('./ServiceHistory').default;

const ALL = 'onekeyall--0';
const ZEC = 'zec--0';
const BTC = 'btc--0';
const OWN = `t1${'A'.repeat(33)}`;
const LEGACY_CHANGE = `t1${'H'.repeat(33)}`;

// A cached row whose input is the account's legacy change address.
function cachedRow(
  networkId: string,
  txid: string,
  accountId = `acc-${networkId}`,
): IAccountHistoryTx {
  return {
    id: `${networkId}_${OWN}_${txid}`,
    decodedTx: {
      txid,
      accountId,
      networkId,
      owner: OWN,
      status: EDecodedTxStatus.Confirmed,
      createdAt: 1,
      actions: [
        {
          type: EDecodedTxActionType.ASSET_TRANSFER,
          assetTransfer: {
            from: LEGACY_CHANGE,
            to: 't1other',
            sends: [{ from: LEGACY_CHANGE, to: '', isOwn: true }],
            receives: [
              { from: '', to: 't1other', isOwn: false },
              { from: '', to: OWN, isOwn: true },
            ],
          },
        },
      ],
    },
  } as unknown as IAccountHistoryTx;
}

function createService(cached: IAccountHistoryTx[]) {
  const getLocalWalletAccountAddresses = jest.fn(async () => ({
    publicAddress: OWN,
  }));
  const service = Object.assign(
    Object.create(ServiceHistory.prototype) as InstanceType<
      typeof ServiceHistory
    >,
    {
      getAccountLocalHistoryConfirmedTxs: async () => cached,
      getAccountLocalHistoryPendingTxs: async () => [],
      getAccountsLocalHistoryConfirmedTxs: async () => cached,
      getAccountsLocalHistoryPendingTxs: async () => [],
      backgroundApi: {
        serviceNetwork: {
          getVaultSettings: ({ networkId }: { networkId: string }) =>
            getVaultSettings({ networkId }),
          getNetwork: async () => ({ logoURI: '' }),
        },
        serviceAccount: {
          getAccountAddressForApi: async () => OWN,
          getAccountXpub: async () => undefined,
          getDBAccountSafe: async () => ({ address: OWN }),
        },
        serviceAllNetwork: {
          getAllNetworkAccountsWithEnabledNetworks: async () => ({
            accountsInfo: [],
          }),
        },
        servicePrivacyChain: { getLocalWalletAccountAddresses },
      },
    },
  );
  // Private display steps are outside this test.
  Object.assign(service, {
    attachPrivateSendDisplayStatus: async (txs: IAccountHistoryTx[]) => txs,
    attachPrivateSendDisplayPrices: async ({
      txs,
    }: {
      txs: IAccountHistoryTx[];
    }) => txs,
  });
  return { service, getLocalWalletAccountAddresses };
}

const sendsOf = (tx: IAccountHistoryTx) =>
  tx.decodedTx.actions[0].assetTransfer?.sends;
const receivesOf = (tx: IAccountHistoryTx) =>
  tx.decodedTx.actions[0].assetTransfer?.receives;

describe('ServiceHistory cached history address gate', () => {
  afterEach(() => {
    jest.mocked(getLocalWalletHistoryAddressGate).mockClear();
  });

  it('hides an own address the Receive page does not show', async () => {
    const { service } = createService([cachedRow(ZEC, 'z1', 'zec-account')]);
    const [tx] = await service.getAccountsLocalHistoryTxs({
      accountId: 'zec-account',
      networkId: ZEC,
    });
    expect(JSON.stringify(tx)).not.toContain(LEGACY_CHANGE);
    expect(sendsOf(tx)?.[0]).toMatchObject({
      from: '',
      isOwn: true,
      shieldedFrom: { poolId: 0, isOwn: true },
    });
    expect(receivesOf(tx)?.[1]).toMatchObject({ to: OWN });
  });

  it('leaves other chains untouched without building a gate', async () => {
    const btc = cachedRow(BTC, 'b1', 'btc-account');
    const { service, getLocalWalletAccountAddresses } = createService([btc]);
    const [tx] = await service.getAccountsLocalHistoryTxs({
      accountId: 'btc-account',
      networkId: BTC,
    });
    expect(tx).toBe(btc);
    expect(getLocalWalletHistoryAddressGate).not.toHaveBeenCalled();
    expect(getLocalWalletAccountAddresses).not.toHaveBeenCalled();
  });

  it('keeps the rows and hides every own address when the gate fails', async () => {
    jest
      .mocked(getLocalWalletHistoryAddressGate)
      .mockRejectedValueOnce(new Error('gate unavailable'));
    const { service } = createService([cachedRow(ZEC, 'z1', 'zec-account')]);
    const txs = await service.getAccountsLocalHistoryTxs({
      accountId: 'zec-account',
      networkId: ZEC,
    });
    expect(txs).toHaveLength(1);
    expect(JSON.stringify(txs[0].decodedTx.actions)).not.toContain(
      LEGACY_CHANGE,
    );
    expect(JSON.stringify(txs[0].decodedTx.actions)).not.toContain(OWN);
    expect(receivesOf(txs[0])?.[1]).toMatchObject({
      to: '',
      shieldedTo: { isOwn: true },
    });
  });

  it('gates each account in All Networks and leaves other chains as is', async () => {
    const btc = cachedRow(BTC, 'b1');
    const { service } = createService([
      btc,
      cachedRow(ZEC, 'z1', 'zec-a'),
      cachedRow(ZEC, 'z2', 'zec-b'),
    ]);
    jest
      .mocked(getLocalWalletHistoryAddressGate)
      .mockImplementationOnce(async () => {
        throw new OneKeyLocalError('gate unavailable');
      });
    const txs = await service.getAccountsLocalHistoryTxs({
      accountId: 'hd-1',
      networkId: ALL,
    });
    expect(txs.map((tx) => tx.decodedTx.txid).toSorted()).toEqual([
      'b1',
      'z1',
      'z2',
    ]);
    expect(txs.find((tx) => tx.decodedTx.txid === 'b1')).toBe(btc);
    const zecRows = txs.filter((tx) => tx.decodedTx.networkId === ZEC);
    expect(JSON.stringify(zecRows)).not.toContain(LEGACY_CHANGE);
    expect(getLocalWalletHistoryAddressGate).toHaveBeenCalledTimes(2);
  });
});
