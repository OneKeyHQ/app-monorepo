/* eslint-disable import/first */
jest.mock('@onekeyhq/kit-bg/src/dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import type { IEncodedTxXmr } from '@onekeyhq/core/src/chains/xmr/types';
import type { VaultBase } from '@onekeyhq/kit-bg/src/vaults/base/VaultBase';
import XmrVault from '@onekeyhq/kit-bg/src/vaults/impls/xmr/Vault';
import type { IEncodedTxZcash } from '@onekeyhq/kit-bg/src/vaults/impls/zcash/types';
import ZcashVault from '@onekeyhq/kit-bg/src/vaults/impls/zcash/Vault';

const xmrTransaction: IEncodedTxXmr = {
  from: 'synthetic-own',
  to: 'synthetic-recipient',
  amount: '0.001',
  amountAtomic: '1000000000',
  feeAtomic: '30000000',
  changeAtomic: '5000000',
  signableHex: 'aabb',
  inputCount: 2,
  chainTip: 100,
  priority: 'normal',
};

function createXmrVault() {
  return Object.assign(Object.create(XmrVault.prototype) as XmrVault, {
    accountId: 'synthetic-account',
    networkId: 'xmr--0',
    getAccount: async () => ({ address: 'synthetic-own' }),
    getNetwork: async () => ({ decimals: 12, feeMeta: { decimals: 12 } }),
    backgroundApi: {
      serviceToken: { getNativeToken: async () => undefined },
    },
  });
}

// These assertions express the cross-layer behavior required by a live review.
describe('privacy wallet review boundary regressions', () => {
  it('XMR built transaction tells confirmation not to recount the balance', async () => {
    const vault = createXmrVault();
    const decoded = await vault.buildDecodedTx({
      unsignedTx: { encodedTx: xmrTransaction },
    });
    expect(decoded.isPsbt).toBe(true);
  });

  it.each(['privacy', 'transparent'] as const)(
    'Zcash generic fee pipeline preserves the reviewed %s exact fee',
    async (mode) => {
      const encodedTx: IEncodedTxZcash = {
        inputs: [],
        outputs: [{ address: 'synthetic-recipient', value: '100000' }],
        inputsForCoinSelect: [],
        outputsForCoinSelect: [],
        fee: '15000',
        txSize: 0,
        zcashTo: 'synthetic-recipient',
        zcashAmountValue: '100000',
        zcashSpendSource: mode === 'privacy' ? 'ironwood' : undefined,
        zcashMode: mode,
        pcztHex: mode === 'privacy' ? 'aabb' : undefined,
      };
      const vault: ZcashVault = Object.assign(
        Object.create(ZcashVault.prototype) as ZcashVault,
        {
          getNetwork: async () => ({
            decimals: 8,
            symbol: 'ZEC',
            feeMeta: { decimals: 8, symbol: 'ZEC' },
          }),
        },
      );
      const buildParams: VaultBase['buildEstimateFeeParams'] =
        vault.buildEstimateFeeParams.bind(vault);
      const params = await buildParams({ encodedTx });
      const estimate = await vault.estimateFee({
        ...params,
        accountId: 'synthetic-account',
        networkId: 'zec--0',
        accountAddress: 'synthetic-own',
      });
      expect(estimate.data.data.feeUTXO?.[0].feeValue).toBe('0.00015');
    },
  );
});

it('Zcash refuses a supplied message when its proposal cannot carry that message', async () => {
  const vault: ZcashVault = Object.assign(
    Object.create(ZcashVault.prototype) as ZcashVault,
    {
      accountId: 'synthetic-account',
      backgroundApi: {
        simpleDb: {
          zcash: { getPrivacyModeState: async () => ({ intent: 'on' }) },
        },
      },
    },
  );
  await expect(
    vault.buildEncodedTx({
      transfersInfo: [
        {
          from: 'synthetic-own',
          to: 'u1-synthetic-recipient',
          amount: '0.001',
          localWalletSourcePool: 'ironwood',
          hexData: '436f646578206175646974',
        },
      ],
    }),
  ).rejects.toThrow();
});

it('Zcash public-pool total request carries the explicitly selected account identity', async () => {
  const post = jest.fn(async () => ({
    data: { data: [{ info: { isNative: true, address: '' }, balance: '0' }] },
  }));
  const account = {
    id: 'synthetic-account',
    address: 'synthetic-transparent-address',
    xpub: 'synthetic-public-xpub',
  };
  const vault: ZcashVault = Object.assign(
    Object.create(ZcashVault.prototype) as ZcashVault,
    {
      accountId: '',
      networkId: 'zec--0',
      getLocalWalletBalance: async () => null,
      zcashFetchFreshTransparentUtxos: async () => ({
        utxos: [],
        coinbaseZat: '0',
      }),
      backgroundApi: {
        simpleDb: {
          zcash: { getPrivacyModeState: async () => ({ intent: 'on' }) },
        },
        serviceAccount: { getDBAccount: async () => account },
        serviceNetwork: { isCustomNetwork: async () => false },
        serviceAccountProfile: { _getWalletTypeHeader: async () => ({}) },
        serviceToken: { getClient: async () => ({ post }) },
      },
    },
  );
  await vault.getLocalWalletAccountBalance({ accountId: account.id });
  expect(post).toHaveBeenCalledWith(
    '/wallet/v1/account/token/search',
    expect.objectContaining({
      accountAddress: account.address,
      xpub: account.xpub,
    }),
    expect.anything(),
  );
});

it('Monero refuses an unsupported transaction message before building', async () => {
  const vault = createXmrVault();
  await expect(
    vault.buildEncodedTx({
      transfersInfo: [
        {
          from: 'synthetic-own',
          to: 'synthetic-recipient',
          amount: '0.001',
          hexData: 'aabb',
        },
      ],
    }),
  ).rejects.toThrow('messages are not supported');
});
