/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, screen } from '@testing-library/react';

import type { IActionListItemProps } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { TradingViewNativeIntervalDropdown } from './NativeIntervalDropdown';

interface IMockActionListProps {
  title: string;
  items: IActionListItemProps[];
  placement?: string;
  renderTrigger: ReactNode;
}

const mockActionList = jest.fn<void, [IMockActionListProps]>();

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
  ActionList: (props: IMockActionListProps) => {
    mockActionList(props);
    return <>{props.renderTrigger}</>;
  },
  Icon: () => null,
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

function getListProps() {
  const props = mockActionList.mock.calls.at(-1)?.[0];
  if (!props) throw new OneKeyLocalError('The list never rendered');
  return props;
}

function getRows() {
  return getListProps().items.map(({ label, testID, disabled, extra }) => ({
    label,
    testID,
    disabled,
    checked: Boolean(extra),
  }));
}

function getRow(value: string) {
  const row = getListProps().items.find(
    (item) => item.testID === `trading-view-native-interval-menu-${value}`,
  );
  if (!row) throw new OneKeyLocalError(`No row for ${value}`);
  return row;
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('names the chart interval and lists every interval, the current one checked', () => {
  renderDropdown('60');

  expect(getLabel()).toBe(`1 ${ETranslations.market_number_hour_abbr}`);
  expect(getListProps()).toMatchObject({
    title: ETranslations.market_intervals,
    placement: 'bottom-start',
  });
  const minute = ETranslations.market_number_minute_abbr;
  const hour = ETranslations.market_number_hour_abbr;
  const day = ETranslations.market_number_day_abbr;
  expect(getRows()).toEqual(
    [
      [`1 ${minute}`, '1', false],
      [`15 ${minute}`, '15', false],
      [`1 ${hour}`, '60', true],
      [`4 ${hour}`, '240', false],
      [`1 ${day}`, '1D', false],
    ].map(([label, value, checked]) => ({
      label,
      testID: `trading-view-native-interval-menu-${String(value)}`,
      disabled: false,
      checked,
    })),
  );
});

it('hands a picked interval to the chart', () => {
  const { onIntervalChange } = renderDropdown('60');

  act(() => {
    void getRow('1D').onPress?.(jest.fn());
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

  expect(getRows().map(({ disabled }) => disabled)).toEqual([
    false,
    false,
    false,
    false,
    false,
    true,
  ]);
});

it('moves the label and the check with the chart, e.g. after a rollback', () => {
  const onIntervalChange = jest.fn();
  const { rerender } = renderDropdown('240', onIntervalChange);

  rerender(
    <TradingViewNativeIntervalDropdown
      intervalConfig={{ activeInterval: '60', intervals }}
      onIntervalChange={onIntervalChange}
    />,
  );

  expect(getLabel()).toBe(`1 ${ETranslations.market_number_hour_abbr}`);
  expect(
    getRows()
      .filter(({ checked }) => checked)
      .map(({ testID }) => testID),
  ).toEqual(['trading-view-native-interval-menu-60']);
  act(() => {
    void getRow('240').onPress?.(jest.fn());
  });
  expect(onIntervalChange).toHaveBeenLastCalledWith('240');
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
  expect(mockActionList).not.toHaveBeenCalled();
});
