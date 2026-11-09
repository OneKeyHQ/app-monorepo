/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

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
    disabled,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
    testID?: string;
  }) =>
    onPress ? (
      <button
        data-testid={testID}
        disabled={disabled}
        onClick={onPress}
        type="button"
      >
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    );

  return {
    Button: View,
    Checkbox: ({
      description,
      label,
      onChange,
      testID,
      value,
    }: {
      description?: string;
      label?: ReactNode;
      onChange?: (value: boolean) => void;
      testID?: string;
      value?: boolean;
    }) => (
      <button
        data-description={description}
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
      FooterActions: ({ cancelButton }: { cancelButton?: ReactNode }) => (
        <>{cancelButton}</>
      ),
    },
    Popover: ({
      renderContent,
      renderTrigger,
    }: {
      renderContent?: (props: { closePopover: () => void }) => ReactNode;
      renderTrigger?: ReactNode;
    }) => (
      <>
        {renderTrigger}
        {renderContent?.({ closePopover: jest.fn() })}
      </>
    ),
    ScrollView: View,
    Select: ({
      defaultTriggerInputProps,
      items,
      onChange,
      testID,
      value,
    }: {
      defaultTriggerInputProps?: { leftIconName?: string };
      items: {
        label: string;
        value: string;
        leading?: { props: { name?: string } };
      }[];
      onChange: (value: string) => void;
      testID: string;
      value: string;
    }) => (
      <select
        data-testid={testID}
        data-left-icon={defaultTriggerInputProps?.leftIconName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {items.map((item) => (
          <option
            key={item.value}
            value={item.value}
            data-icon={item.leading?.props.name}
          >
            {item.label}
          </option>
        ))}
      </select>
    ),
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
    expect(previousCloseCheckbox.textContent).toBe('market.prev_close');
    expect(previousCloseCheckbox.getAttribute('data-value')).toBe('false');

    fireEvent.click(previousCloseCheckbox);

    const nextValue = onChange.mock.calls.at(-1)?.[0];
    expect(nextValue?.options.previousClose).toBe(true);
  });

  it('shows the navigation buttons option disabled by default and updates it', () => {
    const initialValue = createTradingViewChartSettingsValue();
    const onChange = jest.fn<void, [ITradingViewChartSettingsValue]>();

    render(
      <TradingViewChartSettings
        defaultValue={initialValue}
        mobileLayout
        onChange={onChange}
      />,
    );

    const navigationButtonsCheckbox = screen.getByTestId(
      'trading-view-settings-checkbox-navigation-buttons',
    );
    expect(navigationButtonsCheckbox.textContent).toBe(
      'chart_navigation_buttons__title',
    );
    expect(navigationButtonsCheckbox.getAttribute('data-description')).toBe(
      'chart_navigation_buttons__desc',
    );
    expect(
      screen
        .getByTestId('trading-view-settings-checkbox-click-interaction')
        .getAttribute('data-description'),
    ).toBe('chart_interaction__desc');
    expect(navigationButtonsCheckbox.getAttribute('data-value')).toBe('false');

    fireEvent.click(navigationButtonsCheckbox);

    const nextValue = onChange.mock.calls.at(-1)?.[0];
    expect(nextValue?.options.navigationButtons).toBe(true);
  });

  it('keeps the chart interface group when only navigation buttons are offered', () => {
    render(
      <TradingViewChartSettings
        defaultValue={createTradingViewChartSettingsValue()}
        mobileLayout
        hiddenOptionIds={['clickInteraction']}
      />,
    );

    expect(
      screen.queryByTestId('trading-view-settings-checkbox-click-interaction'),
    ).toBeNull();
    expect(
      screen.getByTestId('trading-view-settings-checkbox-navigation-buttons'),
    ).toBeTruthy();
  });

  it('lets the chart display leading row confirm pending edits', async () => {
    const onConfirm = jest.fn<Promise<void>, [ITradingViewChartSettingsValue]>(
      () => Promise.resolve(),
    );
    let confirmDraft: (() => Promise<boolean>) | undefined;

    render(
      <TradingViewChartSettings
        defaultValue={createTradingViewChartSettingsValue()}
        mobileLayout
        showChartType
        onConfirm={onConfirm}
        renderChartDisplayLeadingRow={(helpers) => {
          confirmDraft = helpers.confirmDraft;
          return null;
        }}
      />,
    );

    fireEvent.change(
      screen.getByTestId('trading-view-settings-select-chart-type'),
      { target: { value: 'line' } },
    );

    let confirmed = false;
    await act(async () => {
      confirmed = (await confirmDraft?.()) ?? false;
    });

    expect(confirmed).toBe(true);
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ chartType: 'line' }),
    );
  });

  it('shows native chart types in settings and updates the preference', () => {
    const initialValue = createTradingViewChartSettingsValue();
    const onChange = jest.fn<void, [ITradingViewChartSettingsValue]>();

    render(
      <TradingViewChartSettings
        defaultValue={initialValue}
        mobileLayout
        showChartType
        onChange={onChange}
      />,
    );

    const chartTypeSelect = screen.getByTestId(
      'trading-view-settings-select-chart-type',
    );
    expect(chartTypeSelect.textContent).toContain('global.auto');
    expect(chartTypeSelect.getAttribute('data-left-icon')).toBe(
      'MagicStickOutline',
    );
    expect(
      Array.from(chartTypeSelect.querySelectorAll('option')).map((option) => [
        option.value,
        option.getAttribute('data-icon'),
      ]),
    ).toEqual([
      ['auto', 'MagicStickOutline'],
      ['candlestick', 'TradingViewCandlesOutline'],
      ['heikinAshi', 'TradingViewBarsOutline'],
      ['bars', 'TradingViewCandlesHlcOutline'],
      ['line', 'TradingViewLineOutline'],
      ['area', 'ChartTrending2Outline'],
    ]);

    fireEvent.change(
      screen.getByTestId('trading-view-settings-select-chart-type'),
      { target: { value: 'line' } },
    );

    const nextValue = onChange.mock.calls.at(-1)?.[0];
    expect(nextValue?.chartType).toBe('line');
  });

  it('applies reset defaults immediately without waiting for confirm', async () => {
    const committedValue: ITradingViewChartSettingsValue = {
      ...createTradingViewChartSettingsValue(),
      chartType: 'line',
    };
    const onConfirm = jest.fn<Promise<void>, [ITradingViewChartSettingsValue]>(
      () => Promise.resolve(),
    );
    const onConfirmSuccess = jest.fn();

    render(
      <TradingViewChartSettings
        value={committedValue}
        usePageFooter
        showChartType
        onConfirm={onConfirm}
        onConfirmSuccess={onConfirmSuccess}
      />,
    );

    expect(
      (
        screen.getByTestId(
          'trading-view-settings-select-chart-type',
        ) as HTMLSelectElement
      ).value,
    ).toBe('line');

    await act(async () => {
      fireEvent.click(screen.getByTestId('trading-view-settings-mock-reset'));
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(
      createTradingViewChartSettingsValue(),
    );
    // Reset persists in place; only Confirm closes the settings.
    expect(onConfirmSuccess).not.toHaveBeenCalled();
    expect(
      (
        screen.getByTestId(
          'trading-view-settings-select-chart-type',
        ) as HTMLSelectElement
      ).value,
    ).toBe('auto');
  });

  it('keeps controls enabled and ignores repeat presses while reset persists', async () => {
    let resolveConfirm: () => void = () => {};
    const onConfirm = jest.fn<Promise<void>, [ITradingViewChartSettingsValue]>(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        }),
    );

    render(
      <TradingViewChartSettings
        defaultValue={{
          ...createTradingViewChartSettingsValue(),
          chartType: 'line',
        }}
        usePageFooter
        showChartType
        onConfirm={onConfirm}
      />,
    );

    const resetButton = screen.getByTestId(
      'trading-view-settings-mock-reset',
    ) as HTMLButtonElement;

    await act(async () => {
      fireEvent.click(resetButton);
    });

    // Reset resolves almost instantly, so flipping the dialog into its
    // submitting state for that window reads as a flash.
    expect(resetButton.disabled).toBe(false);
    expect(
      (
        screen.getByTestId(
          'trading-view-settings-select-chart-type',
        ) as HTMLSelectElement
      ).value,
    ).toBe('auto');

    await act(async () => {
      fireEvent.click(resetButton);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveConfirm();
    });

    await act(async () => {
      fireEvent.click(resetButton);
    });
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it('keeps edits made while reset persists as an unsaved draft', async () => {
    let resolveConfirm: () => void = () => {};
    const onConfirm = jest.fn<Promise<void>, [ITradingViewChartSettingsValue]>(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        }),
    );
    const renderSettings = (value: ITradingViewChartSettingsValue) => (
      <TradingViewChartSettings
        value={value}
        usePageFooter
        showChartType
        onConfirm={onConfirm}
      />
    );
    const getChartTypeSelect = () =>
      screen.getByTestId(
        'trading-view-settings-select-chart-type',
      ) as HTMLSelectElement;

    const { rerender } = render(
      renderSettings({
        ...createTradingViewChartSettingsValue(),
        chartType: 'line',
      }),
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('trading-view-settings-mock-reset'));
    });
    expect(getChartTypeSelect().value).toBe('auto');

    fireEvent.change(getChartTypeSelect(), { target: { value: 'area' } });
    expect(getChartTypeSelect().value).toBe('area');

    // The persisted reset reaches the controlled value as a fresh object
    // before onConfirm resolves, like a store-backed settings atom.
    rerender(renderSettings(createTradingViewChartSettingsValue()));
    await act(async () => {
      resolveConfirm();
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(
      createTradingViewChartSettingsValue(),
    );
    expect(getChartTypeSelect().value).toBe('area');
  });

  it('keeps the reset draft and reports the error when applying it fails', async () => {
    const error = new Error('persist failed');
    const onConfirm = jest.fn<Promise<void>, [ITradingViewChartSettingsValue]>(
      () => Promise.reject(error),
    );
    const onConfirmError = jest.fn();

    render(
      <TradingViewChartSettings
        defaultValue={{
          ...createTradingViewChartSettingsValue(),
          chartType: 'line',
        }}
        usePageFooter
        showChartType
        onConfirm={onConfirm}
        onConfirmError={onConfirmError}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('trading-view-settings-mock-reset'));
    });

    expect(onConfirmError).toHaveBeenCalledWith(error);
    expect(
      (
        screen.getByTestId(
          'trading-view-settings-select-chart-type',
        ) as HTMLSelectElement
      ).value,
    ).toBe('auto');
  });
});
