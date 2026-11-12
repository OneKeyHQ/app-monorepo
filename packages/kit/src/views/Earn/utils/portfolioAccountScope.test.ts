import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import {
  earnPortfolioAccountScope,
  earnPortfolioDataScope,
  getScopedPortfolioEarnAccount,
} from './portfolioAccountScope';

it('uses address selection while remaining stable when map keys are reordered', () => {
  const account = {
    id: 'external--wc--session--0',
    name: 'External account',
    type: undefined,
    path: '',
    coinType: '',
    impl: 'evm',
    pub: '',
    addresses: {},
    connectionInfoRaw: undefined,
    address: '0xaaa',
    addressDetail: {
      isValid: true,
      networkId: 'evm--1',
      address: '0xaaa',
      baseAddress: '0xaaa',
      normalizedAddress: '0xaaa',
      displayAddress: '0xaaa',
      allowEmptyAddress: false,
    },
    connectedAddresses: { evm: '0xaaa,0xbbb', sol: 'sol-address' },
    selectedAddress: { evm: 0, sol: 0 },
  } satisfies INetworkAccount;
  const reordered = {
    ...account,
    connectedAddresses: { sol: 'sol-address', evm: '0xaaa,0xbbb' },
    selectedAddress: { sol: 0, evm: 0 },
  } satisfies INetworkAccount;
  const changed = {
    ...reordered,
    selectedAddress: { sol: 0, evm: 1 },
  } satisfies INetworkAccount;
  const scope = earnPortfolioAccountScope({ account });
  expect(earnPortfolioAccountScope({ account: reordered })).toBe(scope);
  expect(earnPortfolioAccountScope({ account: changed })).not.toBe(scope);
});

it('only exposes a persisted portfolio account when its data scope matches', () => {
  const scopeA = earnPortfolioDataScope({ earnAccountKey: 'account-a' });
  const scopeB = earnPortfolioDataScope({ earnAccountKey: 'account-b' });
  const legacy = { accounts: [], totalFiatValue: '100', hideSmallAssets: true };
  expect(getScopedPortfolioEarnAccount(legacy, scopeA)).toBeUndefined();
  const scoped = { ...legacy, portfolioAccountScope: scopeA };
  expect(getScopedPortfolioEarnAccount(scoped, scopeA)).toBe(scoped);
  expect(getScopedPortfolioEarnAccount(scoped, scopeB)).toBeUndefined();
});
