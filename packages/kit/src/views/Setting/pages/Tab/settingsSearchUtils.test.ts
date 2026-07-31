import { buildFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';

import {
  SETTINGS_SEARCH_KEYS,
  getSettingsSearchSectionItem,
} from './settingsSearchUtils';

describe('settings search keys', () => {
  it('matches visible titles and explicit keywords without matching every item in a section', () => {
    const search = buildFuse(
      [
        {
          title: 'Address book',
          sectionTitle: 'Wallet',
          parentSectionTitle: 'Wallet',
        },
        {
          title: 'Wallet and dApp account alignment',
          sectionTitle: 'Wallet',
          parentSectionTitle: 'Wallet',
        },
        {
          title: 'Protection',
          sectionTitle: 'Security',
          parentSectionTitle: 'Security',
          keywords: ['Create and remove wallets'],
        },
        {
          title: 'Connected sites',
          mobileTitle: 'dApp connections',
          sectionTitle: 'Security',
          parentSectionTitle: 'Security',
          keywords: ['WalletConnect'],
        },
      ],
      {
        keys: [...SETTINGS_SEARCH_KEYS],
        shouldSort: false,
      },
    );

    expect(search.search('wallet').map((result) => result.item.title)).toEqual([
      'Wallet and dApp account alignment',
      'Protection',
      'Connected sites',
    ]);
  });

  it('groups promoted settings under their parent section', () => {
    const promotedItem = { mobilePlacement: 'home' as const };
    const nestedItem = { mobilePlacement: 'AppData' as const };

    expect(getSettingsSearchSectionItem(promotedItem)).toBeUndefined();
    expect(getSettingsSearchSectionItem(nestedItem)).toBe(nestedItem);
  });
});
