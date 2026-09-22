import {
  groupNetworkIdsByImpl,
  pickNetworkIdsWithoutAccount,
} from './networksWithoutAccount';

/*
yarn jest packages/kit-bg/src/services/ServiceAllNetwork/networksWithoutAccount.test.ts
*/

describe('groupNetworkIdsByImpl', () => {
  it('keeps insertion order inside each impl group', () => {
    expect(
      groupNetworkIdsByImpl([
        { id: 'evm--1', impl: 'evm' },
        { id: 'btc--0', impl: 'btc' },
        { id: 'evm--10', impl: 'evm' },
      ]),
    ).toEqual([
      { impl: 'evm', networkIds: ['evm--1', 'evm--10'] },
      { impl: 'btc', networkIds: ['btc--0'] },
    ]);
  });
});

describe('pickNetworkIdsWithoutAccount', () => {
  const group = { impl: 'btc', networkIds: ['btc--0', 'tbtc--0'] };

  it('reports the whole group when no derive type has an account', () => {
    expect(
      pickNetworkIdsWithoutAccount({
        group,
        mergeDeriveAssetsEnabled: true,
        accountDeriveTypes: [],
        currentDeriveType: 'default',
      }),
    ).toEqual(['btc--0', 'tbtc--0']);
    expect(
      pickNetworkIdsWithoutAccount({
        group,
        mergeDeriveAssetsEnabled: false,
        accountDeriveTypes: [],
        currentDeriveType: 'default',
      }),
    ).toEqual(['btc--0', 'tbtc--0']);
  });

  it('accepts any derive type when the network merges derive assets', () => {
    expect(
      pickNetworkIdsWithoutAccount({
        group,
        mergeDeriveAssetsEnabled: true,
        accountDeriveTypes: ['BIP86'],
        currentDeriveType: 'default',
      }),
    ).toEqual([]);
  });

  it('requires the current derive type otherwise', () => {
    expect(
      pickNetworkIdsWithoutAccount({
        group,
        mergeDeriveAssetsEnabled: false,
        accountDeriveTypes: ['BIP86'],
        currentDeriveType: 'default',
      }),
    ).toEqual(['btc--0', 'tbtc--0']);
    expect(
      pickNetworkIdsWithoutAccount({
        group,
        mergeDeriveAssetsEnabled: false,
        accountDeriveTypes: ['BIP86', 'default'],
        currentDeriveType: 'default',
      }),
    ).toEqual([]);
  });
});
