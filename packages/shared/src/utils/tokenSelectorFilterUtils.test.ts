import {
  buildTokenSelectorDappTokenFilterParams,
  isTokenSelectorDappToken,
} from './tokenSelectorFilterUtils';

describe('buildTokenSelectorDappTokenFilterParams', () => {
  test('maps wallet-token mode to exclude dApp tokens', () => {
    expect(buildTokenSelectorDappTokenFilterParams({ lpToken: false })).toEqual(
      {
        withoutDappToken: true,
        withoutWalletToken: false,
      },
    );
  });

  test('maps dApp-token mode to exclude wallet tokens', () => {
    expect(buildTokenSelectorDappTokenFilterParams({ lpToken: true })).toEqual({
      withoutDappToken: false,
      withoutWalletToken: true,
    });
  });
});

describe('isTokenSelectorDappToken', () => {
  test('treats a concrete dappName as dApp token', () => {
    expect(isTokenSelectorDappToken({ dappName: 'Pendle' })).toBe(true);
  });

  test('treats missing or empty dappName as wallet token', () => {
    expect(isTokenSelectorDappToken({})).toBe(false);
    expect(isTokenSelectorDappToken({ dappName: null })).toBe(false);
    expect(isTokenSelectorDappToken({ dappName: '' })).toBe(false);
    expect(isTokenSelectorDappToken({ dappName: '   ' })).toBe(false);
  });
});
