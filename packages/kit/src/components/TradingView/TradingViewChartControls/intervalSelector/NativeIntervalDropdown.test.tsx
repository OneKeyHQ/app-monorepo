/** @jest-environment jsdom */

import type { ReactElement, ReactNode } from 'react';

import { act, render, screen } from '@testing-library/react';

import type {
  ISelectItem,
  ISelectRenderTriggerProps,
} from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { TradingViewNativeIntervalDropdown } from './NativeIntervalDropdown';

interface IMockSelectProps {
  title: string;
  items: ISelectItem[];
  value?: string;
  onChange?: (value: string) => void;
  placement?: string;
  renderTrigger: (props: ISelectRenderTriggerProps) => ReactElement;
}

const mockSelect = jest.fn<void, [IMockSelectProps]>();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: { number?: number }) =>
      values?.number === undefined ? id : `${values.number} ${id}`,
  }),
}));

jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
  },
}));

jest.mock('@onekeyhq/components', () => ({
  Icon: () => null,
  Select: (props: IMockSelectProps) => {
    mockSelect(props);
    return props.renderTrigger({ value: props.value });
  },
  SizableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  XStack: ({ children, testID }: { children?: ReactNode; testID?: string }) => (
    <span data-testid={testID}>{children}</span>
  ),
}));

const intervals = [
  { label: '1m', value: '1' },
  { label: '15m', value: '15' },
  { label: '1H', value: '60' },
  { label: '4H', value: '240' },
  { label: '1D', value: '1D' },
];

function renderDropdown(activeInterval: string, onIntervalChange = jest.fn()) {
  const view = render(
    <TradingViewNativeIntervalDropdown
      intervalConfig={{ activeInterval, intervals }}
      onIntervalChange={onIntervalChange}
    />,
  );
  return { ...view, onIntervalChange };
}

function getLabel() {
  return screen.getByTestId('trading-view-native-interval-dropdown')
    .textContent;
}

function getSelectProps() {
  const props = mockSelect.mock.calls.at(-1)?.[0];
  if (!props) throw new OneKeyLocalError('The select never rendered');
  return props;
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('names the chart interval and lists every interval in a select', () => {
  renderDropdown('60');

  expect(getLabel()).toBe(`1 ${ETranslations.market_number_hour_abbr}`);
  expect(getSelectProps()).toMatchObject({
    title: ETranslations.market_intervals,
    value: '60',
    placement: 'bottom-start',
    items: [
      { label: `1 ${ETranslations.market_number_minute_abbr}`, value: '1' },
      { label: `15 ${ETranslations.market_number_minute_abbr}`, value: '15' },
      { label: `1 ${ETranslations.market_number_hour_abbr}`, value: '60' },
      { label: `4 ${ETranslations.market_number_hour_abbr}`, value: '240' },
      { label: `1 ${ETranslations.market_number_day_abbr}`, value: '1D' },
    ],
  });
});

it('hands a picked interval to the chart', () => {
  const { onIntervalChange } = renderDropdown('60');

  act(() => {
    getSelectProps().onChange?.('1D');
  });

  expect(onIntervalChange).toHaveBeenCalledWith('1D');
});

it('keeps an interval the chart cannot load in the list, disabled', () => {
  render(
    <TradingViewNativeIntervalDropdown
      intervalConfig={{
        activeInterval: '60',
        intervals: [...intervals, { label: '1W', value: '1W', disabled: true }],
      }}
      onIntervalChange={jest.fn()}
    />,
  );

  expect(
    getSelectProps().items.map(({ value, disabled }) => ({ value, disabled })),
  ).toEqual([
    { value: '1', disabled: false },
    { value: '15', disabled: false },
    { value: '60', disabled: false },
    { value: '240', disabled: false },
    { value: '1D', disabled: false },
    { value: '1W', disabled: true },
  ]);
});

it('follows the chart to another interval', () => {
  const { rerender } = renderDropdown('60');

  rerender(
    <TradingViewNativeIntervalDropdown
      intervalConfig={{ activeInterval: '1D', intervals }}
      onIntervalChange={jest.fn()}
    />,
  );

  expect(getLabel()).toBe(`1 ${ETranslations.market_number_day_abbr}`);
  expect(getSelectProps().value).toBe('1D');
});

it('shows nothing for a chart with a single interval', () => {
  render(
    <TradingViewNativeIntervalDropdown
      intervalConfig={{ activeInterval: '60', intervals: [intervals[2]] }}
      onIntervalChange={jest.fn()}
    />,
  );

  expect(screen.queryByTestId('trading-view-native-interval-dropdown')).toBe(
    null,
  );
  expect(mockSelect).not.toHaveBeenCalled();
});
