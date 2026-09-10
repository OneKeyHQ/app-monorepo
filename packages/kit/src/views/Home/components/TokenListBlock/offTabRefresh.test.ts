import { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

import { resolveOffTabTokenListRefreshOnMount } from './offTabRefresh';

/*
yarn jest packages/kit/src/views/Home/components/TokenListBlock/offTabRefresh.test.ts
*/

const owner = {
  accountId: 'hd-1--m/44/60/0/0/1',
  networkId: 'evm--1',
  indexedAccountId: 'hd-1--1',
};

describe('resolveOffTabTokenListRefreshOnMount', () => {
  it('refreshes the mounted owner while another home tab is active', () => {
    expect(
      resolveOffTabTokenListRefreshOnMount({
        ...owner,
        activeTabId: EHomeWalletTab.NFT,
      }),
    ).toEqual(owner);
  });

  it('forwards an Others account without an indexed account', () => {
    expect(
      resolveOffTabTokenListRefreshOnMount({
        accountId: 'watching--evm--0xabc',
        networkId: 'evm--1',
        indexedAccountId: undefined,
        activeTabId: EHomeWalletTab.History,
      }),
    ).toEqual({
      accountId: 'watching--evm--0xabc',
      networkId: 'evm--1',
      indexedAccountId: undefined,
    });
  });

  it('does nothing on the spot tab, where the list fetches on focus', () => {
    expect(
      resolveOffTabTokenListRefreshOnMount({
        ...owner,
        activeTabId: EHomeWalletTab.Portfolio,
      }),
    ).toBeUndefined();
  });

  it('does nothing before the active tab is known', () => {
    expect(
      resolveOffTabTokenListRefreshOnMount({
        ...owner,
        activeTabId: undefined,
      }),
    ).toBeUndefined();
  });

  it('does nothing for All Networks, which the fan-out hook refreshes', () => {
    expect(
      resolveOffTabTokenListRefreshOnMount({
        ...owner,
        networkId: 'onekeyall--0',
        activeTabId: EHomeWalletTab.NFT,
      }),
    ).toBeUndefined();
  });

  it('does nothing while the owner has no account or network', () => {
    expect(
      resolveOffTabTokenListRefreshOnMount({
        ...owner,
        accountId: undefined,
        activeTabId: EHomeWalletTab.NFT,
      }),
    ).toBeUndefined();
    expect(
      resolveOffTabTokenListRefreshOnMount({
        ...owner,
        networkId: undefined,
        activeTabId: EHomeWalletTab.NFT,
      }),
    ).toBeUndefined();
  });
});
