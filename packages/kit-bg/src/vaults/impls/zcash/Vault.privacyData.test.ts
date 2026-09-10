/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { ZCASH_ADDRESS_SCHEME_VERSION } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';

import Vault from './Vault';

import type {
  IZcashAccountMeta,
  IZcashPrivacyModeStateView,
} from '../../../dbs/simple/entity/SimpleDbEntityZcash';

describe('Zcash local privacy data deletion', () => {
  const accountId = "hd-1--m/44'/133'/0'";
  const aliasAccountId = "hd-2--m/44'/133'/0'";
  const ufvk = 'same-ufvk';

  function createMeta(): IZcashAccountMeta {
    return {
      ufvk,
      unifiedAddress: 'u1-address',
      transparentAddress: 't1-address',
      seedFingerprintHex: '00',
      hdIndex: 0,
      birthdayHeight: 2_000_000,
      addressSchemeVersion: ZCASH_ADDRESS_SCHEME_VERSION,
      createdAt: 1,
    };
  }

  function createVault(aliasState: IZcashPrivacyModeStateView) {
    const meta = createMeta();
    const purgeWallet = jest.fn().mockResolvedValue(undefined);
    const removeAccountMeta = jest.fn().mockResolvedValue(undefined);
    const states: Record<string, IZcashPrivacyModeStateView> = {
      [accountId]: { intent: 'off' },
      [aliasAccountId]: aliasState,
    };
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      accountId,
      networkId: 'zec--0',
      backgroundApi: {
        serviceAccount: {
          getDBAccountSafe: jest.fn(async ({ accountId: id }) =>
            id === aliasAccountId ? { id } : undefined,
          ),
        },
        simpleDb: {
          zcash: {
            getAccountMeta: jest.fn(async ({ accountId: id }) =>
              id === accountId || id === aliasAccountId ? meta : undefined,
            ),
            getPrivacyModeState: jest.fn(
              async ({ accountId: id }) => states[id] ?? { intent: 'off' },
            ),
            isPrivacyModeEnabled: jest.fn(async ({ accountId: id }) => {
              const state = states[id];
              return state?.intent === 'on' && state.operation === undefined;
            }),
            listTransparentPendingTxs: jest.fn(async () => []),
            listShieldedReservations: jest.fn(async () => []),
            listAccountMetas: jest.fn(async () => [
              { accountId, meta },
              { accountId: aliasAccountId, meta },
            ]),
            removeAccountMeta,
          },
        },
      },
    });
    jest
      .spyOn(vault, 'zcashGetApi')
      .mockResolvedValue({ purgeWallet } as never);
    return { purgeWallet, removeAccountMeta, vault };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['enabled', { intent: 'on' }],
    [
      'enabling',
      {
        intent: 'off',
        operation: { type: 'enable', requestedAt: 1 },
      },
    ],
    [
      'disabling',
      {
        intent: 'off',
        operation: { type: 'disable', requestedAt: 1 },
      },
    ],
  ] as const)(
    'retains the shared cache while an alias is %s',
    async (_, state) => {
      const { purgeWallet, removeAccountMeta, vault } = createVault(state);

      await vault.deleteLocalPrivacyData({ accountId });

      expect(purgeWallet).not.toHaveBeenCalled();
      expect(removeAccountMeta).toHaveBeenCalledWith({ accountId });
    },
  );

  it('purges the shared cache when every other alias is stably off', async () => {
    const { purgeWallet, removeAccountMeta, vault } = createVault({
      intent: 'off',
    });

    await vault.deleteLocalPrivacyData({ accountId });

    expect(purgeWallet).toHaveBeenCalledTimes(1);
    expect(purgeWallet).toHaveBeenCalledWith(expect.objectContaining({ ufvk }));
    expect(removeAccountMeta).toHaveBeenCalledWith({ accountId });
  });
});
