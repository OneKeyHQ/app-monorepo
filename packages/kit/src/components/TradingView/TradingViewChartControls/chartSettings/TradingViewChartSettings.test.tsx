/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { TradingViewChartSettings } from './TradingViewChartSettings';
import { createTradingViewChartSettingsValue } from './TradingViewSettingsMockState';

import type { ITradingViewChartSettingsValue } from './TradingViewSettingsMockState';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ height: 800, width: 1200 }),
}));

jest.mock('@onekeyhq/components', () => {
  const View = ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) =>
    onPress ? (
      <button data-testid={testID} onClick={onPress} type="button">
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    );

  return {
    Button: View,
    Checkbox: ({
      label,
      onChange,
      testID,
      value,
    }: {
      label?: ReactNode;
      onChange?: (value: boolean) => void;
      testID?: string;
      value?: boolean;
    }) => (
      <button
        data-testid={testID}
        data-value={String(value)}
        onClick={() => onChange?.(!value)}
        type="button"
      >
        {label}
      </button>
    ),
    ColorPicker: ({
      disabled,
      onChange,
      testID,
      value,
    }: {
      disabled?: boolean;
      onChange?: (value: string) => void;
      testID?: string;
      value?: string;
    }) => (
      <button
        aria-label={testID ?? 'color picker'}
        data-testid={testID ? `${testID}-trigger` : undefined}
        data-value={value}
        disabled={disabled}
        onClick={() => {
          if (testID === 'latest-price-up-color') {
            onChange?.('#123456');
          }
          if (testID === 'latest-price-down-color') {
            onChange?.('#654321');
          }
        }}
        type="button"
      />
    ),
    DesktopTabItem: () => null,
    Divider: () => <hr />,
    Icon: () => null,
    IconButton: View,
    Page: {
      Footer: View,
      FooterActions: View,
    },
    Popover: ({ renderTrigger }: { renderTrigger?: ReactNode }) => (
      <>{renderTrigger}</>
    ),
    ScrollView: View,
    SizableText: View,
    XStack: View,
    YStack: View,
    useMedia: () => ({ md: false }),
  };
});

describe('TradingViewChartSettings', () => {
  it('updates latest-price up and down colors independently', () => {
    const initialValue = createTradingViewChartSettingsValue();
    const onChange = jest.fn<void, [ITradingViewChartSettingsValue]>();

    render(
      <TradingViewChartSettings
        defaultValue={initialValue}
        mobileLayout
        onChange={onChange}
      />,
    );

    const upColorTrigger = screen.getByTestId('latest-price-up-color-trigger');
    const downColorTrigger = screen.getByTestId(
      'latest-price-down-color-trigger',
    );

    expect(upColorTrigger.getAttribute('data-value')).toBe(
      initialValue.latestPriceLine.upColor,
    );
    expect(downColorTrigger.getAttribute('data-value')).toBe(
      initialValue.latestPriceLine.downColor,
    );

    fireEvent.click(upColorTrigger);

    const valueAfterUpChange =
      onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    expect(valueAfterUpChange?.latestPriceLine).toEqual({
      ...initialValue.latestPriceLine,
      upColor: '#123456',
    });

    fireEvent.click(downColorTrigger);

    const valueAfterDownChange =
      onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    expect(valueAfterDownChange?.latestPriceLine).toEqual({
      ...initialValue.latestPriceLine,
      upColor: '#123456',
      downColor: '#654321',
    });
  });

  it('shows the previous-close option disabled by default and updates it', () => {
    const initialValue = createTradingViewChartSettingsValue();
    const onChange = jest.fn<void, [ITradingViewChartSettingsValue]>();

    render(
      <TradingViewChartSettings
        defaultValue={initialValue}
        mobileLayout
        onChange={onChange}
      />,
    );

    const previousCloseCheckbox = screen.getByTestId(
      'trading-view-settings-checkbox-previous-close',
    );
    expect(previousCloseCheckbox.textContent).toBe('Prev close');
    expect(previousCloseCheckbox.getAttribute('data-value')).toBe('false');

    fireEvent.click(previousCloseCheckbox);

    const nextValue = onChange.mock.calls.at(-1)?.[0];
    expect(nextValue?.options.previousClose).toBe(true);
  });
});
