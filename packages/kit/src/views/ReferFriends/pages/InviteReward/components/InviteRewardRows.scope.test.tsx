/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';

import { InviteRewardRows } from './InviteRewardRows';

// Both scope entry points (the empty-card "Learn more" link and the
// product-row info icons) open the page's hover info Popover on every
// platform and width. Native Tooltip renders only its trigger, so a Tooltip
// here would leave wide tablets without the scope copy.

let mockMd = false;
let mockOverlayTitles: (string | undefined)[] = [];
const initialIsNative = platformEnv.isNative;

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  const createComponent = (name: string) => {
    function MockComponent({
      children,
      description,
      renderTrigger,
      renderContent,
      title,
    }: {
      children?: ReactNode;
      description?: ReactNode;
      renderTrigger?: ReactNode;
      renderContent?: ReactNode;
      title?: string;
    }) {
      let overlay: 'popover' | 'tooltip' | null = null;
      if (name === 'Popover') {
        overlay = 'popover';
      } else if (name === 'Tooltip') {
        overlay = 'tooltip';
      }
      if (overlay) {
        mockOverlayTitles.push(title);
      }
      return React.createElement(
        'div',
        overlay ? { 'data-overlay': overlay } : undefined,
        description,
        renderTrigger,
        renderContent,
        children,
      );
    }
    return MockComponent;
  };

  const hooks: Record<string, unknown> = {
    useMedia: () => ({ md: mockMd, gtMd: !mockMd }),
    Icon: ({ name }: { name?: string }) =>
      React.createElement('i', {
        'data-testid': name ? `icon-${name}` : undefined,
      }),
  };

  return new Proxy(
    {},
    {
      get: (_target, key: string) => {
        if (key === '__esModule') {
          return false;
        }
        if (key in hooks) {
          return hooks[key];
        }
        return createComponent(key);
      },
    },
  );
});

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));

jest.mock('@onekeyhq/kit/src/components/Currency', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Currency: ({ children }: { children?: ReactNode }) =>
      React.createElement('span', null, children),
  };
});

jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    ListItem: ({
      renderItemText,
      title,
      children,
    }: {
      renderItemText?: ReactNode;
      title?: ReactNode;
      children?: ReactNode;
    }) => React.createElement('div', null, renderItemText ?? title, children),
  };
});

jest.mock('./ReferralCodeCard/hooks/useReferralCodeCard', () => ({
  useReferralCodeCard: () => ({ copyLink: jest.fn() }),
}));

jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/HardwareSalesReward/hooks/useNavigateToHardwareSalesReward',
  () => ({ useNavigateToHardwareSalesReward: () => jest.fn() }),
);
jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/PerpsReward/hooks/useNavigateToPerpsReward',
  () => ({ useNavigateToPerpsReward: () => jest.fn() }),
);
jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/SwapReward/hooks/useNavigateToSwapReward',
  () => ({ useNavigateToSwapReward: () => jest.fn() }),
);
jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/EarnReward/hooks/useNavigateToEarnReward',
  () => ({ useNavigateToEarnReward: () => jest.fn() }),
);

const TOKEN = {
  networkId: 'evm--1',
  address: '0xusdc',
  logoURI: '',
  name: 'USD Coin',
  symbol: 'USDC',
};
const REWARD = [
  { token: TOKEN, amount: '10', fiatValue: '10', usdValue: '10' },
];
const SCOPES = [
  { subject: 'Swap', description: 'Swap providers' },
  { subject: 'Earn', description: 'DeFi venues' },
];

function summary({ withRewards }: { withRewards: boolean }): IInviteSummary {
  return {
    inviteUrl: 'https://onekey.so/r/ABC123',
    inviteCode: 'ABC123',
    rebateConfig: {},
    Onchain: {
      title: 'DeFi',
      swap: withRewards ? REWARD : [],
      available: withRewards ? REWARD : [],
    },
    HardwareSales: { available: [], pending: [] },
    Perp: { available: [] },
    rewardScopes: SCOPES,
  } as unknown as IInviteSummary;
}

function overlayKinds(container: HTMLElement) {
  return [...container.querySelectorAll('[data-overlay]')].map((element) =>
    element.getAttribute('data-overlay'),
  );
}

describe('InviteRewardRows scope overlays', () => {
  beforeEach(() => {
    mockMd = false;
    mockOverlayTitles = [];
    platformEnv.isNative = initialIsNative;
  });

  afterEach(() => {
    platformEnv.isNative = initialIsNative;
  });

  const LAYOUTS = [
    { isNative: true, md: false },
    { isNative: true, md: true },
    { isNative: false, md: false },
    { isNative: false, md: true },
  ];

  it.each(LAYOUTS)(
    'opens Learn more with a Popover (native: $isNative, compact: $md)',
    ({ isNative, md }) => {
      platformEnv.isNative = isNative;
      mockMd = md;
      const view = render(
        <InviteRewardRows summaryInfo={summary({ withRewards: false })} />,
      );

      expect(overlayKinds(view.container)).toEqual(['popover']);
      expect(mockOverlayTitles).toEqual([
        ETranslations.referral_earnings_by_product__title,
      ]);
      expect(screen.getByText(ETranslations.global_learn_more)).toBeTruthy();
      // Several products: each description keeps its product heading.
      expect(screen.getByText(ETranslations.global_swap)).toBeTruthy();
      expect(screen.getByText('Swap providers')).toBeTruthy();
      expect(screen.getByText('DeFi venues')).toBeTruthy();
    },
  );

  it.each(LAYOUTS)(
    'opens product scope icons with a Popover (native: $isNative, compact: $md)',
    ({ isNative, md }) => {
      platformEnv.isNative = isNative;
      mockMd = md;
      const view = render(
        <InviteRewardRows summaryInfo={summary({ withRewards: true })} />,
      );

      expect(screen.queryByText(ETranslations.global_learn_more)).toBeNull();
      expect(screen.getAllByTestId('icon-InfoCircleOutline')).toHaveLength(2);
      expect(overlayKinds(view.container)).toEqual(['popover', 'popover']);
      expect(screen.getByText('Swap providers')).toBeTruthy();
      expect(screen.getByText('DeFi venues')).toBeTruthy();
    },
  );

  it.each([
    { isNative: true, md: false, headings: false },
    { isNative: true, md: true, headings: false },
    { isNative: false, md: false, headings: true },
    { isNative: false, md: true, headings: false },
  ])(
    'names a single product in the panel only without a sheet header (native: $isNative, compact: $md)',
    ({ isNative, md, headings }) => {
      platformEnv.isNative = isNative;
      mockMd = md;
      render(<InviteRewardRows summaryInfo={summary({ withRewards: true })} />);

      // The row titles render the product names once; a panel heading adds
      // a second copy.
      const expected = headings ? 2 : 1;
      expect(screen.getAllByText(ETranslations.global_swap)).toHaveLength(
        expected,
      );
    },
  );
});
