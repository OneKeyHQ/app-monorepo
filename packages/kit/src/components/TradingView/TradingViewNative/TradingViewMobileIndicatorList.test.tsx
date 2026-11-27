/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { createTradingViewNativeIndicatorSettingsValue } from './indicatorSettingsAdapter';
import { localizeTradingViewNativeIndicatorSettingsValue } from './indicatorSettingsLocalization';
import { TradingViewMobileIndicatorList } from './TradingViewMobileIndicatorList';

type IMockProps = {
  children?: ReactNode;
  testID?: string;
  onPress?: () => void;
};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const View = ({ children, testID, onPress }: IMockProps) =>
    onPress ? (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    );
  return {
    Icon: () => null,
    SizableText: ({ children }: IMockProps) => <span>{children}</span>,
    XStack: View,
    YStack: View,
  };
});

function getIndicators() {
  return localizeTradingViewNativeIndicatorSettingsValue(
    createTradingViewNativeIndicatorSettingsValue(),
    { formatMessage: ({ id }) => id },
  ).indicators;
}

describe('TradingViewMobileIndicatorList', () => {
  it('names each indicator and leaves its explanation to the editor', () => {
    const indicators = getIndicators();
    const rsi = indicators.find(({ id }) => id === 'RSI');
    render(
      <TradingViewMobileIndicatorList
        indicators={indicators}
        onSelect={jest.fn()}
      />,
    );

    const row = screen.getByTestId(
      'trading-view-mobile-indicator-settings-RSI',
    );
    expect(rsi?.name).toBeTruthy();
    expect(rsi?.description).toBeTruthy();
    expect(within(row).getByText('RSI')).toBeTruthy();
    expect(within(row).getByText(rsi?.name ?? '')).toBeTruthy();
    expect(within(row).queryByText(rsi?.description ?? '')).toBeNull();
  });

  it('names the main-chart indicators too', () => {
    render(
      <TradingViewMobileIndicatorList
        indicators={getIndicators()}
        onSelect={jest.fn()}
      />,
    );

    const row = screen.getByTestId('trading-view-mobile-indicator-settings-MA');
    expect(within(row).getByText('MA')).toBeTruthy();
    expect(
      within(row).getByText(ETranslations.market_chart_indicator_ma__title),
    ).toBeTruthy();
  });

  it('selects the pressed indicator', () => {
    const onSelect = jest.fn();
    render(
      <TradingViewMobileIndicatorList
        indicators={getIndicators()}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(
      screen.getByTestId('trading-view-mobile-indicator-settings-MACD'),
    );

    expect(onSelect).toHaveBeenCalledWith('MACD');
  });
});
