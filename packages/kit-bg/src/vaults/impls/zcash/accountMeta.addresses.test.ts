import { ZCASH_ADDRESS_SCHEME_VERSION } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';

import { SimpleDbEntityPrivacyChainState } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainState';

import { refreshZcashAccountAddressCache } from './accountMeta';

import type { IZcashAccountMeta } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainState';

const networkId = 'zec--0';

function createContext(metaOverrides: Partial<IZcashAccountMeta> = {}) {
  const meta: IZcashAccountMeta = {
    vkFp: 'a'.repeat(32),
    unifiedAddress: 'synthetic-old-private-address',
    transparentAddress: 'synthetic-transparent-address',
    seedFingerprintHex: 'ab'.repeat(32),
    hdIndex: 0,
    birthdayHeight: 3_000_000,
    createdAt: 1,
    ...metaOverrides,
  };
  let saved: unknown = {
    data: {
      device: { allowCellularSync: true },
      wallets: {
        first: {
          chain: { zcash: { seedFingerprintHex: meta.seedFingerprintHex } },
        },
      },
      accounts: {
        first: {
          networkId,
          walletId: 'first',
          vkFp: meta.vkFp,
          epoch: '0123456789abcdef',
          scan: {
            intent: 'on',
            birthday:
              meta.birthdayHeight === undefined
                ? undefined
                : { height: meta.birthdayHeight },
          },
          chain: {
            zcash: {
              unifiedAddress: meta.unifiedAddress,
              derivedUnifiedAddress: meta.derivedUnifiedAddress,
              transparentAddress: meta.transparentAddress,
              addressSchemeVersion: meta.addressSchemeVersion,
              hdIndex: meta.hdIndex,
            },
          },
          createdAt: meta.createdAt,
          updatedAt: 1,
        },
      },
      futureField: 'dropped',
    },
    updatedAt: 1,
  };
  const store = new SimpleDbEntityPrivacyChainState();
  Reflect.set(store, 'appStorage', {
    getItem: async () => saved,
    setItem: async (_key: string, value: unknown) => {
      saved = value;
    },
  });
  const derived = {
    unifiedAddress: 'synthetic-current-private-address',
    transparentAddress: meta.transparentAddress,
  };
  const deriveAddresses = jest.fn(async () => derived);
  const refresh = (isHardware = false) =>
    refreshZcashAccountAddressCache({
      accountId: 'first',
      store,
      isHardware,
      deriveAddresses,
    });
  return { store, meta, derived, deriveAddresses, refresh };
}

describe('Zcash address policy cache', () => {
  it('refreshes an unversioned cache from viewing material and preserves recovery data', async () => {
    const { store, meta, derived, deriveAddresses, refresh } = createContext();
    await expect(refresh()).resolves.toMatchObject({
      ...meta,
      ...derived,
      addressSchemeVersion: ZCASH_ADDRESS_SCHEME_VERSION,
    });
    expect(deriveAddresses).toHaveBeenCalledWith(meta);
    await refresh();
    expect(deriveAddresses).toHaveBeenCalledTimes(1);
    // Other state survives; only known fields are written back.
    await expect(store.getAllowCellularSync()).resolves.toBe(true);
    expect(await store.getRawData()).not.toHaveProperty('futureField');
  });

  it('leaves current caches untouched and rejects future versions without deriving', async () => {
    const current = createContext({
      addressSchemeVersion: ZCASH_ADDRESS_SCHEME_VERSION,
    });
    await expect(current.refresh()).resolves.toEqual(current.meta);
    expect(current.deriveAddresses).not.toHaveBeenCalled();
    const future = createContext({
      addressSchemeVersion: ZCASH_ADDRESS_SCHEME_VERSION + 1,
    });
    await expect(future.refresh()).rejects.toThrow('requires a newer App');
    expect(future.deriveAddresses).not.toHaveBeenCalled();
  });

  it('refreshes only the requested account and preserves another account identity', async () => {
    const { store, meta, refresh } = createContext();
    const otherMeta: IZcashAccountMeta = {
      ...meta,
      vkFp: 'b'.repeat(32),
      unifiedAddress: 'synthetic-other-private-address',
      transparentAddress: 'synthetic-other-transparent-address',
      hdIndex: 1,
    };
    await store.beginZcashPrivacyModeEnable({
      networkId,
      accountId: 'second',
      birthdayHeight: 3_000_000,
    });
    await store.saveZcashAccountMeta({ accountId: 'second', meta: otherMeta });
    await refresh();
    await expect(
      store.getZcashAccountMeta({ accountId: 'second' }),
    ).resolves.toEqual({ ...otherMeta, createdAt: expect.any(Number) });
  });

  it('preserves the device-displayed hardware address and refreshes its app counterpart', async () => {
    const { meta, derived, refresh } = createContext();
    await expect(refresh(true)).resolves.toMatchObject({
      unifiedAddress: meta.unifiedAddress,
      derivedUnifiedAddress: derived.unifiedAddress,
      addressSchemeVersion: ZCASH_ADDRESS_SCHEME_VERSION,
    });
  });

  it('clears an obsolete hardware counterpart when the two addresses now match', async () => {
    const { derived, refresh } = createContext({
      unifiedAddress: 'synthetic-current-private-address',
      derivedUnifiedAddress: 'synthetic-old-counterpart',
    });
    expect((await refresh(true))?.derivedUnifiedAddress).toBeUndefined();
    expect((await refresh(true))?.unifiedAddress).toBe(derived.unifiedAddress);
  });

  it('refuses a derived transparent address belonging to another identity', async () => {
    const { meta, store, deriveAddresses, refresh } = createContext();
    deriveAddresses.mockResolvedValue({
      unifiedAddress: 'synthetic-current-private-address',
      transparentAddress: 'synthetic-other-account',
    });
    await expect(refresh()).rejects.toThrow('do not match');
    await expect(
      store.getZcashAccountMeta({ accountId: 'first' }),
    ).resolves.toEqual(meta);
  });

  it('does not resurrect an account deleted while derivation is pending', async () => {
    const { store, derived, deriveAddresses, refresh } = createContext();
    deriveAddresses.mockImplementation(async () => {
      await store.removeAccount({ accountId: 'first' });
      return derived;
    });
    await expect(refresh()).rejects.toThrow('privacy state changed');
    await expect(
      store.getZcashAccountMeta({ accountId: 'first' }),
    ).resolves.toBeUndefined();
  });

  it('preserves a concurrent repair instead of overwriting its recovery height', async () => {
    const { store, meta, derived, deriveAddresses, refresh } = createContext();
    deriveAddresses.mockImplementation(async () => {
      await store.saveZcashAccountMeta({
        accountId: 'first',
        meta: { ...meta, birthdayHeight: 2_000_000 },
      });
      return derived;
    });
    await expect(refresh()).rejects.toThrow('privacy state changed');
    await expect(
      store.getZcashAccountMeta({ accountId: 'first' }),
    ).resolves.toMatchObject({
      birthdayHeight: 2_000_000,
      unifiedAddress: meta.unifiedAddress,
    });
  });

  it('converges when two readers refresh the same cache concurrently', async () => {
    const { refresh, derived } = createContext();
    const results = await Promise.all([refresh(), refresh()]);
    for (const result of results) {
      expect(result).toMatchObject({
        ...derived,
        addressSchemeVersion: ZCASH_ADDRESS_SCHEME_VERSION,
      });
    }
  });
});
