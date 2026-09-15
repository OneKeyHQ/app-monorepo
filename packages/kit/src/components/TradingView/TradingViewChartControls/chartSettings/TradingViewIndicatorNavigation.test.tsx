/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import {
  TradingViewIndicatorScopeTabs,
  TradingViewIndicatorSidebar,
} from './TradingViewIndicatorNavigation';
import { createTradingViewIndicatorSettingsValue } from './TradingViewSettingsMockState';

type IMockProps = {
  children?: ReactNode;
  onPress?: () => void;
  testID?: string;
  variant?: string;
};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  // Layout mocks are divs so a pressable row can contain a pressable checkbox
  // without nesting <button> elements.
  const View = ({ children, onPress, testID }: IMockProps) =>
    onPress ? (
      <div
        data-testid={testID}
        role="button"
        tabIndex={0}
        onClick={onPress}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onPress();
        }}
      >
        {children}
      </div>
    ) : (
      <div data-testid={testID}>{children}</div>
    );

  return {
    Checkbox: ({
      onChange,
      testID,
      value,
    }: {
      onChange?: (value: boolean) => void;
      testID?: string;
      value?: boolean;
    }) => (
      <div
        data-testid={testID}
        data-value={String(value)}
        role="checkbox"
        aria-checked={Boolean(value)}
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation();
          onChange?.(!value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onChange?.(!value);
        }}
      >
        checkbox
      </div>
    ),
    Icon: () => null,
    ScrollView: View,
    SizableText: View,
    Tabs: {
      TabBarItem: ({
        isFocused,
        label,
        name,
        onPress,
        testID,
      }: {
        isFocused?: boolean;
        label?: string;
        name: string;
        onPress: (name: string) => void;
        testID?: string;
      }) => (
        <button
          data-testid={testID}
          data-focused={String(Boolean(isFocused))}
          onClick={() => onPress(name)}
          type="button"
        >
          {label}
        </button>
      ),
    },
    XStack: View,
    YStack: View,
  };
});

describe('TradingViewIndicatorScopeTabs', () => {
  it('renders the scopes as tabs and reports a change', () => {
    const value = createTradingViewIndicatorSettingsValue();
    const handleChange = jest.fn();

    render(
      <TradingViewIndicatorScopeTabs
        value="main"
        indicators={value.indicators}
        maxActiveSubIndicatorCount={null}
        onChange={handleChange}
      />,
    );

    expect(
      screen.getByTestId('trading-view-indicator-scope-main').dataset.focused,
    ).toBe('true');
    expect(
      screen.getByTestId('trading-view-indicator-scope-sub').dataset.focused,
    ).toBe('false');

    fireEvent.click(screen.getByTestId('trading-view-indicator-scope-sub'));

    expect(handleChange).toHaveBeenCalledWith('sub');
  });
});

describe('TradingViewIndicatorSidebar', () => {
  it('selects a row on press and toggles it through its checkbox', () => {
    const value = createTradingViewIndicatorSettingsValue();
    const indicators = value.indicators.filter(
      (indicator) => indicator.scope === 'main',
    );
    const [first, second] = indicators;
    const handleSelect = jest.fn();
    const handleToggle = jest.fn();

    render(
      <TradingViewIndicatorSidebar
        indicators={indicators}
        selectedIndicatorId={first.id}
        onSelect={handleSelect}
        onToggle={handleToggle}
      />,
    );

    fireEvent.click(
      screen.getByTestId(`trading-view-indicator-sidebar-${second.id}`),
    );
    expect(handleSelect).toHaveBeenCalledWith(second.id);

    fireEvent.click(
      screen.getByTestId(`trading-view-indicator-sidebar-toggle-${first.id}`),
    );
    expect(handleToggle).toHaveBeenCalledWith(first.id, !first.active);
  });
});
