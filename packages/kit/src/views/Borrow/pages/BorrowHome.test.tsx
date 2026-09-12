/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { EBorrowDataStatus } from '../borrowDataStatus';
import { BorrowTestIDs } from '../testIDs';

import { BorrowHome } from './BorrowHome';

const media = { gtMd: false, gtXl: false };
const context = {
  reserves: {
    data: { supply: { assets: [] } },
    loading: false,
    refresh: jest.fn(),
  },
  market: { networkId: 'evm--1', provider: 'aave', marketAddress: '0xMarket' },
  markets: [
    { networkId: 'evm--1', provider: 'aave', marketAddress: '0xMarket' },
  ],
  earnAccount: { data: { account: { id: 'account-1' } }, loading: false },
  borrowDataStatus: EBorrowDataStatus.Error,
  refreshAllBorrowData: jest.fn(),
  setPendingTxs: jest.fn(),
};

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  function Container({ children }: { children?: ReactNode }) {
    return <div>{children}</div>;
  }
  return {
    __esModule: true,
    YStack: Container,
    XStack: Container,
    ScrollView: Container,
    Tabs: Object.assign(Container, {
      Container,
      Tab: Container,
      TabBar: Container,
    }),
    Empty: ({ testID }: { testID?: string }) => <div data-testid={testID} />,
    useMedia: () => media,
    useScrollContentTabBarOffset: () => 0,
  };
});

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  useSharedValue: (value: unknown) => ({ value }),
}));

jest.mock('../BorrowProvider', () => ({
  __esModule: true,
  BorrowProvider: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  useBorrowContext: () => context,
}));

jest.mock('../components/BorrowDataGate', () => ({
  __esModule: true,
  BorrowDataGate: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

// The bar is the only phone entry point to the e-mode screen, so the stub
// reports the variant it was asked for rather than just its presence.
jest.mock('../components/BorrowEModeMetric', () => ({
  __esModule: true,
  BorrowEModeMetric: ({ variant }: { variant?: string }) => (
    <div data-testid="e-mode-metric" data-variant={variant} />
  ),
}));

jest.mock('../components/Overview', () => ({
  __esModule: true,
  Overview: () => <div data-testid="overview" />,
}));

jest.mock('../components/BorrowAlerts', () => ({
  __esModule: true,
  BorrowAlerts: () => null,
}));
jest.mock('../components/BorrowCard', () => ({
  __esModule: true,
  BorrowCard: () => null,
}));
jest.mock('../components/BorrowedCard', () => ({
  __esModule: true,
  BorrowedCard: () => null,
}));
jest.mock('../components/SupplyCard', () => ({
  __esModule: true,
  SupplyCard: () => null,
}));
jest.mock('../components/SuppliedCard', () => ({
  __esModule: true,
  SuppliedCard: () => null,
}));
jest.mock('../components/BorrowMobilePositions', () => ({
  __esModule: true,
  BorrowMobilePositions: () => null,
}));
jest.mock('../components/BorrowMobileEmptyState', () => ({
  __esModule: true,
  BorrowMobileEmptyState: () => null,
}));
jest.mock('../components/BorrowMobileSummary', () => ({
  __esModule: true,
  BorrowMobileSummary: () => null,
}));
jest.mock('../components/BorrowMobileActionBar', () => ({
  __esModule: true,
  BORROW_MOBILE_ACTION_BAR_SCROLL_INSET: 0,
  BorrowMobileActionBar: () => null,
}));
jest.mock('../../Staking/components/ProtocolDetails/NoAddressWarning', () => ({
  __esModule: true,
  NoAddressWarning: () => null,
}));

// Pulled in transitively by useManagePage; loading it for real drags in the
// whole background API and WalletConnect.
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../borrowUtils', () => ({
  __esModule: true,
  BorrowNavigation: {
    pushToBorrowManagePosition: jest.fn(),
    pushToBorrowTokenSelect: jest.fn(),
  },
}));
jest.mock('../../Staking/pages/ManagePosition/hooks/useManagePage', () => ({
  __esModule: true,
  EManagePositionType: { Supply: 'supply', Borrow: 'borrow' },
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: jest.fn(), pop: jest.fn(), pushModal: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  __esModule: true,
  useActiveAccount: () => ({
    activeAccount: { ready: true, wallet: null, account: null },
  }),
}));
jest.mock('../../Onboarding/hooks/useToOnBoardingPage', () => ({
  __esModule: true,
  useToOnBoardingPage: () => jest.fn(),
}));
jest.mock('../hooks/useBorrowEModeStatus', () => ({
  __esModule: true,
  useBorrowEModeStatus: () => ({
    eModeStatus: { eModeId: 1, categories: [], originalLtv: '0.8' },
    isError: false,
    isInitialLoading: false,
    refresh: jest.fn(),
  }),
}));
jest.mock('../hooks/useBorrowOverviewData', () => ({
  __esModule: true,
  useBorrowOverviewData: () => ({}),
}));
jest.mock('../hooks/useBorrowPositionEntries', () => ({
  __esModule: true,
  useBorrowPositionEntries: () => [],
}));

describe('BorrowHome e-mode entry point', () => {
  beforeEach(() => {
    media.gtMd = false;
    media.gtXl = false;
    context.borrowDataStatus = EBorrowDataStatus.Error;
  });

  // E-Mode is fed by its own request, so a reserves outage says nothing about
  // whether it is usable. Before the bar moved below the positions it lived in
  // Overview, above the cards, and survived this state; sitting inside the
  // cards' error short-circuit would strand phone users with no way to reach
  // the e-mode screen until reserves recover.
  it('keeps the e-mode bar reachable on phones while reserves are in error', () => {
    const { getByTestId } = render(<BorrowHome />);

    expect(getByTestId(BorrowTestIDs.reservesErrorState)).toBeTruthy();
    expect(getByTestId('e-mode-metric').getAttribute('data-variant')).toBe(
      'bar',
    );
  });

  it('still renders the bar on phones once reserves are healthy', () => {
    context.borrowDataStatus = EBorrowDataStatus.Ready;
    const { getByTestId, queryByTestId } = render(<BorrowHome />);

    expect(queryByTestId(BorrowTestIDs.reservesErrorState)).toBeNull();
    expect(getByTestId('e-mode-metric').getAttribute('data-variant')).toBe(
      'bar',
    );
  });

  // Wide layouts reach e-mode through Overview, which renders above the cards
  // and is untouched by the error branch. Adding the bar there too would show
  // the same control twice.
  it('leaves the wide layout to reach e-mode through the overview', () => {
    media.gtMd = true;
    media.gtXl = true;
    const { getByTestId, queryByTestId } = render(<BorrowHome />);

    expect(getByTestId(BorrowTestIDs.reservesErrorState)).toBeTruthy();
    expect(getByTestId('overview')).toBeTruthy();
    expect(queryByTestId('e-mode-metric')).toBeNull();
  });
});
