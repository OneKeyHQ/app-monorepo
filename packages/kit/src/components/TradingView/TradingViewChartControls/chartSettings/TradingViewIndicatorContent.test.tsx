/** @jest-environment jsdom */

import type { ComponentProps, ReactNode } from 'react';

import { render } from '@testing-library/react';

import type { DialogContainer } from '@onekeyhq/components';

import { TradingViewIndicatorSettingsDialog } from './TradingViewIndicatorContent';
import { createTradingViewIndicatorSettingsValue } from './TradingViewSettingsMockState';

type IMockLayoutProps = {
  children?: ReactNode;
  flex?: number;
  flexShrink?: number;
  h?: number | string;
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
const mockStack = jest.fn(({ children }: IMockLayoutProps) => children ?? null);
const mockDialogContainer = jest.fn(
  ({
    renderContent,
    leadingContent,
  }: ComponentProps<typeof DialogContainer>) => (
    <>
      {renderContent}
      {leadingContent}
    </>
  ),
);
const mockDialogFooter = jest.fn(
  ({ leadingContent }: ComponentProps<typeof DialogContainer>) =>
    leadingContent ?? null,
);
let mockWindowHeight = 390;

jest.mock('@onekeyhq/components', () => ({
  Button: (props: IMockLayoutProps) => mockButton(props),
  Divider: () => null,
  DialogContainer: (props: ComponentProps<typeof DialogContainer>) =>
    mockDialogContainer(props),
  Footer: (props: ComponentProps<typeof DialogContainer>) =>
    mockDialogFooter(props),
  IconButton: () => null,
  ScrollView: (props: IMockLayoutProps) => mockScrollView(props),
  SizableText: ({ children }: IMockLayoutProps) => children ?? null,
  Stack: (props: IMockLayoutProps) => mockStack(props),
  XStack: (props: IMockLayoutProps) => mockXStack(props),
  YStack: (props: IMockLayoutProps) => mockYStack(props),
  useSafeAreaInsets: () => ({ bottom: 21, left: 0, right: 0, top: 0 }),
  useMedia: () => ({ md: false }),
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
  const matchingProps = mockComponent.mock.calls
    .map(([props]) => props as IMockLayoutProps)
    .find((props) => props.testID === testID);
  if (!matchingProps) {
    return undefined;
  }
  const { children: _children, ...layoutProps } = matchingProps;
  return layoutProps;
}

function renderDialog(
  displayMode: 'focused' | 'full',
  { mobileLayout = false }: { mobileLayout?: boolean } = {},
) {
  const value = createTradingViewIndicatorSettingsValue();
  const selectedIndicator = value.indicators[0];

  return render(
    <TradingViewIndicatorSettingsDialog
      displayMode={displayMode}
      mobileLayout={mobileLayout}
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

  it('lets the body shrink and scroll within a short viewport', () => {
    renderDialog('full');

    expect(
      getLayoutProps(
        mockYStack,
        'trading-view-indicator-settings-content-container',
      ),
    ).toEqual(expect.objectContaining({ height: 283, minHeight: 0 }));
    expect(
      getLayoutProps(mockXStack, 'trading-view-indicator-settings-body'),
    ).toEqual(expect.objectContaining({ flex: 1, minHeight: 0 }));
    expect(
      getLayoutProps(mockScrollView, 'trading-view-indicator-settings-content'),
    ).toEqual(expect.objectContaining({ flex: 1, minHeight: 0 }));
  });

  it('uses the common dialog container at desktop size', () => {
    mockWindowHeight = 800;
    renderDialog('full');

    expect(
      getLayoutProps(
        mockYStack,
        'trading-view-indicator-settings-content-container',
      ),
    ).toEqual(expect.objectContaining({ height: 477 }));
    expect(mockDialogContainer.mock.calls[0][0].floatingPanelProps).toEqual({
      width: '$160',
      maxWidth: '$160',
    });
  });

  it('keeps reset and confirm aligned to the right without cancel', () => {
    renderDialog('full');

    const props = mockDialogFooter.mock.calls[0][0];
    expect(mockDialogContainer.mock.calls[0][0].showFooter).toBe(false);
    expect(props.footerProps).toEqual(
      expect.objectContaining({ justifyContent: 'flex-end' }),
    );
    expect(props.showCancelButton).toBe(false);
    expect(props.confirmButtonProps).toEqual(
      expect.objectContaining({
        testID: 'trading-view-indicator-settings-mock-confirm',
        flexGrow: 0,
        flexBasis: 'auto',
      }),
    );
    expect(
      mockButton.mock.calls.map(([buttonProps]) => buttonProps.testID),
    ).toEqual(['trading-view-indicator-settings-mock-reset']);
  });

  it('renders the mobile body and footer for the settings page', () => {
    renderDialog('focused', { mobileLayout: true });

    expect(
      getLayoutProps(mockYStack, 'trading-view-mobile-indicator-settings'),
    ).toEqual(expect.objectContaining({ h: 193, maxHeight: 193 }));
    expect(
      getLayoutProps(mockStack, 'trading-view-mobile-indicator-settings-body'),
    ).toEqual(expect.objectContaining({ flex: 1, minHeight: 0 }));
    expect(
      getLayoutProps(
        mockXStack,
        'trading-view-mobile-indicator-settings-footer',
      ),
    ).toEqual(expect.objectContaining({ flexShrink: 0 }));
  });
});
