import { buildFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';

import {
  getSettingsDisplayTitle,
  getSettingsDisplayTitleKey,
} from './settingsDisplay';
import {
  SETTINGS_SEARCH_KEYS,
  normalizeSettingsSearchQuery,
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
        shouldSort: true,
      },
    );

    expect(search.search('wallet').map((result) => result.item.title)).toEqual([
      'Wallet and dApp account alignment',
      'Protection',
      'Connected sites',
    ]);
  });

  it('ranks a visible title match ahead of a later keyword match', () => {
    const search = buildFuse(
      [
        {
          title: 'Security',
          keywords: ['Create and remove wallets'],
        },
        {
          title: 'Wallet',
        },
      ],
      {
        keys: [...SETTINGS_SEARCH_KEYS],
        shouldSort: true,
      },
    );

    expect(search.search('wallet').map((result) => result.item.title)).toEqual([
      'Wallet',
      'Security',
    ]);
  });

  it('uses the matched mobile title as the visible title on tab layouts', () => {
    const search = buildFuse(
      [
        {
          title: 'Connected sites',
          mobileTitle: 'dApp connections',
          keywords: ['WalletConnect'],
        },
      ],
      {
        keys: [...SETTINGS_SEARCH_KEYS],
        shouldSort: true,
      },
    );

    const result = search.search('dApp connections')[0];
    const titleKey = getSettingsDisplayTitleKey(result.item, true);

    expect(getSettingsDisplayTitle(result.item, true)).toBe('dApp connections');
    expect(titleKey).toBe('mobileTitle');
    expect(result.matches?.some((match) => match.key === titleKey)).toBe(true);
  });

  it('uses the canonical title on extension and narrow web layouts', () => {
    const entry = {
      title: 'Backup',
      mobileTitle: 'Alternate backup label',
    };

    expect(getSettingsDisplayTitle(entry, false)).toBe('Backup');
    expect(getSettingsDisplayTitleKey(entry, false)).toBe('title');
  });
});

describe('settings search query normalization', () => {
  it('ignores surrounding whitespace and treats whitespace-only input as empty', () => {
    expect(normalizeSettingsSearchQuery('  wallet  ')).toBe('wallet');
    expect(normalizeSettingsSearchQuery('   ')).toBe('');
  });
});
