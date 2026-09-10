/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { TradingViewIndicatorSettingsDialog } from './TradingViewIndicatorContent';
import { createTradingViewIndicatorSettingsValue } from './TradingViewSettingsMockState';

type IMockLayoutProps = {
  children?: ReactNode;
  flex?: number;
  flexShrink?: number;
  height?: number | string;
  maxHeight?: number | string;
  maxWidth?: number | string;
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
const mockButton = jest.fn(
  ({ children }: IMockLayoutProps) => children ?? null,
);
let mockWindowHeight = 390;

jest.mock('@onekeyhq/components', () => ({
  Button: (props: IMockLayoutProps) => mockButton(props),
  IconButton: () => null,
  ScrollView: (props: IMockLayoutProps) => mockScrollView(props),
  SizableText: ({ children }: IMockLayoutProps) => children ?? null,
  XStack: (props: IMockLayoutProps) => mockXStack(props),
  YStack: (props: IMockLayoutProps) => mockYStack(props),
  useSafeAreaInsets: () => ({ bottom: 21, left: 0, right: 0, top: 0 }),
}));

jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ height: mockWindowHeight, width: 844 }),
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

jest.mock('./TradingViewSettingsPrimitives', () => ({
  SettingsGroup: ({ children }: IMockLayoutProps) => children ?? null,
}));

function getLayoutProps(
  mockComponent: jest.Mock,
  testID: string,
): IMockLayoutProps | undefined {
  return mockComponent.mock.calls
    .map(([props]) => props as IMockLayoutProps)
    .find((props) => props.testID === testID);
}

function renderDialog(displayMode: 'focused' | 'full') {
  const value = createTradingViewIndicatorSettingsValue();
  const selectedIndicator = value.indicators[0];

  return render(
    <TradingViewIndicatorSettingsDialog
      displayMode={displayMode}
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
      onClose={jest.fn()}
    />,
  );
}

describe('TradingView indicator settings layout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWindowHeight = 390;
  });

  it('lets the focused body shrink and scroll within a short viewport', () => {
    renderDialog('focused');

    expect(
      getLayoutProps(mockYStack, 'trading-view-indicator-settings-dialog'),
    ).toEqual(
      expect.objectContaining({
        height: 353,
        maxHeight: 353,
        maxWidth: '100%',
      }),
    );
    expect(
      getLayoutProps(mockXStack, 'trading-view-indicator-settings-body'),
    ).toEqual(expect.objectContaining({ flex: 1, minHeight: 0 }));
    expect(
      getLayoutProps(mockScrollView, 'trading-view-indicator-settings-content'),
    ).toEqual(expect.objectContaining({ flex: 1, minHeight: 0 }));
    expect(
      getLayoutProps(mockXStack, 'trading-view-indicator-settings-header'),
    ).toEqual(expect.objectContaining({ flexShrink: 0, minHeight: 64 }));
    expect(
      getLayoutProps(mockXStack, 'trading-view-indicator-settings-footer'),
    ).toEqual(expect.objectContaining({ flexShrink: 0, minHeight: 72 }));
  });

  it('sizes the full dialog like the chart settings dialog', () => {
    mockWindowHeight = 800;
    renderDialog('full');

    expect(
      getLayoutProps(mockYStack, 'trading-view-indicator-settings-dialog'),
    ).toEqual(
      expect.objectContaining({
        height: 600,
        maxHeight: '100%',
        maxWidth: 640,
      }),
    );
  });

  it('renders reset, cancel and confirm in the footer', () => {
    renderDialog('full');

    const buttonTestIDs = mockButton.mock.calls.map(
      ([props]) => (props as IMockLayoutProps).testID,
    );
    expect(buttonTestIDs).toEqual([
      'trading-view-indicator-settings-mock-reset',
      'trading-view-indicator-settings-mock-cancel',
      'trading-view-indicator-settings-mock-confirm',
    ]);
  });
});
