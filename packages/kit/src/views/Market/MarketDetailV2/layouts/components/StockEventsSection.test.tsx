/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketStockEvent } from '@onekeyhq/shared/types/marketV2';

import { StockEventsSection } from './StockEventsSection';

let mockEvent: IMarketStockEvent;

jest.mock('@onekeyhq/components', () => {
  const Stack = ({
    children,
    onPress,
    testID,
  }: PropsWithChildren<{ onPress?: () => void; testID?: string }>) =>
    onPress ? (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    );
  return {
    Button: Stack,
    Icon: () => null,
    SizableText: Stack,
    Skeleton: Stack,
    Stack,
    XStack: Stack,
    YStack: Stack,
  };
});
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit/src/hooks/useFormatDate', () => ({
  __esModule: true,
  default: () => ({ format: () => '24', formatDate: () => '' }),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: {
      status: 'success',
      data: { stockId: 'AAPL', items: [mockEvent] },
    },
    isLoading: false,
  }),
}));
jest.mock('../../hooks/StockDetailContext', () => ({
  useStockDetail: () => ({ stockId: 'AAPL' }),
}));

it.each([
  ['0.03447088759167789', '$0.03'],
  [0.034_470_887_591_677_89, '$0.03'],
  ['-1.23456', '-$1.23'],
  ['0', '$0'],
])('keeps EPS %p consistent when expanding and collapsing', (eps, expected) => {
  mockEvent = {
    id: 'earnings',
    type: 'earnings',
    title: 'Earnings',
    date: '2026-11-24',
    status: 'scheduled',
    metadata: { epsEstimated: eps },
  };
  render(<StockEventsSection />);
  const expectedText = `${ETranslations.market_stock_event_eps_estimate}: ${expected}`;
  expect(screen.getByText(expectedText)).toBeTruthy();
  fireEvent.click(screen.getByTestId('stock-event-earnings'));
  expect(screen.getByText(expectedText)).toBeTruthy();
  fireEvent.click(screen.getByTestId('stock-event-earnings'));
  expect(screen.getByText(expectedText)).toBeTruthy();
});
