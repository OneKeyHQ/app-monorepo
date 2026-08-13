/** @jest-environment jsdom */

import type { ReactElement, ReactNode } from 'react';

import { render } from '@testing-library/react';

import { TradingViewNativeIntervalSelector } from './NativeIntervalSelector';

const mockSegmentControl = jest.fn<null, [unknown]>(() => null);

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
    size,
  }: {
    children?: ReactNode;
    color?: string;
    size?: string;
  }) => (
    <span data-color={color} data-size={size}>
      {children}
    </span>
  ),
  XStack: ({
    bg,
    children,
    h,
  }: {
    bg?: string;
    children?: ReactNode;
    h?: number;
  }) => (
    <div data-bg={bg} data-height={h}>
      {children}
    </div>
  ),
}));

jest.mock('./hooks/useNativeIntervalSelector', () => ({
  useNativeIntervalSelector: () => ({
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
  }),
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

  it('uses smaller text and controls in compact mobile layout', () => {
    const { getByText } = render(
      <TradingViewNativeIntervalSelector
        compactMobileLayout
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        showActiveBackground={false}
        onIntervalChange={jest.fn()}
      />,
    );

    expect(mockSegmentControl).toHaveBeenCalledWith(
      expect.objectContaining({
        h: 26,
        p: '$0',
        segmentControlItemStyleProps: expect.objectContaining({
          h: '100%',
          justifyContent: 'center',
          py: '$0',
        }),
      }),
    );
    const segmentControlProps = mockSegmentControl.mock.calls[0][0] as {
      options: { label: ReactElement<{ size?: string }> }[];
    };
    expect(segmentControlProps.options[0].label.props.size).toBe(
      '$bodySmMedium',
    );
    expect(getByText('More').getAttribute('data-size')).toBe('$bodySmMedium');
    expect(getByText('More').parentElement?.getAttribute('data-height')).toBe(
      '26',
    );
  });
});
