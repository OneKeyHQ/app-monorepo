/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

// OK-64029: the perps tab's empty state hard-coded "$0.00" for the account
// value, so switching the display currency (e.g. to CNY) left the perps total
// in USD while every other home tab followed the new symbol. The empty state
// must format its zero total through the same currency-aware path as the
// ready state.

import type { ReactNode } from 'react';

type IBoxProps = { children?: ReactNode };

const mockSettings = {
  currencyInfo: { id: 'cny', symbol: '¥' },
  hideValue: false,
};

jest.mock('react-native', () => ({
  StyleSheet: { hairlineWidth: 1 },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const { numberFormat } =
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('@onekeyhq/shared/src/utils/numberUtils') as typeof import('@onekeyhq/shared/src/utils/numberUtils');
  const Box = ({ children }: IBoxProps) => <>{children}</>;
  const Text = ({ children }: IBoxProps) => <span>{children}</span>;
  const Nothing = () => null;
  return {
    Badge: Box,
    Button: Box,
    DashText: Text,
    Icon: Nothing,
    Image: Nothing,
    NumberSizeableText: ({
      children,
      formatter,
      formatterOptions,
    }: INumberFormatProps & { children: string | number | undefined }) => (
      <span>
        {numberFormat(String(children), { formatter, formatterOptions })}
      </span>
    ),
    SizableText: Text,
    Skeleton: {
      BodySm: Nothing,
      BodyMd: Nothing,
      BodyLg: Nothing,
      HeadingXl: Nothing,
    },
    Stack: Box,
    XStack: Box,
    YStack: Box,
    rootNavigationRef: { current: undefined },
    useMedia: () => ({ gtMd: false }),
    useScrollContentTabBarOffset: () => 0,
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: jest.fn(), pushModal: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      account: undefined,
      indexedAccount: undefined,
      wallet: undefined,
    },
  }),
}));
jest.mock('@onekeyhq/kit/src/views/Market/components/PerpsBadges', () => ({
  LeverageBadge: () => null,
  PerpDexBadge: () => null,
  SubtitleText: () => null,
}));
jest.mock('@onekeyhq/kit/src/views/Market/hooks', () => ({
  useNavigateToMarketTab: () => jest.fn(),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketPerpsList/hooks/useMarketPerpsTokenList',
  () => ({
    useMarketPerpsTokenList: () => ({ tokens: [], isLoading: false }),
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Perp/components/OrderInfoPanel/utils',
  () => ({
    isSpotHoldingVisible: () => true,
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Perp/hooks/useShowDepositWithdrawModal',
  () => ({
    useShowDepositWithdrawModal: () => ({
      showDepositWithdrawModal: jest.fn(),
    }),
  }),
);
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  perpsPendingInfoPanelTabAtom: {},
  spotActiveAssetAtom: {},
  tradingModeAtom: {},
  useCurrencyPersistAtom: () => [{ currencyMap: {} }],
  usePerpsCustomSettingsAtom: () => [{ hideSmallSpotHoldings: false }],
  useSettingsPersistAtom: () => [mockSettings],
}));
jest.mock('@onekeyhq/shared/src/logger/scopes/perp/perpPageSource', () => ({
  EPerpPageEnterSource: {},
  setPerpPageEnterSource: jest.fn(),
}));
jest.mock('../components/DeFiListBlock/DeFiOverviewLayout', () => ({
  OVERVIEW_TILE_SHADOW: {},
  buildOverviewGridStyle: () => ({}),
}));
jest.mock('../components/HomeScrollView', () => ({
  HomeScrollView: ({ children }: IBoxProps) => <>{children}</>,
}));
jest.mock('../components/PullToRefresh', () => ({
  PullToRefresh: () => null,
  onHomePageRefresh: jest.fn(),
}));
jest.mock('../components/RichBlock', () => ({
  RichBlock: ({
    title,
    subTitle,
    headerActions,
    content,
  }: {
    title?: ReactNode;
    subTitle?: ReactNode;
    headerActions?: ReactNode;
    content?: ReactNode;
  }) => (
    <div>
      {title}
      {subTitle}
      {headerActions}
      {content}
    </div>
  ),
}));
jest.mock('../components/SupportHub/SupportHub', () => ({
  SupportHub: () => null,
}));
jest.mock('../components/Upgrade/Upgrade', () => ({
  Upgrade: () => null,
}));
jest.mock('./perpsChainTrace', () => ({ debugPerpsChain: jest.fn() }));
jest.mock('./usePerpsHomePortfolio', () => ({
  usePerpsHomePortfolio: () => ({
    viewState: 'empty',
    view: undefined,
    canDeposit: true,
    isDepositDisabled: false,
  }),
}));

import { render, screen } from '@testing-library/react';

import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';

import { PerpsContainer } from './PerpsContainer';

/*
yarn jest packages/kit/src/views/Home/pages/PerpsContainer.emptyStateCurrency.test.tsx
*/

describe('PerpsContainer empty state account value', () => {
  afterEach(() => {
    mockSettings.currencyInfo = { id: 'cny', symbol: '¥' };
  });

  it('formats the zero total in the selected currency', () => {
    render(<PerpsContainer />);

    // Both the mobile summary row and the desktop RichBlock subtitle render
    // (the layout is toggled by display media props), so each must follow
    // the selected currency symbol.
    expect(screen.queryByText('$0.00')).toBeNull();
    expect(screen.getAllByText('¥0.00')).toHaveLength(2);
  });

  it('keeps the dollar form while USD is selected', () => {
    mockSettings.currencyInfo = { id: 'usd', symbol: '$' };

    render(<PerpsContainer />);

    expect(screen.getAllByText('$0.00')).toHaveLength(2);
  });
});
