import { ENFTType, type IAccountNFT } from '@onekeyhq/shared/types/nft';

import { buildNativeNFTRowsByKey } from './nativeNFTRows';

it('keeps the same NFT from two accounts as separate actionable rows', () => {
  const sharedItem = {
    amount: '1',
    collectionAddress: '0xcollection',
    collectionName: 'Collection',
    collectionSymbol: 'COL',
    collectionType: ENFTType.ERC721,
    itemId: '42',
    networkId: 'evm--1',
  } satisfies Omit<IAccountNFT, 'accountId'>;
  const first = { ...sharedItem, accountId: 'account-a' };
  const second = { ...sharedItem, accountId: 'account-b' };

  const rows = buildNativeNFTRowsByKey([first, second], 'active-account');

  expect(rows.size).toBe(2);
  expect(rows.get('account-a:evm--1:0xcollection:42')).toBe(first);
  expect(rows.get('account-b:evm--1:0xcollection:42')).toBe(second);
});
