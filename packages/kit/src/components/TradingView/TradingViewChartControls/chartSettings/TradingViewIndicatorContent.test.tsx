/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { TradingViewIndicatorSettingsDialog } from './TradingViewIndicatorContent';
import { createTradingViewIndicatorSettingsValue } from './TradingViewSettingsMockState';

type IMockLayoutProps = {
  children?: ReactNode;
  flex?: number;
  flexShrink?: number;
  h?: number;
  maxHeight?: number | string;
  minHeight?: number;
  testID?: string;
};

const mockScrollView = jest.fn(
  ({ children }: IMockLayoutProps) => children ?? null,
);
const mockXStack = jest.fn(
  ({ children }: IMockLayoutProps) => children ?? null,
);
const mockYStack = jest.fn(
  ({ children }: IMockLayoutProps) => children ?? null,
);

jest.mock('@onekeyhq/components', () => ({
  Icon: () => null,
  ScrollView: (props: IMockLayoutProps) => mockScrollView(props),
  SizableText: ({ children }: IMockLayoutProps) => children ?? null,
  Stack: ({ children }: IMockLayoutProps) => children ?? null,
  XStack: (props: IMockLayoutProps) => mockXStack(props),
  YStack: (props: IMockLayoutProps) => mockYStack(props),
  useSafeAreaInsets: () => ({ bottom: 21, left: 0, right: 0, top: 0 }),
}));

jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ height: 390, width: 844 }),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('./TradingViewIndicatorFields', () => ({
  TradingViewIndicatorLineRow: () => null,
  TradingViewIndicatorOpacitySlider: () => null,
  TradingViewIndicatorParameterRow: () => null,
  groupTradingViewIndicatorParameters: () => [],
}));

jest.mock('./TradingViewIndicatorNavigation', () => ({
  TradingViewIndicatorScopeTabs: () => null,
  TradingViewIndicatorSidebar: () => null,
}));

function getLayoutProps(
  mockComponent: jest.Mock,
  testID: string,
): IMockLayoutProps | undefined {
  return mockComponent.mock.calls
    .map(([props]) => props as IMockLayoutProps)
    .find((props) => props.testID === testID);
}

describe('TradingView indicator settings layout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lets the focused body shrink and scroll within a short viewport', () => {
    const value = createTradingViewIndicatorSettingsValue();
    const selectedIndicator = value.indicators[0];

    render(
      <TradingViewIndicatorSettingsDialog
        displayMode="focused"
        value={value}
        maxActiveSubIndicatorCount={null}
        selectedIndicatorScope={selectedIndicator.scope}
        selectedIndicatorId={selectedIndicator.id}
        visibleIndicators={value.indicators}
        selectedIndicator={selectedIndicator}
        onScopeChange={jest.fn()}
        onSelectIndicator={jest.fn()}
        onToggleIndicator={jest.fn()}
        onToggleLine={jest.fn()}
        onLinePeriodChange={jest.fn()}
        onLineStyleChange={jest.fn()}
        onLineSecondaryStyleChange={jest.fn()}
        onLineColorChange={jest.fn()}
        onOpacityChange={jest.fn()}
        onOpacityColorChange={jest.fn()}
        onParameterChange={jest.fn()}
        onReset={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    expect(
      getLayoutProps(mockYStack, 'trading-view-indicator-settings-dialog'),
    ).toEqual(
      expect.objectContaining({
        h: 353,
        maxHeight: 353,
      }),
    );
    expect(
      getLayoutProps(mockXStack, 'trading-view-indicator-settings-body'),
    ).toEqual(
      expect.objectContaining({
        flex: 1,
        h: undefined,
        minHeight: 0,
      }),
    );
    expect(
      getLayoutProps(mockScrollView, 'trading-view-indicator-settings-content'),
    ).toEqual(
      expect.objectContaining({
        flex: 1,
        h: undefined,
        minHeight: 0,
      }),
    );

    const fixedRows = mockXStack.mock.calls
      .map(([props]) => props as IMockLayoutProps)
      .filter((props) => props.h === 49 || props.h === 62);
    expect(fixedRows).toHaveLength(2);
    expect(fixedRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ flexShrink: 0, h: 49 }),
        expect.objectContaining({ flexShrink: 0, h: 62 }),
      ]),
    );
  });
});
