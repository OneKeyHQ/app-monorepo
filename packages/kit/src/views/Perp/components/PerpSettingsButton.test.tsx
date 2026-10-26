/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render } from '@testing-library/react';

import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

import { PerpTestIDs } from '../testIDs';

import { PerpMenu } from './PerpMenu';
import { PerpSettingsButton } from './PerpSettingsButton';

const mockContentSizeHandlers = new Map<
  string,
  (width: number, height: number) => void
>();

jest.mock('@onekeyhq/kit/src/hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));

const mockShowPerpSettingsDialog = jest.fn();
const mockPerpSettingsPopover = jest.fn();
const mockSettingsTourVisited = jest.fn();
const mockShowPortfolio = jest.fn();
let mockIsNative = false;
const mockLayoutTourVisited = jest.fn();
let mockLayoutIsFirstVisit = true;
let mockMedia = { gtMd: false, gtXl: false };
let mockSettingsIsFirstVisit = true;

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockIsNative;
    },
  },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('react-native', () => ({
  ...jest.requireActual<typeof import('react-native')>('react-native'),
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));

jest.mock('@onekeyhq/components', () => {
  const Primitive = ({
    children,
    testID,
    onPress,
    accessibilityRole,
    accessibilityState,
    onContentSizeChange,
    height,
    scrollEnabled,
    'aria-hidden': ariaHidden,
  }: {
    children?: ReactNode;
    testID?: string;
    onPress?: () => void;
    accessibilityRole?: 'button' | 'tab' | 'tablist';
    accessibilityState?: { selected?: boolean };
    onContentSizeChange?: (width: number, height: number) => void;
    height?: number;
    scrollEnabled?: boolean;
    'aria-hidden'?: boolean;
  }) => {
    if (testID && onContentSizeChange)
      mockContentSizeHandlers.set(testID, onContentSizeChange);
    return onPress ? (
      <button
        type="button"
        data-testid={testID}
        onClick={onPress}
        role={accessibilityRole === 'tab' ? 'tab' : undefined}
        aria-selected={accessibilityState?.selected}
      >
        {children}
      </button>
    ) : (
      <div
        data-testid={testID}
        role={accessibilityRole}
        aria-hidden={ariaHidden}
        data-height={height}
        data-scroll-enabled={scrollEnabled}
      >
        {children}
      </div>
    );
  };
  return {
    DebugRenderTracker: ({ children }: { children?: ReactNode }) => children,
    IconButton: ({
      onPress,
      testID,
      accessibilityLabel,
    }: {
      onPress?: () => void;
      testID?: string;
      accessibilityLabel?: string;
    }) => (
      <button type="button" onClick={onPress} data-testid={testID}>
        {accessibilityLabel ?? 'settings'}
      </button>
    ),
    Stack: Primitive,
    XStack: Primitive,
    YStack: Primitive,
    ScrollView: Primitive,
    SizableText: Primitive,
    Icon: () => null,
    useMedia: () => mockMedia,
  };
});

jest.mock('@onekeyhq/kit/src/components/Spotlight', () => ({
  useSpotlight: (tour: ESpotlightTour) =>
    tour === ESpotlightTour.perpLayoutSettings
      ? {
          isFirstVisit: mockLayoutIsFirstVisit,
          tourVisited: mockLayoutTourVisited,
        }
      : {
          isFirstVisit: mockSettingsIsFirstVisit,
          tourTimes: mockSettingsIsFirstVisit ? 0 : 1,
          tourVisited: mockSettingsTourVisited,
        },
}));

jest.mock('../hooks/useShowGuide', () => ({
  useShowGuide: () => ({ showGuide: jest.fn() }),
}));

jest.mock('../hooks/useShowPortfolio', () => ({
  useShowPortfolio: () => ({ showPortfolio: mockShowPortfolio }),
}));

jest.mock('./PerpSettingsDialog', () => ({
  PerpSettingsPopover: (props: { renderTrigger: ReactNode }) => {
    mockPerpSettingsPopover(props);
    return props.renderTrigger;
  },
  showPerpSettingsDialog: (options: unknown) => {
    mockShowPerpSettingsDialog(options);
  },
}));

describe('PerpSettingsButton', () => {
  beforeEach(() => {
    mockShowPerpSettingsDialog.mockReset();
    mockPerpSettingsPopover.mockReset();
    mockSettingsTourVisited.mockReset();
    mockSettingsIsFirstVisit = true;
    mockIsNative = false;
    mockShowPortfolio.mockReset();
    mockMedia = { gtMd: false, gtXl: false };
  });

  it.each([
    { isNative: true, gtMd: true },
    { isNative: true, gtMd: false },
    { isNative: false, gtMd: false },
  ])(
    'passes the page-owned portfolio action to the dialog for %o',
    ({ isNative, gtMd }) => {
      mockIsNative = isNative;
      mockMedia = { gtMd, gtXl: false };
      const view = render(<PerpSettingsButton />);

      fireEvent.click(view.getByRole('button', { name: 'settings' }));

      expect(mockShowPerpSettingsDialog).toHaveBeenCalledWith(
        expect.objectContaining({ onOpenPortfolio: mockShowPortfolio }),
      );
      expect(mockShowPortfolio).not.toHaveBeenCalled();
      expect(mockPerpSettingsPopover).not.toHaveBeenCalled();
    },
  );

  it('always shows layout settings in the mobile menu', () => {
    const view = render(<PerpSettingsButton />);

    fireEvent.click(view.getByRole('button', { name: 'settings' }));

    expect(mockShowPerpSettingsDialog).toHaveBeenCalledWith(
      expect.objectContaining({ showChartPositionSetting: true }),
    );
    expect(mockSettingsTourVisited).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('perp-mobile-settings-feature-dot')).toBeTruthy();
  });

  it('hides the mobile feature dot after the menu feature is visited', () => {
    mockSettingsIsFirstVisit = false;
    const view = render(<PerpSettingsButton />);

    fireEvent.click(view.getByRole('button', { name: 'settings' }));

    expect(view.queryByTestId('perp-mobile-settings-feature-dot')).toBeNull();
    expect(mockSettingsTourVisited).not.toHaveBeenCalled();
  });

  it('uses a popover and hides layout settings in the medium desktop menu', () => {
    mockMedia = { gtMd: true, gtXl: false };
    const view = render(<PerpSettingsButton />);

    expect(mockPerpSettingsPopover).toHaveBeenCalledWith(
      expect.objectContaining({ showChartPositionSetting: false }),
    );
    expect(mockShowPerpSettingsDialog).not.toHaveBeenCalled();
    expect(view.queryByTestId('perp-mobile-settings-feature-dot')).toBeNull();
    expect(mockSettingsTourVisited).not.toHaveBeenCalled();
  });

  it('keeps an explicitly requested layout setting visible', () => {
    mockMedia = { gtMd: true, gtXl: false };
    render(<PerpSettingsButton showChartPositionSetting />);

    expect(mockPerpSettingsPopover).toHaveBeenCalledWith(
      expect.objectContaining({ showChartPositionSetting: true }),
    );
    expect(mockShowPerpSettingsDialog).not.toHaveBeenCalled();
  });
});

describe('Perps mobile flat menu', () => {
  beforeEach(() => {
    mockLayoutIsFirstVisit = true;
    mockLayoutTourVisited.mockReset();
  });

  it.each([true, false])(
    'preserves the layout spotlight lifecycle when first visit is %s',
    (isFirstVisit) => {
      mockLayoutIsFirstVisit = isFirstVisit;
      const view = render(
        <PerpMenu
          layoutSettings={{
            renderContent: () => <span>Layout settings</span>,
            positionActionsContent: null,
          }}
          onOpenHistory={jest.fn()}
          settingsContent={<span>Preferences</span>}
        />,
      );

      expect(
        Boolean(view.queryByTestId(PerpTestIDs.MobileLayoutSettingsFeatureDot)),
      ).toBe(isFirstVisit);
      fireEvent.click(view.getByTestId('perp-mobile-menu-shortcut-history'));
      expect(mockLayoutTourVisited).not.toHaveBeenCalled();
      fireEvent.click(view.getByTestId('perp-mobile-menu-shortcut-layout'));
      expect(view.getByText('Layout settings')).toBeTruthy();
      expect(mockLayoutTourVisited).toHaveBeenCalledTimes(isFirstVisit ? 1 : 0);

      mockLayoutIsFirstVisit = false;
      fireEvent.click(view.getByTestId('perp-mobile-menu-back'));
      expect(
        view.queryByTestId(PerpTestIDs.MobileLayoutSettingsFeatureDot),
      ).toBeNull();
    },
  );

  it('shows settings directly above campaigns in the desktop popover', () => {
    const view = render(
      <PerpMenu
        isPopover
        onOpenHistory={jest.fn()}
        settingsContent={<span>Trading settings</span>}
        renderActivityCenter={() => <span>Reward banner</span>}
      />,
    );
    expect(view.getByText('Trading settings')).toBeTruthy();
    expect(view.getByText('perps_menu_features__title')).toBeTruthy();
    expect(view.getByText('perps_menu_campaign_center__title')).toBeTruthy();
    expect(view.getByText('Reward banner')).toBeTruthy();
    expect(view.queryByTestId('perp-mobile-menu-shortcut-settings')).toBeNull();
    expect(view.queryByTestId('perp-mobile-menu-shortcut-history')).toBeNull();
    expect(view.queryByTestId('perp-mobile-menu-back')).toBeNull();
    expect(
      view.queryByTestId(PerpTestIDs.MobileLayoutSettingsFeatureDot),
    ).toBeNull();
    expect(mockLayoutTourVisited).not.toHaveBeenCalled();
  });

  it('shows shortcuts and campaigns together and returns from preferences', () => {
    const view = render(
      <PerpMenu
        onOpenHistory={jest.fn()}
        onOpenHelp={jest.fn()}
        settingsContent={<span>Trading settings</span>}
        renderActivityCenter={() => <span>Reward banner</span>}
      />,
    );
    expect(view.queryByRole('tablist')).toBeNull();
    expect(view.getByText('perps_menu_features__title')).toBeTruthy();
    expect(view.getByText('perps_menu_campaign_center__title')).toBeTruthy();
    expect(view.getByText('Reward banner')).toBeTruthy();
    expect(view.getByTestId('perp-mobile-menu-shortcut-help')).toBeTruthy();
    fireEvent.click(view.getByTestId('perp-mobile-menu-shortcut-settings'));
    expect(view.getByText('Trading settings')).toBeTruthy();
    expect(view.queryByText('Reward banner')).toBeNull();
    fireEvent.click(view.getByTestId('perp-mobile-menu-back'));
    expect(view.queryByText('Trading settings')).toBeNull();
    expect(view.getByText('Reward banner')).toBeTruthy();
    expect(view.getByTestId('perp-mobile-menu-shortcut-history')).toBeTruthy();
    expect(view.queryByTestId('perp-mobile-menu-close')).toBeNull();
  });

  it('keeps layout navigation internal and routes history, guide and support', () => {
    const onOpenHistory = jest.fn();
    const onOpenGuide = jest.fn();
    const onOpenHelp = jest.fn();
    const view = render(
      <PerpMenu
        layoutSettings={{
          renderContent: (onOpenPositionActions) => (
            <button type="button" onClick={onOpenPositionActions}>
              Position actions
            </button>
          ),
          positionActionsContent: <span>Position action settings</span>,
        }}
        onOpenHistory={onOpenHistory}
        onOpenGuide={onOpenGuide}
        onOpenHelp={onOpenHelp}
        settingsContent={<span>Trading settings</span>}
      />,
    );
    fireEvent.click(view.getByTestId('perp-mobile-menu-shortcut-layout'));
    expect(view.getByText('Position actions')).toBeTruthy();
    fireEvent.click(view.getByText('Position actions'));
    expect(view.getByText('Position action settings')).toBeTruthy();
    fireEvent.click(view.getByTestId('perp-mobile-menu-back'));
    expect(view.getByText('Position actions')).toBeTruthy();
    fireEvent.click(view.getByTestId('perp-mobile-menu-back'));
    fireEvent.click(view.getByTestId('perp-mobile-menu-shortcut-history'));
    fireEvent.click(view.getByTestId('perp-mobile-menu-shortcut-guide'));
    fireEvent.click(view.getByTestId('perp-mobile-menu-shortcut-help'));
    for (const action of [onOpenHistory, onOpenGuide, onOpenHelp]) {
      expect(action).toHaveBeenCalledTimes(1);
    }
  });

  it('only enables scrolling when the menu content exceeds its height limit', () => {
    const view = render(
      <PerpMenu
        onOpenHistory={jest.fn()}
        onOpenHelp={jest.fn()}
        settingsContent={<span>Settings</span>}
      />,
    );
    const contentId = 'perp-mobile-menu-content';
    act(() => mockContentSizeHandlers.get(contentId)?.(390, 240));
    expect(
      view.getByTestId(contentId).getAttribute('data-scroll-enabled'),
    ).toBe('false');
    act(() => mockContentSizeHandlers.get(contentId)?.(390, 900));
    expect(
      view.getByTestId(contentId).getAttribute('data-scroll-enabled'),
    ).toBe('true');
    act(() => mockContentSizeHandlers.get(contentId)?.(390, 240));
    expect(
      view.getByTestId(contentId).getAttribute('data-scroll-enabled'),
    ).toBe('false');
  });
});
