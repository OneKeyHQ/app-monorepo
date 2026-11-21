/** @jest-environment jsdom */
/* eslint-disable import/first */

import { StrictMode } from 'react';

import EarnLoanRouter from '.';

import { fireEvent, render, screen } from '@testing-library/react';

const mockStart = jest.fn();
const mockAcknowledgeSupply = jest.fn(async () => false);
const mockMetrics = jest.fn((_params: unknown) => ({
  maxLtv: 0.7,
  maxBorrow: 100,
  netApy: 1,
}));
const mockRun = {
  phase: 'idle',
  fundedSupplyAmount: '10' as string | undefined,
  isRunning: false,
  canReconcile: false,
  isRechecking: false,
  isClosingSupply: false,
  canAcknowledgeSupply: true,
  hasApprovalStep: false,
  start: mockStart,
  reset: jest.fn(),
  reconcile: jest.fn(),
  acknowledgeDone: jest.fn(),
  acknowledgeFundedSupply: mockAcknowledgeSupply,
};
const mockRoute = {
  key: 'route',
  marketLabel: 'Aave',
  market: {
    provider: 'aave',
    networkId: 'evm--1',
    marketAddress: '0xmarket',
    name: 'Aave',
    logoURI: '',
    network: { networkId: 'evm--1', name: 'Ethereum', logoURI: '' },
  },
  collateral: {
    address: '0xeth',
    symbol: 'ETH',
    decimals: 18,
    networkId: 'evm--1',
    reserveAddress: '0xeth',
    logoURI: '',
  },
  borrow: {
    address: '0xusd',
    symbol: 'USDC',
    decimals: 6,
    networkId: 'evm--1',
    reserveAddress: '0xusd',
    logoURI: '',
  },
};
const mockFacts = {
  networkAccountId: 'account',
  hasAccount: true,
  collateralPrice: 100,
  borrowPrice: 1,
  collateralValue: 1000,
  debtValue: 100,
  collateralSupplied: 10,
  collateralAssets: [],
  debtAssets: [],
  maxLtv: 0.7,
  liquidity: 10_000,
  walletBalance: '100',
  canBorrowHere: true,
};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => true }));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const View = ({
    children,
    testID,
  }: {
    children?: React.ReactNode;
    testID?: string;
  }) => React.createElement('div', { 'data-testid': testID }, children);
  const Page = Object.assign(View, { Header: () => null, Body: View });
  const Button = ({
    children,
    onPress,
    disabled,
    testID,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    disabled?: boolean;
    testID?: string;
  }) =>
    React.createElement(
      'button',
      { 'data-testid': testID, onClick: onPress, disabled },
      children,
    );
  return {
    Page,
    Badge: View,
    Button,
    HeightTransition: View,
    Icon: () => null,
    IconButton: () => null,
    ScrollView: View,
    SizableText: View,
    Skeleton: { BodyMd: () => null, HeadingXl: () => null },
    Stack: View,
    XStack: View,
    YStack: View,
    useMedia: () => ({ gtLg: false, gtMd: false }),
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceStaking: {} },
}));
jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({
    children,
  }: {
    children: React.ReactNode;
  }) => children,
}));
jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger',
  () => ({
    useAccountSelectorTrigger: () => ({ showAccountSelector: jest.fn() }),
  }),
);
jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  useCurrency: () => ({ id: 'usd', symbol: '$' }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    pushModal: jest.fn(),
    setOptions: jest.fn(),
    setParams: jest.fn(),
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppRoute', () => ({
  useAppRoute: () => ({
    params: {
      collateral: 'ETH',
      borrow: 'USDC',
      networkId: 'evm--1',
      collateralAmount: '7',
      borrowAmount: '2',
    },
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: undefined }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/earn', () => ({
  useEarnAtom: () => [{ availableAssetsByType: {} }],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EJotaiContextStoreNames: { earn: 'earn' },
  useCurrencyPersistAtom: () => [{ currencyMap: {} }],
}));
jest.mock(
  '../../../Discovery/components/DiscoveryBrowserProviderMirror',
  () => ({
    DiscoveryBrowserProviderMirror: ({
      children,
    }: {
      children: React.ReactNode;
    }) => children,
  }),
);
jest.mock('../../EarnProviderMirror', () => ({
  EarnProviderMirror: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../../Staking/components/EarnFormFooter', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    EARN_FULL_WIDTH_BUTTONS: {},
    EARN_HALF_BUTTON: {},
    EarnFormActionPlacementContext: React.createContext('footer'),
    EarnFormFooter: ({
      confirmButtonProps,
      confirmText,
    }: {
      confirmButtonProps: { onPress: () => void; disabled?: boolean };
      confirmText: string;
    }) =>
      React.createElement(
        'button',
        {
          'data-testid': 'submit',
          onClick: confirmButtonProps.onPress,
          disabled: confirmButtonProps.disabled,
        },
        confirmText,
      ),
  };
});
jest.mock('../../../Staking/components/EarnRiskWarningDialog', () => ({
  useEarnRiskWarningGate: () => async () => true,
}));
jest.mock('../../../Staking/components/StakeProgress', () => ({
  StakeProgress: () => null,
}));
jest.mock('../../../Staking/components/StakingAmountInput', () => ({
  StakingAmountInput: ({
    inputProps,
    value,
    disabled,
    onChange,
  }: {
    inputProps: { testID: string };
    value?: string;
    disabled?: boolean;
    onChange: (value: string) => void;
  }) => (
    <input
      data-testid={inputProps.testID}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));
jest.mock('../../../Staking/components/StakingAmountResultLine', () => ({
  StakingAmountResultLine: () => null,
}));
jest.mock('../../../Staking/components/UniversalStake/EarnFormSummary', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    EarnFormCompactContext: React.createContext(false),
    EarnFormRow: () => null,
  };
});
jest.mock('../../components/desktopHome/earnDesktopHomeCopy', () => ({
  useEarnDesktopHomeCopy: () => ({
    payWith: 'Pay with',
    supplyAndBorrow: 'Supply and Borrow',
    swapSupplyAndBorrow: 'Swap Supply Borrow',
    loanBridgeSupplyAndBorrow: 'Bridge Supply Borrow',
    loanSupplied: () => 'Supplied',
    loanLtv: 'LTV',
    loanCurrentLtv: 'Current LTV',
    loanPosition: 'Position',
    loanPoolInfo: 'Pool',
    loanNoMarket: () => 'No market',
    youSupply: 'You supply',
  }),
}));
jest.mock('../../components/desktopHome/earnDesktopPressable', () => ({
  buildKeyboardPressProps: () => ({}),
}));
jest.mock('../../components/desktopHome/EarnHeaderPick', () => ({
  EARN_HEADER_PICK_STYLE: {},
  EarnHeaderOffersSide: () => null,
}));
jest.mock('../../components/desktopHome/EarnLoanAssetLogos', () => ({
  EarnLoanAssetLogos: () => null,
}));
jest.mock('../../components/desktopHome/useEarnDesktopHomeData', () => ({
  useEarnDesktopMarkets: () => ({ markets: [], isLoaded: true }),
  useEarnDesktopWalletHoldings: () => ({ networkGroups: [] }),
}));
jest.mock('../../earnWindowReturn', () => ({
  leaveEarnWindowFor: jest.fn(),
  useEarnWindowScope: () => undefined,
}));
jest.mock('../../../Borrow/borrowUtils', () => ({ BorrowNavigation: {} }));
jest.mock('../../earnUtils', () => ({ EarnNavigation: {} }));
jest.mock('../EarnRouter/EarnDepositDone', () => ({
  EarnDoneHeader: () => null,
  formatDoneAmount: () => '10 ETH',
}));
jest.mock('./LoanLegends', () => ({
  LoanHealthLegend: () => null,
  LoanLegendLabel: () => null,
  LoanLtvLegend: () => null,
}));
jest.mock('./LoanLtvBar', () => ({ LoanLtvBar: () => null }));
jest.mock('./LoanRouterParts', () => ({
  LoanMarketLinks: () => null,
  LoanPairTitle: () => null,
  LoanPickBar: () => null,
  LoanPickNetwork: () => null,
  LoanRouteList: () => null,
  formatLoanFiat: () => '',
  formatLoanLtv: () => '',
  formatLoanPercent: () => '',
  getLoanBlockText: () => undefined,
  isLendingClosed: () => false,
  isLoanLoss: () => false,
}));
jest.mock('./loanToneColors', () => ({
  useLoanToneColors: () => ({
    text: { success: '', caution: '', critical: '' },
    fill: { success: '', caution: '', critical: '' },
    note: '',
  }),
}));
jest.mock('./useLoanModalHeight', () => ({
  useLoanModalHeight: () => undefined,
}));
jest.mock('./useLoanRouterRun', () => ({ useLoanRouterRun: () => mockRun }));
jest.mock('./useLoanRouterFacts', () => ({
  useLoanRouterAccount: () => ({ accountId: 'account' }),
  useLoanRouterFacts: () => ({
    byRoute: new Map([['route', mockFacts]]),
    isLoaded: true,
    hasFailedRoutes: false,
    refresh: jest.fn(),
  }),
}));
jest.mock('./useLoanPayWith', () => ({
  useLoanPayWith: () => ({
    isLoaded: true,
    isSwapping: false,
    isSwapRunning: false,
    payTokenFor: () => ({ networkId: 'evm--1', token: { symbol: 'ETH' } }),
    openPicker: jest.fn(),
    swap: jest.fn(),
  }),
}));
jest.mock('./loanRouter.utils', () => ({
  ...jest.requireActual<typeof import('./loanRouter.utils')>(
    './loanRouter.utils',
  ),
  buildLoanRoutesForPicks: () => [mockRoute],
  buildLoanSelectTokens: () => [],
  getLoanCardMetrics: () => ({}),
  getLoanRouteMetrics: (params: unknown) => mockMetrics(params),
  rankLoanRoutes: (items: unknown[]) => items,
  getLoanLtvBar: () => undefined,
  listLoanSelectNetworks: () => [],
}));

beforeEach(() => {
  mockStart.mockClear();
  mockMetrics.mockClear();
  mockAcknowledgeSupply.mockClear();
  mockRun.phase = 'idle';
  mockRun.fundedSupplyAmount = '10';
  mockRun.isRunning = false;
});

it('previews and submits a retained supply continuation as borrow only', () => {
  const view = render(
    <StrictMode>
      <EarnLoanRouter />
    </StrictMode>,
  );
  const collateral = screen.getByTestId(
    'earn-loan-collateral-input',
  ) as HTMLInputElement;
  expect(collateral.disabled).toBe(true);
  expect(collateral.value).toBe('');
  fireEvent.change(collateral, { target: { value: '5' } });
  expect(collateral.value).toBe('');
  expect(mockMetrics).toHaveBeenLastCalledWith(
    expect.objectContaining({ collateralAmount: '', borrowAmount: '2' }),
  );
  fireEvent.click(screen.getByTestId('submit'));
  expect(mockStart).toHaveBeenCalledWith(
    expect.objectContaining({ collateralAmount: '0', borrowAmount: '2' }),
  );
  fireEvent.click(screen.getByTestId('loan-acknowledge-supply'));
  expect(mockAcknowledgeSupply).toHaveBeenCalledTimes(1);
  view.unmount();
});

it('clears a newly retained supply before publishing its preview and restores editing when it clears', () => {
  mockRun.fundedSupplyAmount = undefined;
  const view = render(
    <StrictMode>
      <EarnLoanRouter />
    </StrictMode>,
  );
  const collateral = screen.getByTestId(
    'earn-loan-collateral-input',
  ) as HTMLInputElement;
  expect(collateral.disabled).toBe(false);
  fireEvent.change(collateral, { target: { value: '5' } });
  expect(collateral.value).toBe('5');
  mockRun.fundedSupplyAmount = '10';
  view.rerender(
    <StrictMode>
      <EarnLoanRouter />
    </StrictMode>,
  );
  expect(collateral.disabled).toBe(true);
  expect(collateral.value).toBe('');
  expect(mockMetrics).toHaveBeenLastCalledWith(
    expect.objectContaining({ collateralAmount: '' }),
  );
  mockRun.fundedSupplyAmount = undefined;
  view.rerender(
    <StrictMode>
      <EarnLoanRouter />
    </StrictMode>,
  );
  expect(collateral.disabled).toBe(false);
  fireEvent.change(collateral, { target: { value: '3' } });
  expect(collateral.value).toBe('3');
});

it('preserves the in-flight collateral amount while the borrow step is running', () => {
  mockRun.phase = 'borrowing';
  mockRun.isRunning = true;
  render(
    <StrictMode>
      <EarnLoanRouter />
    </StrictMode>,
  );
  const collateral = screen.getByTestId(
    'earn-loan-collateral-input',
  ) as HTMLInputElement;
  expect(collateral.disabled).toBe(true);
  expect(collateral.value).toBe('7');
  expect(mockMetrics).toHaveBeenLastCalledWith(
    expect.objectContaining({ collateralAmount: '7' }),
  );
});
