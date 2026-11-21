/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import { EarnDesktopYourLoans } from './EarnDesktopYourLoans';

import type { IEarnDesktopAccountMarket } from './useEarnDesktopHomeData';

jest.mock('@onekeyhq/components', () => {
  const Box = ({
    children,
    testID,
  }: {
    children?: React.ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
  const Accordion = Object.assign(Box, {
    Item: Box,
    HeightAnimator: Box,
    Content: Box,
  });
  return {
    Accordion,
    Badge: Box,
    Button: ({
      children,
      onPress,
    }: {
      children: React.ReactNode;
      onPress: () => void;
    }) => (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    ),
    Icon: () => null,
    SizableText: Box,
    Skeleton: () => <div data-testid="loan-skeleton" />,
    Spinner: () => <div data-testid="loan-loading" />,
    Stack: Box,
    XStack: Box,
    YStack: Box,
    useMedia: () => ({ gtMd: false }),
  };
});
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => true }));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  useCurrency: () => ({ symbol: '$' }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('../../../Borrow/borrowMarketDisplayName', () => ({
  getBorrowMarketLabel: (market: { name: string }) => market.name,
}));
jest.mock('../../../Borrow/borrowUtils', () => ({ BorrowNavigation: {} }));
jest.mock('../../earnUtils', () => ({ EarnNavigation: {} }));
jest.mock('../../pages/EarnLoanRouter/loanRouter.utils', () => ({
  LOAN_HEALTH_TEXT_COLOR: {},
  getLoanHealthTone: () => 'neutral',
}));
jest.mock('../../../Staking/components/ProtocolDisplayShared', () => ({
  ProtocolImage: () => null,
}));
jest.mock('./EarnLoanAssetLogos', () => ({ EarnLoanAssetLogos: () => null }));
jest.mock('./EarnMoreToggle', () => ({ EarnMoreToggle: () => null }));
jest.mock('./earnDesktopPressable', () => ({
  buildKeyboardPressProps: () => ({}),
}));
jest.mock('./EarnEasedSection', () => ({
  EasedSection: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('./earnDesktopHomeCopy', () => ({
  useEarnDesktopHomeCopy: () => ({ yourLoans: 'Your loans' }),
}));
jest.mock('./earnDesktopHome.utils', () => ({
  sortLoansByRisk: (loans: IEarnDesktopAccountMarket[]) => loans,
  summarizeLoanPosition: () => ({
    collateralAssets: [],
    collateralValue: 1,
    debtAssets: [],
    debtValue: 1,
  }),
  readLoanHealth: () => ({ text: '1.5' }),
}));

it('keeps a successful loan visible while another market remains unresolved', () => {
  const entry = {
    market: {
      name: 'Aave',
      provider: 'aave',
      networkId: 'evm--1',
      marketAddress: '0xmarket',
      network: { name: 'Ethereum', logoURI: '' },
    },
  } as IEarnDesktopAccountMarket;
  render(
    <EarnDesktopYourLoans
      loans={[entry]}
      isLoaded={false}
      hasError={false}
      onRetry={async () => undefined}
      accountScope="partial"
      onOpenMarket={() => undefined}
    />,
  );
  expect(screen.getByText('Aave')).toBeTruthy();
  expect(screen.getByTestId('loan-loading')).toBeTruthy();
});

it('does not portray an unresolved empty read as having no loans', () => {
  render(
    <EarnDesktopYourLoans
      loans={[]}
      isLoaded={false}
      hasError={false}
      onRetry={async () => undefined}
      accountScope="unresolved"
      onOpenMarket={() => undefined}
    />,
  );
  expect(screen.getAllByTestId('loan-skeleton').length).toBeGreaterThan(0);
});

it('shows retry instead of a spinner when a market read has failed', () => {
  const retry = jest.fn(async () => undefined);
  render(
    <EarnDesktopYourLoans
      loans={[]}
      isLoaded={false}
      hasError
      onRetry={retry}
      accountScope="failed"
      onOpenMarket={() => undefined}
    />,
  );
  expect(screen.queryByTestId('loan-skeleton')).toBeNull();
  expect(screen.queryByTestId('loan-loading')).toBeNull();
  fireEvent.click(screen.getByRole('button'));
  expect(retry).toHaveBeenCalledTimes(1);
});

it('keeps successful loans visible alongside a failed market retry', () => {
  const entry = {
    market: {
      name: 'Aave',
      provider: 'aave',
      networkId: 'evm--1',
      marketAddress: '0xmarket',
      network: { name: 'Ethereum', logoURI: '' },
    },
  } as IEarnDesktopAccountMarket;
  render(
    <EarnDesktopYourLoans
      loans={[entry]}
      isLoaded={false}
      hasError
      onRetry={async () => undefined}
      accountScope="partial-failure"
      onOpenMarket={() => undefined}
    />,
  );
  expect(screen.getByText('Aave')).toBeTruthy();
  expect(screen.getByRole('button')).toBeTruthy();
  expect(screen.queryByTestId('loan-loading')).toBeNull();
});
