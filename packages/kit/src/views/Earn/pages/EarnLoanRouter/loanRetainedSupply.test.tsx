/** @jest-environment jsdom */
/* eslint-disable import/first */

import { StrictMode } from 'react';

import EarnLoanRouter from '.';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { ILoanRouterToken } from './loanRouter.utils';

const mockStart = jest.fn();
const mockAcknowledgeSupply = jest.fn(async () => false);
const mockSwap = jest.fn(async () => ({
  amount: '10',
  balance: '10',
  receipt: { scope: 'swap', txId: 'swap-tx' },
}));
const mockGetFunding = jest.fn<Promise<unknown>, [string]>();
const mockRefreshPayTokens = jest.fn(async () => {});
const mockRefreshFacts = jest.fn(async () => {});
let mockFactsRevision = 1;
let mockAccountId = 'account';
const mockPayWith = {
  isLoaded: true,
  isSwapping: false,
  isSwapRunning: false,
  payToken: { amount: '100', token: { symbol: 'DAI', decimals: 18 } },
  payTokenFor: () => ({ networkId: 'evm--1', token: { symbol: 'ETH' } }),
  openPicker: jest.fn(),
  swap: mockSwap,
  canSwap: true,
  estimatedSupply: '10',
  hasFundedSwap: false,
  wrappedFundingToken: undefined as ILoanRouterToken | undefined,
  keepWrappedPick: jest.fn(),
  refresh: mockRefreshPayTokens,
};
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
let mockFacts = {
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
  wrappedWalletBalance: undefined as
    | { address: string; amount: string }
    | undefined,
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
  default: {
    serviceStaking: { getEarnFunding: (key: string) => mockGetFunding(key) },
  },
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
    balanceProps,
  }: {
    inputProps: { testID: string };
    value?: string;
    disabled?: boolean;
    onChange: (value: string) => void;
    balanceProps?: { onPress?: () => void };
  }) => (
    <>
      <input
        data-testid={inputProps.testID}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        aria-label="Max"
        data-testid={`${inputProps.testID}-max`}
        disabled={!balanceProps?.onPress}
        onClick={balanceProps?.onPress}
      />
    </>
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
  useLoanRouterAccount: () => ({ accountId: mockAccountId }),
  useLoanRouterFacts: () => ({
    byRoute: new Map([['route', mockFacts]]),
    isLoaded: true,
    hasFailedRoutes: false,
    factsRevision: mockFactsRevision,
    nextFactsRevision: () => mockFactsRevision + 1,
    refresh: mockRefreshFacts,
  }),
}));
jest.mock('./useLoanPayWith', () => ({
  useLoanPayWith: () => mockPayWith,
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
  mockPayWith.isSwapping = false;
  mockPayWith.wrappedFundingToken = undefined;
  mockRefreshPayTokens.mockClear();
  mockRefreshFacts.mockClear();
  mockPayWith.keepWrappedPick.mockClear();
  mockSwap.mockClear();
  mockGetFunding.mockReset();
  mockGetFunding.mockResolvedValue(null);
  mockFactsRevision = 1;
  mockAccountId = 'account';
  mockFacts = {
    ...mockFacts,
    walletBalance: '100',
    wrappedWalletBalance: undefined,
    networkAccountId: 'account',
  };
});

it('waits for refreshed market facts after completing retained supply', async () => {
  const view = render(<EarnLoanRouter />);
  mockAcknowledgeSupply.mockImplementationOnce(async () => {
    mockRun.fundedSupplyAmount = undefined;
    return true;
  });
  fireEvent.click(screen.getByTestId('loan-acknowledge-supply'));
  await waitFor(() => expect(mockAcknowledgeSupply).toHaveBeenCalledTimes(1));
  view.rerender(<EarnLoanRouter />);
  expect(
    (screen.getByTestId('earn-loan-collateral-input') as HTMLInputElement)
      .disabled,
  ).toBe(true);
  expect(screen.getByTestId('loan-refresh-positions')).toBeDefined();
  mockFacts = { ...mockFacts, walletBalance: '0' };
  mockFactsRevision += 1;
  view.rerender(<EarnLoanRouter />);
  expect(
    (screen.getByTestId('earn-loan-collateral-input') as HTMLInputElement)
      .disabled,
  ).toBe(false);
});

it('does not treat facts returned while Done is pending as a post-Done refresh', async () => {
  let finish: ((closed: boolean) => void) | undefined;
  mockAcknowledgeSupply.mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<EarnLoanRouter />);
  fireEvent.click(screen.getByTestId('loan-acknowledge-supply'));
  mockFacts = { ...mockFacts, walletBalance: '80' };
  mockFactsRevision = 2;
  view.rerender(<EarnLoanRouter />);
  mockRun.fundedSupplyAmount = undefined;
  finish?.(true);
  await waitFor(() =>
    expect(
      (screen.getByTestId('earn-loan-collateral-input') as HTMLInputElement)
        .disabled,
    ).toBe(true),
  );
  mockFacts = { ...mockFacts, walletBalance: '0' };
  mockFactsRevision = 3;
  view.rerender(<EarnLoanRouter />);
  expect(
    (screen.getByTestId('earn-loan-collateral-input') as HTMLInputElement)
      .disabled,
  ).toBe(false);
});

it('refreshes the exact WETH balance before opening Max and supply again', async () => {
  const wethAddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
  mockPayWith.wrappedFundingToken = {
    ...mockRoute.collateral,
    address: wethAddress,
    reserveAddress: wethAddress,
    symbol: 'WETH',
    name: 'Wrapped Ether',
  };
  mockAcknowledgeSupply.mockImplementationOnce(async () => {
    mockRun.fundedSupplyAmount = undefined;
    return true;
  });
  const view = render(<EarnLoanRouter />);
  fireEvent.click(screen.getByTestId('loan-acknowledge-supply'));
  await waitFor(() => expect(mockRefreshFacts).toHaveBeenCalledTimes(1));
  expect(mockRefreshPayTokens).toHaveBeenCalledTimes(1);
  expect(mockPayWith.keepWrappedPick).toHaveBeenCalledTimes(1);

  mockFactsRevision += 1;
  view.rerender(<EarnLoanRouter />);
  const collateral = screen.getByTestId(
    'earn-loan-collateral-input',
  ) as HTMLInputElement;
  expect(collateral.disabled).toBe(true);
  const max = screen.getByTestId(
    'earn-loan-collateral-input-max',
  ) as HTMLButtonElement;
  expect(max.disabled).toBe(true);

  fireEvent.click(screen.getByTestId('loan-refresh-positions'));
  expect(mockRefreshFacts).toHaveBeenCalledTimes(2);
  mockFacts = {
    ...mockFacts,
    wrappedWalletBalance: { address: wethAddress, amount: '3.5' },
  };
  mockFactsRevision += 1;
  view.rerender(<EarnLoanRouter />);
  await waitFor(() => expect(collateral.disabled).toBe(false));
  fireEvent.change(collateral, { target: { value: '4' } });
  expect((screen.getByTestId('submit') as HTMLButtonElement).disabled).toBe(
    true,
  );
  fireEvent.click(max);
  expect(collateral.value).toBe('3.5');
  fireEvent.click(screen.getByTestId('submit'));
  await waitFor(() =>
    expect(mockStart).toHaveBeenCalledWith(
      expect.objectContaining({
        collateralAmount: '3.5',
        supplyToken: expect.objectContaining({ address: wethAddress }),
      }),
    ),
  );

  mockFacts = {
    ...mockFacts,
    wrappedWalletBalance: { address: wethAddress, amount: '0' },
  };
  mockFactsRevision += 1;
  view.rerender(<EarnLoanRouter />);
  expect((screen.getByTestId('submit') as HTMLButtonElement).disabled).toBe(
    true,
  );
  fireEvent.click(max);
  expect(collateral.value).toBe('0');
});

it('returns to the selected swap path after completing a supplied handoff', async () => {
  mockRun.fundedSupplyAmount = undefined;
  mockPayWith.isSwapping = true;
  const view = render(<EarnLoanRouter />);
  const collateral = screen.getByTestId('earn-loan-collateral-input');
  fireEvent.change(collateral, { target: { value: '10' } });
  fireEvent.click(screen.getByTestId('submit'));
  await waitFor(() => expect(mockSwap).toHaveBeenCalledTimes(1));
  mockRun.fundedSupplyAmount = '10';
  view.rerender(<EarnLoanRouter />);
  mockAcknowledgeSupply.mockImplementationOnce(async () => {
    mockRun.fundedSupplyAmount = undefined;
    mockFacts = { ...mockFacts, walletBalance: '0' };
    return true;
  });
  fireEvent.click(screen.getByTestId('loan-acknowledge-supply'));
  await waitFor(() => expect(mockAcknowledgeSupply).toHaveBeenCalledTimes(1));
  mockFactsRevision += 1;
  view.rerender(<EarnLoanRouter />);
  await waitFor(() =>
    expect((collateral as HTMLInputElement).disabled).toBe(false),
  );
  fireEvent.change(collateral, { target: { value: '5' } });
  fireEvent.click(screen.getByTestId('submit'));
  await waitFor(() => expect(mockSwap).toHaveBeenCalledTimes(2));
});

it('retains an unconsumed swap handoff when a different supply is completed', async () => {
  mockRun.fundedSupplyAmount = undefined;
  mockPayWith.isSwapping = true;
  const view = render(<EarnLoanRouter />);
  const collateral = screen.getByTestId('earn-loan-collateral-input');
  fireEvent.change(collateral, { target: { value: '10' } });
  fireEvent.click(screen.getByTestId('submit'));
  await waitFor(() => expect(mockSwap).toHaveBeenCalledTimes(1));
  mockRun.fundedSupplyAmount = '10';
  view.rerender(<EarnLoanRouter />);
  mockGetFunding.mockResolvedValue({
    status: 'funded',
    txId: 'swap-tx',
    receivedAmount: '10',
  });
  mockAcknowledgeSupply.mockImplementationOnce(async () => {
    mockRun.fundedSupplyAmount = undefined;
    return true;
  });
  fireEvent.click(screen.getByTestId('loan-acknowledge-supply'));
  await waitFor(() => expect(mockAcknowledgeSupply).toHaveBeenCalledTimes(1));
  mockFactsRevision += 1;
  view.rerender(<EarnLoanRouter />);
  fireEvent.change(collateral, { target: { value: '5' } });
  fireEvent.click(screen.getByTestId('submit'));
  expect(mockSwap).toHaveBeenCalledTimes(1);
  expect(mockStart).toHaveBeenCalledWith(
    expect.objectContaining({ collateralAmount: '5' }),
  );
});

it('keeps a handoff locked until its receipt can be read after Done', async () => {
  mockRun.fundedSupplyAmount = undefined;
  mockPayWith.isSwapping = true;
  const view = render(<EarnLoanRouter />);
  fireEvent.change(screen.getByTestId('earn-loan-collateral-input'), {
    target: { value: '10' },
  });
  fireEvent.click(screen.getByTestId('submit'));
  await waitFor(() => expect(mockSwap).toHaveBeenCalledTimes(1));
  mockRun.fundedSupplyAmount = '10';
  view.rerender(<EarnLoanRouter />);
  mockGetFunding
    .mockRejectedValueOnce(new Error('storage unavailable'))
    .mockResolvedValueOnce(null);
  mockAcknowledgeSupply.mockImplementationOnce(async () => {
    mockRun.fundedSupplyAmount = undefined;
    return true;
  });
  fireEvent.click(screen.getByTestId('loan-acknowledge-supply'));
  await waitFor(() => expect(mockGetFunding).toHaveBeenCalledTimes(1));
  mockFactsRevision += 1;
  view.rerender(<EarnLoanRouter />);
  expect(
    (screen.getByTestId('earn-loan-collateral-input') as HTMLInputElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByTestId('loan-refresh-positions'));
  await waitFor(() =>
    expect(
      (screen.getByTestId('earn-loan-collateral-input') as HTMLInputElement)
        .disabled,
    ).toBe(false),
  );
});

it('does not apply an old receipt-read failure to a newly selected account', async () => {
  mockRun.fundedSupplyAmount = undefined;
  mockPayWith.isSwapping = true;
  const view = render(<EarnLoanRouter />);
  fireEvent.change(screen.getByTestId('earn-loan-collateral-input'), {
    target: { value: '10' },
  });
  fireEvent.click(screen.getByTestId('submit'));
  await waitFor(() => expect(mockSwap).toHaveBeenCalledTimes(1));
  mockRun.fundedSupplyAmount = '10';
  view.rerender(<EarnLoanRouter />);
  mockGetFunding.mockRejectedValueOnce(new Error('storage unavailable'));
  mockAcknowledgeSupply.mockImplementationOnce(async () => {
    mockRun.fundedSupplyAmount = undefined;
    return true;
  });
  fireEvent.click(screen.getByTestId('loan-acknowledge-supply'));
  await waitFor(() => expect(mockGetFunding).toHaveBeenCalledTimes(1));
  view.rerender(<EarnLoanRouter />);
  expect(
    (screen.getByTestId('earn-loan-collateral-input') as HTMLInputElement)
      .disabled,
  ).toBe(true);
  mockAccountId = 'other';
  mockFacts = { ...mockFacts, networkAccountId: 'other' };
  view.rerender(<EarnLoanRouter />);
  expect(
    (screen.getByTestId('earn-loan-collateral-input') as HTMLInputElement)
      .disabled,
  ).toBe(false);
});

it('ignores an older receipt read after a newer retry has completed', async () => {
  mockRun.fundedSupplyAmount = undefined;
  mockPayWith.isSwapping = true;
  const view = render(<EarnLoanRouter />);
  const collateral = screen.getByTestId('earn-loan-collateral-input');
  fireEvent.change(collateral, { target: { value: '10' } });
  fireEvent.click(screen.getByTestId('submit'));
  await waitFor(() => expect(mockSwap).toHaveBeenCalledTimes(1));
  mockRun.fundedSupplyAmount = '10';
  view.rerender(<EarnLoanRouter />);
  let finish: ((value: unknown) => void) | undefined;
  mockGetFunding
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce(null);
  mockAcknowledgeSupply.mockImplementationOnce(async () => {
    mockRun.fundedSupplyAmount = undefined;
    return true;
  });
  fireEvent.click(screen.getByTestId('loan-acknowledge-supply'));
  await waitFor(() => expect(mockGetFunding).toHaveBeenCalledTimes(1));
  mockFactsRevision += 1;
  view.rerender(<EarnLoanRouter />);
  fireEvent.click(screen.getByTestId('loan-refresh-positions'));
  await waitFor(() =>
    expect((collateral as HTMLInputElement).disabled).toBe(false),
  );
  finish?.({ status: 'funded', txId: 'swap-tx', receivedAmount: '10' });
  await waitFor(() => expect(mockGetFunding).toHaveBeenCalledTimes(2));
  fireEvent.change(collateral, { target: { value: '5' } });
  fireEvent.click(screen.getByTestId('submit'));
  await waitFor(() => expect(mockSwap).toHaveBeenCalledTimes(2));
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
