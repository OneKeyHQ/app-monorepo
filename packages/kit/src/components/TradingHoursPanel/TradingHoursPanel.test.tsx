/** @jest-environment jsdom */
import type { PropsWithChildren, ReactNode } from 'react';

import { TradingHoursTrigger } from '.';

import { render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IFetchUSMarketStatusResult } from '@onekeyhq/shared/types/swap/types';

let mockStatus: IFetchUSMarketStatusResult | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
    formatDate: () => 'time',
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useInterval', () => ({
  useInterval: () => undefined,
}));
jest.mock('@onekeyhq/kit/src/hooks/useUSMarketStatus', () => ({
  useUSMarketStatus: () => mockStatus,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/components', () => {
  const Frame = ({
    children,
    bg,
    testID,
  }: PropsWithChildren<{ bg?: string; testID?: string }>) => (
    <div data-bg={bg} data-testid={testID}>
      {children}
    </div>
  );
  return {
    Stack: Frame,
    XStack: Frame,
    YStack: Frame,
    SizableText: Frame,
    Icon: () => null,
    Popover: ({ renderContent }: { renderContent: ReactNode }) => renderContent,
    useMedia: () => ({ md: false }),
  };
});

afterEach(() => {
  jest.useRealTimers();
  mockStatus = undefined;
});

it.each(['ondo', 'xstock', 'bstock'])(
  'updates %s trading hours when the backend reports a weekday closure',
  (source) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-26T15:00:00Z'));
    const panel = (
      <TradingHoursTrigger
        stock={{
          title: 'AAPL',
          subtitle: 'Apple',
          source,
          sourceLogoUri: '',
          isOpen: true,
        }}
        renderTrigger={<span>status</span>}
      />
    );
    const { rerender } = render(panel);
    expect(
      screen
        .getByText(ETranslations.trading_hours_regular_market)
        .closest('[data-bg="$bgSuccess"]'),
    ).not.toBeNull();

    mockStatus = { open: false, session: 'CLOSED', reason: 'holiday' };
    rerender(
      <TradingHoursTrigger
        stock={{
          title: 'AAPL',
          subtitle: 'Apple',
          source,
          sourceLogoUri: '',
          isOpen: true,
        }}
        renderTrigger={<span>status</span>}
      />,
    );

    expect(
      screen
        .getByText(ETranslations.trading_hours_market_closed)
        .closest('[data-bg="$bgSuccess"]'),
    ).not.toBeNull();
    expect(
      screen
        .getByText(ETranslations.trading_hours_regular_market)
        .closest('[data-bg="$bgSuccess"]'),
    ).toBeNull();
    expect(
      screen.getByText(ETranslations.trading_hours_closed_tradable_description),
    ).toBeTruthy();
    expect(
      screen.queryByText(ETranslations.trading_hours_risk_notice),
    ).toBeNull();
  },
);
