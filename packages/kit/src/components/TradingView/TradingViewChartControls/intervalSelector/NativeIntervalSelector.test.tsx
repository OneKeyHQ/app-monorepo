/** @jest-environment jsdom */

import type { ReactElement, ReactNode } from 'react';

import { render } from '@testing-library/react';

import { TradingViewNativeIntervalSelector } from './NativeIntervalSelector';

const mockIntervalOptions = [
  { label: '1m', value: '1' },
  { label: '5m', value: '5' },
  { label: '15m', value: '15' },
  { label: '30m', value: '30' },
  { label: '1h', value: '60' },
  { label: '4h', value: '240' },
  { label: '1d', value: '1D' },
];
const mockSegmentControl = jest.fn<null, [unknown]>(() => null);
const mockUseNativeIntervalSelector = jest.fn(
  ({
    visiblePreferredIntervalCount,
  }: {
    visiblePreferredIntervalCount: number | null;
  }) => {
    const preferredOptions =
      visiblePreferredIntervalCount === null
        ? mockIntervalOptions
        : mockIntervalOptions.slice(0, visiblePreferredIntervalCount);
    const preferredIntervalValues = preferredOptions.map(
      (option) => option.value,
    );
    const isMoreTriggerActive = !preferredIntervalValues.includes('60');
    return {
      activeInterval: '60',
      closeIntervalsDialog: jest.fn(),
      closeIntervalsPopover: jest.fn(),
      defaultPreferredIntervalValues: preferredIntervalValues,
      dialogOptions: mockIntervalOptions,
      handleIntervalsDialogClose: jest.fn(),
      handlePreferredValuesChange: jest.fn(),
      isIntervalsPopoverOpen: false,
      isMoreTriggerActive,
      moreTriggerLabel: isMoreTriggerActive ? '1h' : 'More',
      options: mockIntervalOptions,
      preferredIntervalValues,
      segmentOptions: preferredOptions,
      setIntervalsDialogInstance: jest.fn(),
      setIsIntervalsPopoverOpen: jest.fn(),
      shouldRender: true,
      visibleSegmentValueSet: new Set(preferredIntervalValues),
    };
  },
);

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: jest.fn() },
  Icon: ({ color }: { color?: string }) => <span data-color={color} />,
  Popover: ({ renderTrigger }: { renderTrigger?: ReactNode }) => renderTrigger,
  SegmentControl: (props: unknown) => mockSegmentControl(props),
  SizableText: ({
    children,
    color,
    fontWeight,
    size,
  }: {
    children?: ReactNode;
    color?: string;
    fontWeight?: string;
    size?: string;
  }) => (
    <span data-color={color} data-font-weight={fontWeight} data-size={size}>
      {children}
    </span>
  ),
  XStack: ({
    bg,
    children,
    flex,
    flexBasis,
    flexShrink,
    h,
    justifyContent,
    minWidth,
    px,
    w,
  }: {
    bg?: string;
    children?: ReactNode;
    flex?: number;
    flexBasis?: number;
    flexShrink?: number;
    h?: number;
    justifyContent?: string;
    minWidth?: number;
    px?: string;
    w?: string;
  }) => (
    <div
      data-bg={bg}
      data-flex={flex}
      data-flex-basis={flexBasis}
      data-flex-shrink={flexShrink}
      data-height={h}
      data-justify-content={justifyContent}
      data-min-width={minWidth}
      data-px={px}
      data-width={w}
    >
      {children}
    </div>
  ),
}));

jest.mock('./hooks/useNativeIntervalSelector', () => ({
  useNativeIntervalSelector: (params: {
    visiblePreferredIntervalCount: number | null;
  }) => mockUseNativeIntervalSelector(params),
}));

jest.mock('./NativeIntervalsDialogContent', () => ({
  IntervalsDialogContent: () => null,
}));

describe('TradingViewNativeIntervalSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses text-only active states in mobile layout', () => {
    const { getByText } = render(
      <TradingViewNativeIntervalSelector
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        showActiveBackground={false}
        onIntervalChange={jest.fn()}
      />,
    );

    expect(mockSegmentControl).toHaveBeenCalledWith(
      expect.objectContaining({
        activeBackgroundColor: '$transparent',
        activeTextColor: '$text',
        inactiveTextColor: '$textSubdued',
      }),
    );
    expect(mockUseNativeIntervalSelector).toHaveBeenLastCalledWith(
      expect.objectContaining({
        visiblePreferredIntervalCount: 4,
      }),
    );
    expect(getByText('1h').parentElement?.getAttribute('data-bg')).toBe(
      '$transparent',
    );
    expect(getByText('1h').getAttribute('data-color')).toBe('$text');
  });

  it('keeps active backgrounds available for desktop layout', () => {
    const { getByText } = render(
      <TradingViewNativeIntervalSelector
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        showActiveBackground
        onIntervalChange={jest.fn()}
      />,
    );

    expect(mockSegmentControl).toHaveBeenCalledWith(
      expect.objectContaining({
        activeBackgroundColor: '$bgStrong',
      }),
    );
    expect(getByText('1h').parentElement?.getAttribute('data-bg')).toBe(
      '$bgStrong',
    );
  });

  it('keeps popover interval preferences unlimited', () => {
    render(
      <TradingViewNativeIntervalSelector
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        intervalControlMode="popover"
        onIntervalChange={jest.fn()}
      />,
    );

    expect(mockUseNativeIntervalSelector).toHaveBeenLastCalledWith(
      expect.objectContaining({ visiblePreferredIntervalCount: null }),
    );
  });

  it('keeps compact intervals compressible beside sibling controls', () => {
    const view = render(
      <TradingViewNativeIntervalSelector
        compactMobileLayout
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        onIntervalChange={jest.fn()}
      />,
    );

    expect(mockSegmentControl).toHaveBeenLastCalledWith(
      expect.objectContaining({
        flex: undefined,
        flexShrink: 1,
        segmentControlItemStyleProps: expect.objectContaining({
          flex: undefined,
          minWidth: 0,
          px: '$1',
        }),
      }),
    );
    expect(mockUseNativeIntervalSelector).toHaveBeenLastCalledWith(
      expect.objectContaining({
        visiblePreferredIntervalCount: 6,
      }),
    );
    expect(view.container.firstElementChild?.getAttribute('data-width')).toBe(
      null,
    );
    expect(
      view.container.firstElementChild?.getAttribute('data-flex-shrink'),
    ).toBe('1');
    expect(view.getByText('More').parentElement?.getAttribute('data-px')).toBe(
      '$1',
    );
  });

  it('uses smaller text and controls in compact mobile layout', () => {
    const view = render(
      <TradingViewNativeIntervalSelector
        compactMobileLayout
        fullWidth
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        showActiveBackground={false}
        onIntervalChange={jest.fn()}
      />,
    );

    expect(mockSegmentControl).toHaveBeenCalledWith(
      expect.objectContaining({
        flex: 6,
        flexBasis: 0,
        h: 26,
        minWidth: 0,
        p: '$0',
        segmentControlItemStyleProps: expect.objectContaining({
          flex: 1,
          flexBasis: 0,
          h: '100%',
          justifyContent: 'center',
          minWidth: 0,
          px: '$0',
          py: '$0',
        }),
      }),
    );
    expect(mockUseNativeIntervalSelector).toHaveBeenLastCalledWith(
      expect.objectContaining({
        visiblePreferredIntervalCount: 6,
      }),
    );
    const segmentControlProps = mockSegmentControl.mock.calls[0][0] as {
      options: {
        label: ReactElement<{ fontWeight?: string; size?: string }>;
      }[];
    };
    expect(segmentControlProps.options[0].label.props.size).toBe(
      '$bodySmMedium',
    );
    expect(segmentControlProps.options[4].label.props.fontWeight).toBe('600');
    expect(view.container.firstElementChild?.getAttribute('data-width')).toBe(
      '100%',
    );
    const { getByText } = view;
    expect(getByText('More').getAttribute('data-size')).toBe('$bodySmMedium');
    expect(getByText('More').getAttribute('data-font-weight')).toBeNull();
    expect(getByText('More').parentElement?.getAttribute('data-height')).toBe(
      '26',
    );
    expect(getByText('More').parentElement?.getAttribute('data-flex')).toBe(
      '1.2',
    );
    expect(
      getByText('More').parentElement?.getAttribute('data-flex-basis'),
    ).toBe('0');
    expect(
      getByText('More').parentElement?.getAttribute('data-min-width'),
    ).toBe('0');
    expect(getByText('More').parentElement?.getAttribute('data-px')).toBe('$0');
    expect(
      getByText('More').parentElement?.getAttribute('data-justify-content'),
    ).toBe('center');
  });
});
