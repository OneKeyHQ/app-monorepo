import type { IZcashBalance } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import VaultBtc from '../btc/Vault';

import Vault from './Vault';

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

const pool = (amount: string) => ({
  spendable: amount,
  total: amount,
  pendingChange: '0',
  pendingSpendable: '0',
  locked: '0',
});
const balance: IZcashBalance = {
  isComplete: true,
  shielded: '100',
  transparent: '9999',
  total: '10099',
  spendable: '100',
  shieldedSpendable: '100',
  orchardBalance: '100',
  ironwoodBalance: '0',
  transparentBalance: '9999',
  transparentRegularBalance: '9999',
  transparentCoinbaseBalance: '0',
  pendingChange: '0',
  pendingSpendable: '0',
  poolsDetail: {
    orchard: pool('100'),
    ironwood: pool('0'),
    transparentRegular: pool('9999'),
    transparentCoinbase: pool('0'),
  },
};

describe('Zcash independent transparent balance availability', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    { utxoFails: true, totalFails: false, spendable: undefined, total: '80' },
    { utxoFails: false, totalFails: true, spendable: '50', total: undefined },
    {
      utxoFails: true,
      totalFails: true,
      spendable: undefined,
      total: undefined,
    },
    { utxoFails: false, totalFails: false, spendable: '50', total: '80' },
  ])(
    'preserves independent known values: %j',
    async ({ utxoFails, totalFails, spendable, total }) => {
      const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
        accountId: 'account',
        networkId: 'zec--0',
        backgroundApi: {
          simpleDb: {
            zcash: {
              getPrivacyModeState: jest
                .fn()
                .mockResolvedValue({ intent: 'on' }),
            },
          },
          serviceAccount: {
            getDBAccount: jest.fn().mockResolvedValue({ id: 'account' }),
          },
        },
      });
      jest.spyOn(vault, 'getLocalWalletBalance').mockResolvedValue(balance);
      const fresh = jest.fn();
      if (utxoFails)
        fresh.mockRejectedValue(new OneKeyLocalError('UTXO request failed'));
      else fresh.mockResolvedValue({ utxos: [{ valueZat: '50' }] });
      Object.assign(vault, { zcashFetchFreshTransparentUtxos: fresh });
      const backend = jest.spyOn(VaultBtc.prototype, 'fetchTokenDetails');
      if (totalFails)
        backend.mockRejectedValue(new OneKeyLocalError('Total request failed'));
      else
        backend.mockResolvedValue({
          data: { data: [{ info: { isNative: true }, balance: '80' }] },
        } as Awaited<ReturnType<VaultBtc['fetchTokenDetails']>>);

      const sendPools = await vault.listLocalWalletSendPools({
        accountId: 'account',
      });
      const transparent = sendPools?.find((item) => item.key === 'transparent');
      expect(transparent?.spendable).toBe(spendable);
      expect(transparent?.total).toBe(total);
      const accountBalance = await vault.getLocalWalletAccountBalance({
        accountId: 'account',
      });
      expect(
        accountBalance?.pools.find((item) => item.key === 'transparent'),
      ).toMatchObject({ spendable, total });
      expect(accountBalance?.spendable).toBe(
        spendable === undefined ? undefined : '150',
      );
      expect(accountBalance?.total).toBe(
        total === undefined ? undefined : '180',
      );
    },
  );

  it.each([null, { ...balance, isComplete: false }])(
    'preserves the transparent pool when the private scan is incomplete: %j',
    async (privateBalance) => {
      const vault = Object.create(Vault.prototype) as Vault;
      Object.assign(vault, {
        getLocalWalletBalance: jest.fn().mockResolvedValue(privateBalance),
        listLocalWalletSendPools: jest
          .fn()
          .mockResolvedValue([
            { key: 'transparent', total: '80', spendable: '50' },
          ]),
        getAccount: jest.fn().mockResolvedValue({ id: 'account' }),
        zcashGetBalanceSafe: jest.fn().mockResolvedValue(privateBalance),
        zcashFetchFreshTransparentUtxos: jest
          .fn()
          .mockResolvedValue({ utxos: [{ valueZat: '50' }] }),
      });
      const result = await vault.getLocalWalletAccountBalance({
        accountId: 'account',
      });
      expect(result).toMatchObject({
        total: undefined,
        balanceStatus: 'partial',
      });
      expect(result?.pools[0]).toMatchObject({ total: '80', spendable: '50' });
      expect(result?.pools[1].balanceStatus).toBe(
        privateBalance ? 'partial' : 'unavailable',
      );
      expect(await vault.zcashGetComposedBalanceSafe('80')).toMatchObject({
        total: '',
        balanceStatus: 'partial',
      });
    },
  );

  it('retains a known zero instead of marking it unavailable', async () => {
    const vault = Object.create(Vault.prototype) as Vault;
    Object.assign(vault, {
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          zcash: {
            getPrivacyModeState: jest.fn().mockResolvedValue({ intent: 'off' }),
          },
        },
        serviceAccount: {
          getDBAccount: jest.fn().mockResolvedValue({ id: 'account' }),
        },
      },
      zcashFetchFreshTransparentUtxos: jest
        .fn()
        .mockResolvedValue({ utxos: [] }),
    });
    jest.spyOn(VaultBtc.prototype, 'fetchTokenDetails').mockResolvedValue({
      data: { data: [{ info: { isNative: true }, balance: '0' }] },
    } as Awaited<ReturnType<VaultBtc['fetchTokenDetails']>>);
    expect(
      await vault.listLocalWalletSendPools({ accountId: 'account' }),
    ).toEqual([
      expect.objectContaining({
        key: 'transparent',
        spendable: '0',
        spendableParsed: '0',
        total: '0',
      }),
    ]);
  });

  it('includes usable transparent funds in account availability without changing private pool spendability', async () => {
    const fresh = jest.fn().mockResolvedValue({ utxos: [{ valueZat: '50' }] });
    const vault = Object.create(Vault.prototype) as Vault;
    Object.assign(vault, {
      getAccount: jest.fn().mockResolvedValue({ id: 'account' }),
      zcashGetBalanceSafe: jest.fn().mockResolvedValue(balance),
      zcashFetchFreshTransparentUtxos: fresh,
    });
    expect(await vault.zcashGetComposedBalanceSafe('80')).toMatchObject({
      total: '180',
      spendable: '150',
      frozen: '30',
    });
    expect(balance.poolsDetail.orchard.spendable).toBe('100');
    expect(await vault.zcashGetComposedBalanceSafe('20')).toMatchObject({
      total: '150',
      spendable: '150',
      frozen: '0',
    });
    fresh.mockRejectedValue(new OneKeyLocalError('UTXO request failed'));
    await expect(
      vault.zcashGetComposedBalanceSafe('80'),
    ).resolves.toMatchObject({
      total: '180',
      spendable: '',
      frozen: '',
      balanceStatus: 'complete',
    });
  });
});
