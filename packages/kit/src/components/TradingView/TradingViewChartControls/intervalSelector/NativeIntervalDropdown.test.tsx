/** @jest-environment jsdom */

import type { ComponentProps, ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { TradingViewNativeIntervalDropdown } from './NativeIntervalDropdown';

import type { IntervalsDialogContent } from './NativeIntervalsDialogContent';

type IContentProps = ComponentProps<typeof IntervalsDialogContent>;

const mockContent = jest.fn<ReactNode, [IContentProps]>(() => (
  <div data-testid="intervals-content" />
));

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
  Popover: ({
    open,
    onOpenChange,
    renderTrigger,
    renderContent,
  }: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    renderTrigger?: ReactNode;
    renderContent?: ReactNode;
  }) => (
    <>
      <button
        type="button"
        aria-label="Intervals"
        data-testid="popover-trigger"
        onClick={() => onOpenChange?.(!open)}
      >
        {renderTrigger}
      </button>
      {open ? renderContent : null}
    </>
  ),
  SizableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  XStack: ({ children, testID }: { children?: ReactNode; testID?: string }) => (
    <span data-testid={testID}>{children}</span>
  ),
}));

jest.mock('./NativeIntervalsDialogContent', () => ({
  IntervalsDialogContent: (props: IContentProps) => mockContent(props),
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

function getContentProps() {
  const props = mockContent.mock.calls.at(-1)?.[0];
  if (!props) throw new OneKeyLocalError('The intervals popover never opened');
  return props;
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('names the chart interval and opens every interval from it', () => {
  renderDropdown('60');
  expect(getLabel()).toBe(`1 ${ETranslations.market_number_hour_abbr}`);
  expect(screen.queryByTestId('intervals-content')).toBeNull();

  fireEvent.click(screen.getByTestId('popover-trigger'));

  expect(screen.getByTestId('intervals-content')).toBeTruthy();
  expect(getContentProps()).toMatchObject({
    mode: 'popover',
    activeInterval: '60',
    options: intervals,
    // As the controls row's popover: every preferred interval, none hidden.
    maxPreferredIntervalCount: null,
  });
});

it('hands a picked interval to the chart and closes', () => {
  const { onIntervalChange } = renderDropdown('60');
  fireEvent.click(screen.getByTestId('popover-trigger'));

  act(() => {
    const content = getContentProps();
    content.onIntervalChange('1D');
    content.onClose();
  });

  expect(onIntervalChange).toHaveBeenCalledWith('1D');
  expect(screen.queryByTestId('intervals-content')).toBeNull();
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
});
