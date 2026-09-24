/**
 * @jest-environment jsdom
 */

import { useState } from 'react';
import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import type { ISelectProps } from '@onekeyhq/components';

import { TradingViewLayoutSelector } from './TradingViewLayoutSelector.native';

const mockSelectTriggerPress = jest.fn();

jest.mock('@onekeyhq/components', () => {
  const Stack = ({
    children,
    testID,
    onPress,
    accessibilityLabel,
  }: {
    children?: ReactNode;
    testID?: string;
    onPress?: () => void;
    accessibilityLabel?: string;
  }) =>
    onPress ? (
      <button
        type="button"
        data-testid={testID}
        aria-label={accessibilityLabel}
        onClick={onPress}
      >
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    );
  return {
    Stack,
    Select: ({
      items,
      value,
      title,
      testID,
      onChange,
      renderTrigger,
    }: ISelectProps<number>) => (
      <>
        {renderTrigger?.({ onPress: mockSelectTriggerPress })}
        <select
          aria-label={title}
          data-testid={testID}
          value={value}
          onChange={(event) => {
            void onChange?.(Number(event.target.value));
          }}
        >
          {items?.map((item) => (
            <option key={String(item.value)} value={String(item.value)}>
              {item.label}
            </option>
          ))}
        </select>
      </>
    ),
    useTheme: () => ({ iconSubdued: { val: '#808080' } }),
  };
});

jest.mock('./TradingViewPanelIcon', () => ({
  TradingViewPanelIcon: () => null,
}));

function ChartLayout() {
  const [panelCount, setPanelCount] = useState(1);
  return (
    <div>
      <TradingViewLayoutSelector
        title="Chart layout"
        panelCount={panelCount}
        icon="single"
        onChange={setPanelCount}
      />
      <div data-testid="chart-count">{panelCount}</div>
    </div>
  );
}

describe('native chart layout selector', () => {
  beforeEach(() => {
    mockSelectTriggerPress.mockClear();
  });

  it('offers all supported layouts and updates the controlled selection', () => {
    render(<ChartLayout />);
    const select = screen.getByRole<HTMLSelectElement>('combobox', {
      name: 'Chart layout',
    });
    expect(
      screen.getAllByRole<HTMLOptionElement>('option').map((option) => ({
        label: option.textContent,
        value: option.value,
      })),
    ).toEqual([
      { label: '1 × 1', value: '1' },
      { label: '1 × 2', value: '2' },
      { label: '2 × 2', value: '4' },
    ]);
    expect(select.value).toBe('1');
    [4, 2, 1].forEach((count) => {
      fireEvent.change(select, { target: { value: String(count) } });
      expect(screen.getByTestId('chart-count').textContent).toBe(String(count));
      expect(select.value).toBe(String(count));
    });
  });

  it('opens Select without changing the layout and forwards numeric choices', () => {
    const onChange = jest.fn();
    render(
      <TradingViewLayoutSelector
        title="Chart layout"
        panelCount={2}
        icon="columns"
        onChange={onChange}
      />,
    );
    const select = screen.getByRole<HTMLSelectElement>('combobox', {
      name: 'Chart layout',
    });
    expect(select.value).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: 'Chart layout' }));
    expect(mockSelectTriggerPress).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
    expect(select.value).toBe('2');

    fireEvent.change(select, { target: { value: '4' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
