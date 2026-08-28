/** @jest-environment jsdom */

import type { ReactElement, ReactNode } from 'react';

import { render } from '@testing-library/react';

import { TradingViewNativeIntervalSelector } from './NativeIntervalSelector';

const mockSegmentControl = jest.fn<null, [unknown]>(() => null);
const mockUseNativeIntervalSelector = jest.fn((_: unknown) => ({
  activeInterval: '60',
  closeIntervalsDialog: jest.fn(),
  closeIntervalsPopover: jest.fn(),
  defaultPreferredIntervalValues: ['60'],
  dialogOptions: [],
  handleIntervalsDialogClose: jest.fn(),
  handlePreferredValuesChange: jest.fn(),
  isIntervalsPopoverOpen: false,
  isMoreTriggerActive: true,
  moreTriggerLabel: 'More',
  options: [
    { label: '1h', value: '60' },
    { label: '4h', value: '240' },
  ],
  preferredIntervalValues: ['60'],
  segmentOptions: [{ label: '1h', value: '60' }],
  setIntervalsDialogInstance: jest.fn(),
  setIsIntervalsPopoverOpen: jest.fn(),
  shouldRender: true,
  visibleSegmentValueSet: new Set(['60']),
}));

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
    h,
    justifyContent,
    px,
    w,
  }: {
    bg?: string;
    children?: ReactNode;
    flex?: number;
    h?: number;
    justifyContent?: string;
    px?: string;
    w?: string;
  }) => (
    <div
      data-bg={bg}
      data-flex={flex}
      data-height={h}
      data-justify-content={justifyContent}
      data-px={px}
      data-width={w}
    >
      {children}
    </div>
  ),
}));

jest.mock('./hooks/useNativeIntervalSelector', () => ({
  useNativeIntervalSelector: (params: unknown) =>
    mockUseNativeIntervalSelector(params),
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
        maxPreferredIntervalCount: 4,
      }),
    );
    expect(getByText('More').parentElement?.getAttribute('data-bg')).toBe(
      '$transparent',
    );
    expect(getByText('More').getAttribute('data-color')).toBe('$text');
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
    expect(getByText('More').parentElement?.getAttribute('data-bg')).toBe(
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
      expect.objectContaining({ maxPreferredIntervalCount: null }),
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
        flex: 1,
        h: 26,
        p: '$0',
        segmentControlItemStyleProps: expect.objectContaining({
          flex: 1,
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
        maxPreferredIntervalCount: 6,
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
    expect(segmentControlProps.options[0].label.props.fontWeight).toBe('600');
    expect(view.container.firstElementChild?.getAttribute('data-width')).toBe(
      '100%',
    );
    const { getByText } = view;
    expect(getByText('More').getAttribute('data-size')).toBe('$bodySmMedium');
    expect(getByText('More').getAttribute('data-font-weight')).toBe('600');
    expect(getByText('More').parentElement?.getAttribute('data-height')).toBe(
      '26',
    );
    expect(getByText('More').parentElement?.getAttribute('data-flex')).toBe(
      '1',
    );
    expect(getByText('More').parentElement?.getAttribute('data-px')).toBe('$0');
    expect(
      getByText('More').parentElement?.getAttribute('data-justify-content'),
    ).toBe('center');
  });
});
