/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ComponentType, ReactElement, ReactNode } from 'react';
import { cloneElement } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { atom, getDefaultStore } from 'jotai';

const mockOpenUrlExternal = jest.fn();
const mockOpenUrlInApp = jest.fn();
const mockOpenUrlInDiscovery = jest.fn();
const mockPopoverClose = jest.fn();
const mockHubShown = jest.fn();
const mockHubActionPressed = jest.fn();
const mockPopoverFloatingPanelProps = jest.fn();
const mockPopoverShowHeader = jest.fn();
let mockLocale = 'en-US';
let mockGtMd = true;
let mockIsLoggedIn = true;
let mockDarkTheme = false;
let mockRecallProgress: IPerpsRecallProgress | null = null;
let mockRecallEnded = false;
const mockRecallRefresh = jest.fn();
const mockVisibilityListeners = new Set<(visible: boolean) => void>();
const mockPerpsCustomSettingsAtom = atom<{
  dismissedRecallBanners?: Record<string, boolean | number>;
  showTradeMarks?: boolean;
}>({});
const mockDialogClose = jest.fn(async () => undefined);
const mockDialogShow = jest.fn<
  void,
  [
    {
      title?: string;
      description?: string;
      onConfirmText?: string;
      onCancelText?: string;
      onConfirm?: () => void;
      showFooter?: boolean;
      onClose?: () => void;
      renderContent?: ReactNode;
    },
  ]
>();

jest.mock('../../views/Perp/hooks/usePerpsRecallProgress', () => ({
  usePerpsRecallProgress: () => ({
    progress: mockRecallProgress,
    hasEnded: mockRecallEnded,
    instanceId: 'test-instance',
    refresh: mockRecallRefresh,
  }),
}));
jest.mock('../../views/Perp/hooks/useActiveTradeDisplay', () => ({
  useActiveTradeDisplay: () => ({ displayName: 'ETH', mode: 'perp' }),
}));
jest.mock('../ListItem', () => ({
  ListItem: ({
    testID,
    title,
    onPress,
  }: {
    testID?: string;
    title?: string;
    onPress?: () => void;
  }) => (
    <button type="button" data-testid={testID} onClick={onPress}>
      {title}
    </button>
  ),
}));
jest.mock('../../views/Perp/components/PerpsRecallActivityIcon', () => ({
  PerpsRecallActivityIcon: () => (
    <span data-testid="perps-recall-activity-icon" />
  ),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsCustomSettingsAtom: () => {
    const { useAtom } = jest.requireActual<typeof import('jotai')>('jotai');
    return useAtom(mockPerpsCustomSettingsAtom);
  },
  usePerpsCommonConfigPersistAtom: () => [
    { perpConfigCommon: { activityCards: [] } },
  ],
}));
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'svg',
  Circle: 'circle',
  G: 'g',
  Path: 'path',
}));

function mockGetIntl() {
  const { createIntl } =
    jest.requireActual<typeof import('react-intl')>('react-intl');
  const catalog =
    mockLocale === 'zh-CN'
      ? jest.requireActual<Record<string, string>>(
          '@onekeyhq/shared/src/locale/json/zh_CN.json',
        )
      : jest.requireActual<Record<string, string>>(
          '@onekeyhq/shared/src/locale/json/en_US.json',
        );
  const reusedKeys = new Set([
    'global.back',
    'global.learn_more',
    'rebate.awaiting_payout',
    'referral.perps_trading_volume',
    'referral.total_reward',
  ]);
  const messages = Object.fromEntries(
    Object.entries(catalog).filter(
      ([key]) => key.startsWith('perps_recall_') || reusedKeys.has(key),
    ),
  );
  const intl = createIntl({ locale: mockLocale });
  return {
    ...intl,
    formatMessage: (
      descriptor: { id: ETranslations },
      values?: Record<string, string | number>,
    ) =>
      Object.hasOwn(messages, descriptor.id)
        ? intl.formatMessage(
            { ...descriptor, defaultMessage: messages[descriptor.id] },
            values,
          )
        : descriptor.id,
  };
}

jest.mock('react-intl', () => ({ useIntl: () => mockGetIntl() }));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { runAfterActionListClose } = jest.requireActual<
    typeof import('../../../../components/src/actions/ActionList/runAfterClose')
  >('../../../../components/src/actions/ActionList/runAfterClose');
  const Primitive = ({
    children,
    flexBasis,
    accessibilityLabel,
    testID,
    onPress,
  }: {
    children?: ReactNode;
    flexBasis?: string;
    accessibilityLabel?: string;
    testID?: string;
    onPress?: () => void;
  }) =>
    React.createElement(
      onPress ? 'button' : 'div',
      {
        'data-flex-basis': flexBasis,
        'aria-label': accessibilityLabel,
        'data-testid': testID,
        onClick: onPress,
      },
      children,
    );

  return {
    // The component imports this from the Header subpath, but the module mapper
    // folds that specifier into this same mock, so both live here: a separate
    // jest.mock for the subpath would replace this whole factory instead.
    HeaderIconButton: ({
      onPress,
      testID,
      title,
    }: {
      onPress?: () => void;
      testID?: string;
      title?: string;
    }) =>
      React.createElement(
        'button',
        { 'data-testid': testID, onClick: onPress, type: 'button' },
        title,
      ),
    Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
    Dialog: {
      Header: Primitive,
      Title: Primitive,
      show: (options: Parameters<typeof mockDialogShow>[0]) => {
        mockDialogShow(options);
        return { close: mockDialogClose };
      },
    },
    Button: Primitive,
    LazyTooltip: ({ renderTrigger }: { renderTrigger: ReactNode }) =>
      renderTrigger,
    onVisibilityStateChange: (listener: (visible: boolean) => void) => {
      mockVisibilityListeners.add(listener);
      return () => mockVisibilityListeners.delete(listener);
    },
    Alert: ({
      title,
      renderTitle,
      ...props
    }: {
      title?: string;
      renderTitle?: (props: object) => ReactNode;
      testID?: string;
      onPress?: () => void;
    }) => React.createElement(Primitive, props, title, renderTitle?.({})),
    IconButton: Primitive,
    Progress: Primitive,
    Image: Primitive,
    LottieView: Primitive,
    Popover: ({
      showHeader,
      floatingPanelProps,
      renderTrigger,
      open,
      renderContent,
    }: {
      floatingPanelProps?: unknown;
      showHeader?: boolean;
      renderTrigger?: ReactNode;
      open?: boolean;
      renderContent:
        | ReactElement
        | ComponentType<{
            closePopover: typeof mockPopoverClose;
          }>;
    }) => {
      mockPopoverFloatingPanelProps(floatingPanelProps);
      mockPopoverShowHeader(showHeader);
      const content =
        typeof renderContent === 'function'
          ? React.createElement(renderContent, {
              closePopover: mockPopoverClose,
            })
          : renderContent;
      return React.createElement(
        'div',
        null,
        renderTrigger,
        open === false ? null : content,
      );
    },
    Divider: Primitive,
    SizableText: Primitive,
    Stack: Primitive,
    XStack: Primitive,
    YStack: Primitive,
    useMedia: () => ({ gtMd: mockGtMd }),
    useThemeName: () => (mockDarkTheme ? 'dark' : 'light'),
    useTheme: () => ({
      text: { val: mockDarkTheme ? '#EEEEEE' : '#111111' },
      textInverse: { val: mockDarkTheme ? '#111111' : '#FFFFFF' },
      bg: { val: mockDarkTheme ? '#1B1B1B' : '#FFFFFF' },
      bgStrong: { val: mockDarkTheme ? '#292929' : '#F3F3F3' },
      bgAccent: { val: mockDarkTheme ? '#3EDC2F' : '#22AB15' },
      textCritical: { val: '#E5484D' },
      borderSubdued: { val: mockDarkTheme ? '#333333' : '#DDDDDD' },
    }),
    usePopoverContext: () => ({ closePopover: mockPopoverClose }),
    useDialogInstance: () => ({ close: mockPopoverClose }),
    runAfterActionListClose,
  };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  usePrimePersistAtom: () => [
    { isLoggedIn: mockIsLoggedIn, isLoggedInOnServer: mockIsLoggedIn },
  ],
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    referral: {
      activityHub: {
        activityHubShown: (...args: unknown[]) => {
          mockHubShown(...args);
        },
        activityHubActionPressed: (...args: unknown[]) => {
          mockHubActionPressed(...args);
        },
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
    isWeb: false,
    isWebDappMode: false,
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useReferFriends', () => ({
  useOpenReferralPage: () => jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlInApp: (...args: unknown[]) => {
    mockOpenUrlInApp(...args);
  },
  openUrlExternal: (...args: unknown[]) => {
    mockOpenUrlExternal(...args);
  },
  openUrlInDiscovery: (...args: unknown[]) => {
    mockOpenUrlInDiscovery(...args);
  },
}));

jest.mock('./ActivityHubInvitePanel', () => ({
  ActivityHubInvitePanel: ({
    onOpenReferral,
  }: {
    onOpenReferral: (tab: 'invite' | 'benefits') => void;
  }) => (
    <button
      data-testid="activity-hub-open-perks"
      onClick={() => onOpenReferral('benefits')}
      type="button"
    >
      perks
    </button>
  ),
}));

jest.mock(
  '@onekeyhq/kit/assets/animations/gift-expand-on-dark.json',
  () => ({}),
);
jest.mock(
  '@onekeyhq/kit/assets/animations/gift-expand-on-light.json',
  () => ({}),
);

import { IconButton } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IPerpsRecallProgress } from '@onekeyhq/shared/src/referralCode/recall';

import {
  PerpsActivityCenterContent,
  PerpsActivityCenterAction,
} from '../../views/Perp/components/PerpsActivityCenterAction';
import { PerpsRecallBanner } from '../../views/Perp/components/PerpsRecallBanner';
import {
  PerpsRecallAction,
  PerpsRecallDialogContent,
} from '../../views/Perp/components/PerpsRecallDialog';
import { PerpsRecallProgressCard } from '../../views/Perp/components/PerpsRecallProgressCard';

import { ActivityHubAction } from './ActivityHubAction';
import { ActivityHubContent } from './ActivityHubContent';
import {
  ACTIVITY_HUB_PANEL_WIDTH,
  ACTIVITY_HUB_SHORTCUT_BASIS,
} from './layout';

import type { IActivityHubCampaign } from './types';

const CAMPAIGNS: IActivityHubCampaign[] = [
  {
    id: 'campaign-1',
    title: 'campaign title',
    subtitle: 'campaign subtitle',
    url: 'https://onekey.so',
  },
];

const getCampaignCard = () =>
  screen.getByRole('button', { name: /campaign title/ });

const getShortcutBasis = () =>
  screen.getByTestId('activity-hub-referral').getAttribute('data-flex-basis');

describe('ActivityHubContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocale = 'en-US';
    mockGtMd = true;
    mockIsLoggedIn = true;
    platformEnv.isNative = false;
    platformEnv.isWeb = false;
    platformEnv.isWebDappMode = false;
  });

  it('hides the duplicate invite title until the user signs in', () => {
    mockIsLoggedIn = false;
    const props = {
      source: 'Swap' as const,
      closePopover: jest.fn(),
      onOpenReferral: jest.fn(),
    };
    const { rerender } = render(<ActivityHubContent {...props} />);
    expect(screen.queryByText(ETranslations.referral_home__title)).toBeNull();
    mockIsLoggedIn = true;
    rerender(<ActivityHubContent {...props} />);
    expect(screen.getByText(ETranslations.referral_home__title)).toBeTruthy();
  });

  it('keeps the activity hub title when signed out with campaigns', () => {
    mockIsLoggedIn = false;
    render(
      <ActivityHubContent
        source="Perps"
        closePopover={jest.fn()}
        onOpenReferral={jest.fn()}
        campaigns={CAMPAIGNS}
      />,
    );
    expect(screen.getByText(ETranslations.perps_activity_hub)).toBeTruthy();
  });

  it('opens the referral page from the native tile after the host closes', async () => {
    platformEnv.isNative = true;
    let resolveClose: (() => void) | undefined;
    const closePopover = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveClose = resolve;
        }),
    );
    const onOpenReferral = jest.fn();

    render(
      <ActivityHubContent
        source="Swap"
        closePopover={closePopover}
        onOpenReferral={onOpenReferral}
      />,
    );

    fireEvent.click(screen.getByTestId('activity-hub-referral'));
    expect(closePopover).toHaveBeenCalledTimes(1);
    expect(onOpenReferral).not.toHaveBeenCalled();

    resolveClose?.();
    await waitFor(() => expect(onOpenReferral).toHaveBeenCalledTimes(1));
    expect(mockHubShown).toHaveBeenCalledWith({
      source: 'Swap',
      layout: 'shortcut',
      campaignCount: 0,
    });
    expect(mockHubActionPressed).toHaveBeenCalledWith({
      source: 'Swap',
      action: 'open_referral',
    });
  });

  it('settles a canceled close without opening the referral page', async () => {
    const { OverlayCloseCancelledError } = jest.requireActual<
      typeof import('../../../../components/src/shared/overlayCloseCancellation')
    >('../../../../components/src/shared/overlayCloseCancellation');
    const closePopover = jest.fn(() =>
      Promise.reject(new OverlayCloseCancelledError('reopened')),
    );
    const onOpenReferral = jest.fn();
    platformEnv.isNative = true;
    render(
      <ActivityHubContent
        source="Swap"
        closePopover={closePopover}
        onOpenReferral={onOpenReferral}
      />,
    );

    fireEvent.click(screen.getByTestId('activity-hub-referral'));
    await waitFor(() => expect(closePopover).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(onOpenReferral).not.toHaveBeenCalled();
  });

  it('shows the invite panel instead of the tile on pointer layouts', async () => {
    let resolveClose: (() => void) | undefined;
    const closePopover = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveClose = resolve;
        }),
    );
    const onOpenReferral = jest.fn();
    render(
      <ActivityHubContent
        source="Earn"
        closePopover={closePopover}
        onOpenReferral={onOpenReferral}
      />,
    );

    expect(screen.queryByTestId('activity-hub-referral')).toBeNull();
    fireEvent.click(screen.getByTestId('activity-hub-open-perks'));
    expect(closePopover).toHaveBeenCalledTimes(1);
    expect(onOpenReferral).not.toHaveBeenCalled();

    resolveClose?.();
    await waitFor(() =>
      expect(onOpenReferral).toHaveBeenCalledWith('benefits'),
    );
    expect(mockHubShown).toHaveBeenCalledWith({
      source: 'Earn',
      layout: 'invite_panel',
      campaignCount: 0,
    });
  });

  it('opens the invite panel dialog from the Perps menu row on pointer layouts', async () => {
    const onOpenReferral = jest.fn();
    const onOpenInvitePanel = jest.fn();
    render(
      <ActivityHubContent
        source="Perps"
        closePopover={() => Promise.resolve()}
        onOpenReferral={onOpenReferral}
        onOpenInvitePanel={onOpenInvitePanel}
        showTitle={false}
        menuLayout
        menuShortcuts={<span data-testid="menu-shortcut">History</span>}
      />,
    );

    // The menu keeps its Referral row instead of the inline panel.
    expect(screen.queryByTestId('activity-hub-open-perks')).toBeNull();
    expect(screen.getByTestId('activity-hub-referral').parentElement).toBe(
      screen.getByTestId('menu-shortcut').parentElement,
    );
    expect(screen.getAllByTestId('activity-hub-referral')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('activity-hub-referral'));

    await waitFor(() => expect(onOpenInvitePanel).toHaveBeenCalledTimes(1));
    expect(onOpenReferral).not.toHaveBeenCalled();
    expect(mockHubActionPressed).toHaveBeenCalledWith({
      source: 'Perps',
      action: 'open_invite_panel',
    });
  });

  it('keeps referral actions and campaigns when the popover places referral inside settings', async () => {
    const onOpenInvitePanel = jest.fn();
    const closePopover = jest.fn(() => Promise.resolve());
    render(
      <ActivityHubContent
        source="Perps"
        closePopover={closePopover}
        onOpenReferral={jest.fn()}
        onOpenInvitePanel={onOpenInvitePanel}
        showTitle={false}
        menuLayout
        menuPopoverLayout
        campaigns={CAMPAIGNS}
        renderMenuReferral={(referral) => (
          <div data-testid="settings-list">
            {referral}
            <span>Trading guide</span>
          </div>
        )}
      />,
    );
    const referral = screen.getByTestId('activity-hub-referral');
    expect(referral.textContent).toBe(ETranslations.referral_title);
    expect(within(referral).queryByTestId('icon-GiftOutline')).toBeNull();
    expect(
      within(referral).getByTestId('icon-ChevronRightOutline'),
    ).toBeTruthy();
    expect(screen.getByTestId('settings-list').firstElementChild).toBe(
      referral,
    );
    expect(referral.nextElementSibling?.textContent).toBe('Trading guide');
    expect(getCampaignCard()).toBeTruthy();
    fireEvent.click(referral);
    await waitFor(() => expect(onOpenInvitePanel).toHaveBeenCalledTimes(1));
    expect(closePopover).toHaveBeenCalledTimes(1);
  });

  it.each([
    { menuPopoverLayout: false, isWeb: false },
    { menuPopoverLayout: true, isWeb: false },
    { menuPopoverLayout: false, isWeb: true },
    { menuPopoverLayout: true, isWeb: true },
  ])(
    'only shows the menu campaign heading outside web when campaigns exist (popover: $menuPopoverLayout, web: $isWeb)',
    ({ menuPopoverLayout, isWeb }) => {
      platformEnv.isWeb = isWeb;
      const props = {
        source: 'Perps' as const,
        closePopover: jest.fn(),
        onOpenReferral: jest.fn(),
        showTitle: false,
        menuLayout: true,
        menuPopoverLayout,
      };
      const view = render(<ActivityHubContent {...props} />);
      const heading = ETranslations.perps_menu_campaign_center__title;
      expect(screen.queryByText(heading)).toBeNull();

      view.rerender(<ActivityHubContent {...props} campaigns={CAMPAIGNS} />);
      if (isWeb) {
        expect(screen.queryByText(heading)).toBeNull();
      } else {
        expect(screen.getByText(heading)).toBeTruthy();
      }
      expect(getCampaignCard()).toBeTruthy();
      expect(screen.getAllByTestId('activity-hub-referral')).toHaveLength(1);

      view.rerender(<ActivityHubContent {...props} campaigns={[]} />);
      expect(screen.queryByText(heading)).toBeNull();
      expect(screen.getByTestId('activity-hub-referral')).toBeTruthy();
    },
  );

  it('opens the referral page from the native gift when there are no campaigns', () => {
    platformEnv.isNative = true;
    const onOpenReferral = jest.fn();
    render(<ActivityHubAction source="Earn" onOpenReferral={onOpenReferral} />);

    const gift = screen.getByTestId('header-gift-action');
    expect(gift.textContent).toBe(ETranslations.sidebar_refer_a_friend);
    expect(mockPopoverFloatingPanelProps).not.toHaveBeenCalled();

    fireEvent.click(gift);
    expect(onOpenReferral).toHaveBeenCalledTimes(1);
    expect(mockHubActionPressed).toHaveBeenCalledWith({
      source: 'Earn',
      action: 'open_referral',
    });
  });

  it.each([
    {
      host: 'the desktop popover without campaigns',
      isNative: false,
      campaigns: undefined,
      width: ACTIVITY_HUB_PANEL_WIDTH,
    },
    {
      host: 'the desktop popover with campaign cards',
      isNative: false,
      campaigns: CAMPAIGNS,
      width: ACTIVITY_HUB_PANEL_WIDTH,
    },
    {
      // Native popovers always Adapt to a Sheet that no floatingPanelProps
      // width can narrow.
      host: 'the native sheet with campaign cards',
      isNative: true,
      campaigns: CAMPAIGNS,
      width: undefined,
    },
  ])('opens $host', ({ isNative, campaigns, width }) => {
    platformEnv.isNative = isNative;

    render(
      <ActivityHubAction
        source="Perps"
        onOpenReferral={jest.fn()}
        campaigns={campaigns}
      />,
    );

    expect(mockPopoverFloatingPanelProps).toHaveBeenLastCalledWith({ width });
  });

  it('keeps the native tiles four to a row', async () => {
    platformEnv.isNative = true;
    render(
      <ActivityHubAction
        source="Perps"
        onOpenReferral={jest.fn()}
        campaigns={CAMPAIGNS}
      />,
    );

    await waitFor(() =>
      expect(getShortcutBasis()).toBe(ACTIVITY_HUB_SHORTCUT_BASIS),
    );
  });

  it('opens a campaign link without waiting for the close outside native', async () => {
    let resolveClose: (() => void) | undefined;
    const closePopover = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveClose = resolve;
        }),
    );

    render(
      <ActivityHubContent
        source="Perps"
        closePopover={closePopover}
        onOpenReferral={jest.fn()}
        campaigns={CAMPAIGNS}
      />,
    );

    fireEvent.click(getCampaignCard());
    expect(mockHubActionPressed).toHaveBeenCalledWith({
      source: 'Perps',
      action: 'open_campaign',
      campaignId: CAMPAIGNS[0].id,
    });

    // Popup blockers only honour window.open while the tap holds user
    // activation, so the link must not wait for the still-pending close.
    expect(closePopover).toHaveBeenCalledTimes(1);
    expect(mockOpenUrlExternal).toHaveBeenCalledWith(CAMPAIGNS[0].url);

    resolveClose?.();
    await waitFor(() => expect(mockOpenUrlExternal).toHaveBeenCalledTimes(1));
  });

  it('waits for the close before opening a campaign link on native', async () => {
    platformEnv.isNative = true;
    let resolveClose: (() => void) | undefined;
    const closePopover = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveClose = resolve;
        }),
    );

    render(
      <ActivityHubContent
        source="Perps"
        closePopover={closePopover}
        onOpenReferral={jest.fn()}
        campaigns={CAMPAIGNS}
      />,
    );

    fireEvent.click(getCampaignCard());

    expect(closePopover).toHaveBeenCalledTimes(1);
    expect(mockOpenUrlExternal).not.toHaveBeenCalled();

    resolveClose?.();
    await waitFor(() =>
      expect(mockOpenUrlExternal).toHaveBeenCalledWith(CAMPAIGNS[0].url),
    );
  });
});

describe('Perps recall activity integration', () => {
  const progress: IPerpsRecallProgress = {
    title: '再交易 10K USDT，返 150 USDT',
    closable: true,
    reopenAfterMinutes: 30,
    blogUrl: 'https://onekey.so/blog/recall',
    activityId: 'recall-1',
    activityStatus: 'running',
    status: 'running',
    volume: '1000.25',
    totalReward: '150',
    earnedReward: '0',
    topTarget: '4000',
    current: { index: 1, target: '4000', remaining: '2999.75', reward: '150' },
    deadline: '2030-01-01T00:00:00.000Z',
    payoutStatus: 'pending',
    paidAmount: null,
    paidAt: null,
  };
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocale = 'en-US';
    mockRecallProgress = progress;
    mockRecallEnded = false;
    getDefaultStore().set(mockPerpsCustomSettingsAtom, {
      showTradeMarks: true,
    });
    mockGtMd = false;
    mockDarkTheme = false;
    platformEnv.isNative = false;
    platformEnv.isDesktop = false;
    platformEnv.isDev = false;
    platformEnv.isWebDappMode = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([true, false])(
    'opens recall details from the ticket without a notification dot (native: %s)',
    (native) => {
      platformEnv.isNative = native;
      render(<PerpsRecallAction />);
      expect(screen.getByTestId('perps-recall-activity-icon')).toBeTruthy();
      expect(
        screen.queryByTestId('perp-mobile-activity-center-dot'),
      ).toBeNull();
      fireEvent.click(screen.getByTestId('perp-mobile-activity-center'));
      expect(mockDialogShow).toHaveBeenCalledTimes(1);
      expect(mockDialogShow).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Comeback rewards',
          showFooter: false,
        }),
      );
      expect(mockRecallRefresh).toHaveBeenCalledTimes(1);
      render(<>{mockDialogShow.mock.calls[0][0].renderContent}</>);
      expect(screen.getByTestId('perps-recall-progress')).toBeTruthy();
      expect(screen.queryByTestId('activity-hub-detail-entry')).toBeNull();
      expect(screen.queryByTestId('perps-activity-dialog-back')).toBeNull();
      expect(mockPopoverShowHeader).not.toHaveBeenCalled();
    },
  );

  it('hides the ticker ticket when recall progress is unavailable', () => {
    mockRecallProgress = null;
    render(<PerpsRecallAction />);
    expect(screen.queryByTestId('perp-mobile-activity-center')).toBeNull();
    expect(screen.queryByTestId('perp-mobile-activity-center-dot')).toBeNull();
    expect(mockDialogShow).not.toHaveBeenCalled();
  });

  it('updates the banner and activity center together when eligibility changes', () => {
    const renderContent = () => (
      <>
        <PerpsRecallBanner />
        <PerpsActivityCenterContent closePopover={mockPopoverClose} />
      </>
    );
    const view = render(renderContent());
    expect(screen.getByTestId('perps-recall-banner')).toBeTruthy();
    expect(screen.getByTestId('activity-hub-detail-entry')).toBeTruthy();

    mockRecallProgress = null;
    view.rerender(renderContent());
    expect(screen.queryByTestId('perps-recall-banner')).toBeNull();
    expect(screen.queryByTestId('activity-hub-detail-entry')).toBeNull();

    mockRecallProgress = progress;
    view.rerender(renderContent());
    expect(screen.getByTestId('perps-recall-banner')).toBeTruthy();
    expect(screen.getByTestId('activity-hub-detail-entry')).toBeTruthy();
  });

  it.each([
    { native: true, wide: false },
    { native: false, wide: false },
    { native: false, wide: true },
  ])(
    'opens standalone rewards from the banner without hub navigation ($native / $wide)',
    ({ native, wide }) => {
      platformEnv.isNative = native;
      mockGtMd = wide;
      render(<PerpsRecallBanner />);
      fireEvent.click(screen.getByTestId('perps-recall-banner'));
      expect(mockDialogShow).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Comeback rewards',
          showFooter: false,
        }),
      );
      expect(mockRecallRefresh).toHaveBeenCalled();
      expect(mockPopoverShowHeader).not.toHaveBeenCalled();
      const dialog = render(
        <>{mockDialogShow.mock.calls[0][0].renderContent}</>,
      );
      expect(screen.getByTestId('perps-recall-progress')).toBeTruthy();
      expect(screen.queryByTestId('perps-activity-dialog-back')).toBeNull();
      expect(screen.queryByTestId('activity-hub-detail-entry')).toBeNull();
      expect(screen.queryByTestId('activity-hub-referral')).toBeNull();
      expect(screen.getByText('$1,000.25 / $4,000')).toBeTruthy();
      dialog.unmount();
      fireEvent.click(screen.getByTestId('perps-recall-banner'));
      expect(mockDialogShow).toHaveBeenCalledTimes(2);
      render(<>{mockDialogShow.mock.calls[1][0].renderContent}</>);
      expect(screen.getByTestId('perps-recall-progress')).toBeTruthy();
    },
  );

  it.each([true, false])(
    'closes the activity center before opening the reward dialog (native: %s)',
    async (native) => {
      platformEnv.isNative = native;
      let resolveClose: (() => void) | undefined;
      const closePopover = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveClose = resolve;
          }),
      );
      render(<PerpsActivityCenterContent closePopover={closePopover} />);
      fireEvent.click(screen.getByTestId('activity-hub-detail-entry'));
      expect(closePopover).toHaveBeenCalledTimes(1);
      expect(mockDialogShow).not.toHaveBeenCalled();
      resolveClose?.();
      await waitFor(() => expect(mockDialogShow).toHaveBeenCalledTimes(1));
      render(<>{mockDialogShow.mock.calls[0][0].renderContent}</>);
      expect(screen.getByTestId('perps-recall-progress')).toBeTruthy();
    },
  );

  it.each([
    { native: true, wide: true },
    { native: false, wide: false },
  ])(
    'closes the activity center and opens standalone rewards ($native / $wide)',
    async ({ native, wide }) => {
      platformEnv.isNative = native;
      mockGtMd = wide;
      render(
        <PerpsActivityCenterAction
          renderTrigger={
            <IconButton testID="test-hub-trigger" icon="GiftOutline" />
          }
        />,
      );
      fireEvent.click(screen.getByTestId('test-hub-trigger'));
      expect(mockDialogShow).toHaveBeenCalledTimes(1);
      expect(mockPopoverShowHeader).not.toHaveBeenCalled();
      const hub = render(<>{mockDialogShow.mock.calls[0][0].renderContent}</>);
      expect(
        screen.getByTestId(
          native ? 'activity-hub-referral' : 'activity-hub-open-perks',
        ),
      ).toBeTruthy();
      let resolveClose: (() => void) | undefined;
      mockPopoverClose.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveClose = resolve;
          }),
      );
      fireEvent.click(screen.getByTestId('activity-hub-detail-entry'));
      expect(mockPopoverClose).toHaveBeenCalledTimes(1);
      expect(mockDialogShow).toHaveBeenCalledTimes(1);
      hub.unmount();
      resolveClose?.();
      await waitFor(() => expect(mockDialogShow).toHaveBeenCalledTimes(2));
      expect(mockDialogShow.mock.calls[1][0].title).toBe('Comeback rewards');
      render(<>{mockDialogShow.mock.calls[1][0].renderContent}</>);
      expect(screen.getByTestId('perps-recall-progress')).toBeTruthy();
      expect(screen.queryByTestId('perps-activity-dialog-back')).toBeNull();
      expect(screen.queryByTestId('activity-hub-detail-entry')).toBeNull();
    },
  );

  it('opens the mobile menu dialog from controlled state and resets it on close', () => {
    const onOpenChange = jest.fn();
    const view = render(
      <PerpsActivityCenterAction
        open
        onOpenChange={onOpenChange}
        renderTrigger={<span>Open hub</span>}
      />,
    );
    expect(mockDialogShow).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Open hub'));
    expect(mockDialogShow).toHaveBeenCalledTimes(1);
    act(() => mockDialogShow.mock.calls[0][0].onClose?.());
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    view.rerender(
      <PerpsActivityCenterAction
        open={false}
        onOpenChange={onOpenChange}
        renderTrigger={<span>Open hub</span>}
      />,
    );
    view.rerender(
      <PerpsActivityCenterAction
        open
        onOpenChange={onOpenChange}
        renderTrigger={<span>Open hub</span>}
      />,
    );
    expect(mockDialogShow).toHaveBeenCalledTimes(2);
  });

  it('keeps the desktop activity center in a popover', () => {
    mockGtMd = true;
    render(<PerpsActivityCenterAction renderTrigger={<span>Open hub</span>} />);
    expect(mockPopoverShowHeader).toHaveBeenCalled();
    expect(mockDialogShow).not.toHaveBeenCalled();
  });

  it.each([
    { compact: true, native: false, dev: true },
    { compact: true, native: false, dev: false },
    { compact: false, native: true, dev: true },
    { compact: false, native: true, dev: false },
  ])(
    'confirms hiding and restores the banner from the menu (compact: $compact, native: $native, dev: $dev)',
    async ({ compact, native, dev }) => {
      platformEnv.isNative = native;
      platformEnv.isDev = dev;
      mockGtMd = native;
      const renderContent = () => (
        <>
          <PerpsRecallBanner compact={compact} />
          <PerpsActivityCenterContent
            closePopover={mockPopoverClose}
            menuLayout
            menuPopoverLayout={compact}
            menuFooter={
              dev ? (
                <span data-testid="account-mode">Account Mode</span>
              ) : undefined
            }
          />
        </>
      );
      const view = render(renderContent());
      expect(screen.queryByTestId('perps-recall-restore-banner')).toBeNull();
      fireEvent.click(screen.getByTestId('perps-recall-banner-close'));
      expect(screen.getByTestId('perps-recall-banner')).toBeTruthy();
      expect(mockRecallRefresh).not.toHaveBeenCalled();
      expect(mockDialogShow).toHaveBeenCalledTimes(1);
      expect(mockDialogShow).toHaveBeenCalledWith(
        expect.objectContaining({
          showHeader: false,
          onConfirmText: 'Remind me later',
          showCancelButton: false,
          showExitButton: false,
        }),
      );
      expect(mockDialogShow.mock.calls[0][0].title).toBeUndefined();
      const hint = render(mockDialogShow.mock.calls[0][0].renderContent);
      expect(screen.getByTestId('perps-recall-entry-hint')).toBeTruthy();
      expect(screen.getByText('ETHUSDC')).toBeTruthy();
      expect(
        screen.getByText(
          'View your rewards and trading progress here anytime.',
        ),
      ).toBeTruthy();
      hint.unmount();
      await act(async () => mockDialogShow.mock.calls[0][0].onConfirm?.());
      expect(screen.queryByTestId('perps-recall-banner')).toBeNull();
      expect(screen.getByTestId('activity-hub-detail-entry')).toBeTruthy();
      if (!dev) {
        expect(screen.queryByTestId('perps-recall-restore-banner')).toBeNull();
        view.unmount();
        render(renderContent());
        expect(screen.queryByTestId('perps-recall-restore-banner')).toBeNull();
        expect(screen.getByTestId('activity-hub-detail-entry')).toBeTruthy();
        return;
      }
      expect(screen.getByText('Restore reward banner')).toBeTruthy();
      if (dev) {
        expect(
          screen
            .getByTestId('account-mode')
            .compareDocumentPosition(
              screen.getByTestId('perps-recall-restore-banner'),
            ) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
      expect(getDefaultStore().get(mockPerpsCustomSettingsAtom)).toEqual({
        showTradeMarks: true,
        dismissedRecallBanners: {
          'test-instance:recall-1': expect.any(Number),
        },
      });

      view.unmount();
      render(renderContent());
      expect(screen.queryByTestId('perps-recall-banner')).toBeNull();
      await act(async () => {
        fireEvent.click(screen.getByTestId('perps-recall-restore-banner'));
      });
      expect(screen.getByTestId('perps-recall-banner')).toBeTruthy();
      expect(screen.queryByTestId('perps-recall-restore-banner')).toBeNull();
      expect(mockPopoverClose).toHaveBeenCalledTimes(1);
      expect(mockDialogShow).toHaveBeenCalledTimes(1);
    },
  );

  it('illustrates the desktop menu path to the activity center', () => {
    mockGtMd = true;
    render(<PerpsRecallBanner />);
    fireEvent.click(screen.getByTestId('perps-recall-banner-close'));
    expect(mockDialogShow).toHaveBeenCalledWith(
      expect.objectContaining({
        showHeader: false,
        showCancelButton: false,
        showExitButton: false,
      }),
    );
    render(mockDialogShow.mock.calls[0][0].renderContent);
    const hint = within(screen.getByTestId('perps-recall-entry-hint'));
    expect(hint.getByTestId('icon-DotHorOutline')).toBeTruthy();
    expect(hint.queryByTestId('icon-ArrowRightOutline')).toBeNull();
    expect(hint.getByText('OneKey')).toBeTruthy();
    expect(hint.getByTestId('icon-ChartLine2Outline')).toBeTruthy();
    expect(hint.getByText('Comeback rewards')).toBeTruthy();
    expect(hint.queryByText('ETHUSDC')).toBeNull();
    expect(
      screen.getByText(
        'You can still view your rewards and trading progress in the Campaign Center.',
      ),
    ).toBeTruthy();
  });

  it('illustrates the wide web DApp account panel gift entry', () => {
    mockGtMd = true;
    platformEnv.isWebDappMode = true;
    render(<PerpsRecallBanner />);
    fireEvent.click(screen.getByTestId('perps-recall-banner-close'));
    render(mockDialogShow.mock.calls[0][0].renderContent);
    const hint = within(screen.getByTestId('perps-recall-entry-hint'));
    expect(hint.getByText('0x···')).toBeTruthy();
    expect(hint.getByTestId('icon-GiftOutline')).toBeTruthy();
    expect(hint.getByTestId('icon-SettingsOutline')).toBeTruthy();
    expect(hint.queryByTestId('icon-DotHorOutline')).toBeNull();
    expect(hint.queryByTestId('icon-ChartLine2Outline')).toBeNull();
  });

  it('keeps the ticker entry hint on narrow web DApp screens', () => {
    platformEnv.isWebDappMode = true;
    mockGtMd = false;
    render(<PerpsRecallBanner />);
    fireEvent.click(screen.getByTestId('perps-recall-banner-close'));
    render(mockDialogShow.mock.calls[0][0].renderContent);
    const hint = within(screen.getByTestId('perps-recall-entry-hint'));
    expect(hint.getByText('ETHUSDC')).toBeTruthy();
    expect(hint.queryByTestId('icon-GiftOutline')).toBeNull();
  });

  it('keeps the banner visible when the dismissal dialog is canceled', () => {
    const view = render(<PerpsRecallBanner />);
    fireEvent.click(screen.getByTestId('perps-recall-banner-close'));
    act(() => mockDialogShow.mock.calls[0][0].onClose?.());
    view.unmount();
    render(<PerpsRecallBanner />);
    expect(screen.getByTestId('perps-recall-banner')).toBeTruthy();
    expect(getDefaultStore().get(mockPerpsCustomSettingsAtom)).toEqual({
      showTradeMarks: true,
    });
  });

  it('restores a dismissed banner after the configured interval across remounts', async () => {
    jest.useFakeTimers();
    const view = render(<PerpsRecallBanner />);
    fireEvent.click(screen.getByTestId('perps-recall-banner-close'));
    await act(async () => mockDialogShow.mock.calls[0][0].onConfirm?.());
    view.unmount();
    act(() => jest.advanceTimersByTime(29 * 60 * 1000));
    const restoredView = render(<PerpsRecallBanner />);
    expect(screen.queryByTestId('perps-recall-banner')).toBeNull();
    mockRecallProgress = { ...progress, activityId: 'recall-2' };
    restoredView.rerender(<PerpsRecallBanner />);
    expect(screen.getByTestId('perps-recall-banner')).toBeTruthy();
    mockRecallProgress = progress;
    restoredView.rerender(<PerpsRecallBanner />);
    expect(screen.queryByTestId('perps-recall-banner')).toBeNull();
    act(() => jest.advanceTimersByTime(60 * 1000));
    expect(screen.getByTestId('perps-recall-banner')).toBeTruthy();
  });

  it('starts a reminder window for a legacy boolean dismissal only once', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-04T00:00:00Z'));
    getDefaultStore().set(mockPerpsCustomSettingsAtom, {
      dismissedRecallBanners: { 'test-instance:recall-1': true },
    });
    const view = render(<PerpsRecallBanner />);
    expect(screen.queryByTestId('perps-recall-banner')).toBeNull();
    expect(
      getDefaultStore().get(mockPerpsCustomSettingsAtom)
        .dismissedRecallBanners?.['test-instance:recall-1'],
    ).toBe(Date.now());
    act(() => jest.advanceTimersByTime(15 * 60 * 1000));
    view.unmount();
    render(<PerpsRecallBanner />);
    act(() => jest.advanceTimersByTime(15 * 60 * 1000));
    expect(screen.getByTestId('perps-recall-banner')).toBeTruthy();
  });

  it('restores an expired reminder when the app returns to the foreground', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-04T00:00:00Z'));
    mockRecallProgress = { ...progress, reopenAfterMinutes: 5 };
    render(<PerpsRecallBanner />);
    fireEvent.click(screen.getByTestId('perps-recall-banner-close'));
    await act(async () => mockDialogShow.mock.calls[0][0].onConfirm?.());
    expect(screen.queryByTestId('perps-recall-banner')).toBeNull();
    jest.setSystemTime(new Date('2026-11-04T00:06:00Z'));
    act(() => mockVisibilityListeners.forEach((listener) => listener(true)));
    expect(screen.getByTestId('perps-recall-banner')).toBeTruthy();
  });

  it.each([0, null])(
    'keeps a dismissal until manually restored without a positive reminder interval (%s)',
    async (reopenAfterMinutes) => {
      jest.useFakeTimers();
      platformEnv.isDev = true;
      mockRecallProgress = { ...progress, reopenAfterMinutes };
      render(
        <>
          <PerpsRecallBanner />
          <PerpsActivityCenterContent
            closePopover={mockPopoverClose}
            menuLayout
          />
        </>,
      );
      fireEvent.click(screen.getByTestId('perps-recall-banner-close'));
      await act(async () => mockDialogShow.mock.calls[0][0].onConfirm?.());
      act(() => jest.advanceTimersByTime(8 * 24 * 60 * 60 * 1000));
      expect(screen.queryByTestId('perps-recall-banner')).toBeNull();
      fireEvent.click(screen.getByTestId('perps-recall-restore-banner'));
      expect(screen.getByTestId('perps-recall-banner')).toBeTruthy();
    },
  );

  it('honors closable=false even when a dismissal was already saved', () => {
    getDefaultStore().set(mockPerpsCustomSettingsAtom, {
      dismissedRecallBanners: { 'test-instance:recall-1': Date.now() },
    });
    const view = render(<PerpsRecallBanner />);
    expect(screen.queryByTestId('perps-recall-banner')).toBeNull();
    mockRecallProgress = { ...progress, closable: false };
    view.rerender(<PerpsRecallBanner />);
    expect(screen.getByTestId('perps-recall-banner')).toBeTruthy();
    expect(screen.queryByTestId('perps-recall-banner-close')).toBeNull();
  });

  it.each([null, '', '  '])(
    'hides a banner without server copy while retaining activity details (%s)',
    (title) => {
      mockRecallProgress = { ...progress, title };
      render(
        <>
          <PerpsRecallBanner />
          <PerpsActivityCenterContent
            closePopover={mockPopoverClose}
            menuLayout
          />
        </>,
      );
      expect(screen.queryByTestId('perps-recall-banner')).toBeNull();
      expect(screen.getByTestId('activity-hub-detail-entry')).toBeTruthy();
    },
  );

  it('updates the open dialog when the activity ends', async () => {
    const view = render(<PerpsRecallBanner />);
    fireEvent.click(screen.getByTestId('perps-recall-banner'));
    const content = mockDialogShow.mock.calls[0][0].renderContent;
    const dialog = render(<>{content}</>);
    expect(screen.getByTestId('perps-recall-progress')).toBeTruthy();
    expect(screen.queryByTestId('activity-hub-detail-entry')).toBeNull();
    mockRecallEnded = true;
    mockRecallProgress = { ...progress, title: '活动结束，等待最终结果' };
    view.rerender(<PerpsRecallBanner />);
    dialog.rerender(<>{cloneElement(content as ReactElement)}</>);
    expect(screen.getByTestId('perps-recall-banner')).toBeTruthy();
    expect(screen.getByTestId('perps-recall-progress')).toBeTruthy();
    expect(screen.getByText('活动结束，等待最终结果')).toBeTruthy();
    expect(screen.getByText('Awaiting final results')).toBeTruthy();
  });

  it('keeps a paid activity banner as an entry to final results', async () => {
    mockRecallEnded = true;
    mockRecallProgress = {
      ...progress,
      activityStatus: 'ended',
      status: 'achieved',
      current: null,
      earnedReward: '0.02',
      payoutStatus: 'paid',
      paidAmount: '0.02',
      title: '奖励已发放',
    };
    render(<PerpsRecallBanner />);
    expect(screen.getByText('奖励已发放')).toBeTruthy();
    fireEvent.click(screen.getByTestId('perps-recall-banner'));
    const content = mockDialogShow.mock.calls[0][0].renderContent;
    render(<>{content}</>);
    expect(screen.getByTestId('perps-recall-progress')).toBeTruthy();
    expect(screen.queryByTestId('activity-hub-detail-entry')).toBeNull();
    expect(screen.getByText('Reward received')).toBeTruthy();
  });

  it('stops displaying stale progress when dialog data becomes unavailable', async () => {
    const view = render(<PerpsRecallBanner />);
    fireEvent.click(screen.getByTestId('perps-recall-banner'));
    const content = mockDialogShow.mock.calls[0][0].renderContent;
    const dialog = render(<>{content}</>);
    expect(screen.getByTestId('perps-recall-progress')).toBeTruthy();
    mockRecallProgress = null;
    view.rerender(<PerpsRecallBanner />);
    dialog.rerender(<>{cloneElement(content as ReactElement)}</>);
    expect(screen.queryByTestId('perps-recall-progress')).toBeNull();
    expect(screen.queryByTestId('activity-hub-detail-entry')).toBeNull();
    expect(
      screen.getByText('Activity details are currently unavailable.'),
    ).toBeTruthy();
  });

  it('renders achieved rewards without a current target and preserves final payout details', () => {
    mockRecallProgress = {
      ...progress,
      status: 'achieved',
      current: null,
      earnedReward: '150',
      title: '目标已完成，等待发奖',
    };
    const view = render(<PerpsRecallBanner />);
    expect(screen.getByText('目标已完成，等待发奖')).toBeTruthy();
    view.unmount();
    render(
      <PerpsRecallProgressCard
        hasEnded
        progress={{
          ...mockRecallProgress,
          activityStatus: 'ended',
          payoutStatus: 'paid',
          paidAmount: '145',
          paidAt: '2030-01-02T00:00:00.000Z',
        }}
      />,
    );
    expect(screen.getByText('Trading target completed')).toBeTruthy();
    expect(screen.getByText('Reward received')).toBeTruthy();
    expect(screen.getByTestId('perps-recall-reward').textContent).toBe('145');
    expect(screen.queryByText('Current target reward')).toBeNull();
    expect(
      screen.queryByText('Earned rewards have not been paid yet.'),
    ).toBeNull();
  });

  it('displays recall amounts in USDC while preserving the server copy', () => {
    render(<PerpsRecallBanner />);
    expect(screen.getByText('再交易 10K USDC，返 150 USDC')).toBeTruthy();
    expect(screen.queryByText(/USDT/)).toBeNull();
    expect(screen.queryByText(/Before .*UTC/)).toBeNull();
    expect(screen.queryByText(/Exclusive/)).toBeNull();
  });

  it('shows the locked reward status and a two-line progress summary', () => {
    const view = render(
      <PerpsRecallProgressCard progress={progress} hasEnded={false} />,
    );
    expect(screen.getByTestId('perps-recall-reward').textContent).toBe('150');
    expect(screen.getByTestId('perps-recall-traded').textContent).toBe(
      '$1,000.25 / $4,000',
    );
    expect(screen.getByTestId('perps-recall-status').textContent).toBe(
      'Reward locked',
    );
    expect(screen.queryByTestId('perps-recall-remaining')).toBeNull();
    expect(screen.queryByText('Trading target completed')).toBeNull();
    expect(screen.queryByText('Awaiting payout')).toBeNull();
    expect(screen.getByTestId('perps-recall-percentage').textContent).toBe(
      '25%',
    );

    view.rerender(
      <PerpsRecallProgressCard
        progress={{
          ...progress,
          status: 'achieved',
          current: null,
          volume: '4000.2316',
          earnedReward: '150',
        }}
        hasEnded={false}
      />,
    );
    expect(screen.getByTestId('perps-recall-traded').textContent).toBe(
      '$4,000.2316',
    );
    expect(screen.queryByTestId('perps-recall-remaining')).toBeNull();
    expect(screen.getByTestId('perps-recall-percentage').textContent).toBe(
      '100%',
    );
    expect(screen.getByText('Trading target completed')).toBeTruthy();
    expect(screen.getByText('Awaiting payout')).toBeTruthy();
  });

  it('keeps zero progress empty and preserves skipped payout and ended results', () => {
    const view = render(
      <PerpsRecallProgressCard
        progress={{ ...progress, volume: '0' }}
        hasEnded={false}
      />,
    );
    expect(screen.getByTestId('perps-recall-percentage').textContent).toBe(
      '0%',
    );
    expect(view.container.querySelector('circle[stroke-dasharray]')).toBeNull();
    expect(screen.queryByText('Trading target completed')).toBeNull();

    view.rerender(
      <PerpsRecallProgressCard
        progress={{
          ...progress,
          activityStatus: 'ended',
          payoutStatus: 'skipped',
        }}
        hasEnded
      />,
    );
    expect(screen.getByText('Payout skipped')).toBeTruthy();
    expect(screen.queryByText('Awaiting payout')).toBeNull();
    expect(screen.getByTestId('perps-recall-reward').textContent).toBe('0');

    view.rerender(
      <PerpsRecallProgressCard
        progress={{ ...progress, activityStatus: 'ended' }}
        hasEnded
      />,
    );
    expect(screen.getByText('Target not reached')).toBeTruthy();
    expect(screen.queryByText('Trading target completed')).toBeNull();
  });

  it('updates reward copy, accessible labels and the UTC date when the locale changes', () => {
    const view = render(
      <PerpsRecallProgressCard progress={progress} hasEnded={false} />,
    );
    expect(screen.getByText('Reward locked')).toBeTruthy();
    mockLocale = 'zh-CN';
    view.rerender(
      <PerpsRecallProgressCard progress={progress} hasEnded={false} />,
    );
    expect(screen.getByText('奖励未解锁')).toBeTruthy();
    expect(screen.getByText('总奖励')).toBeTruthy();
    expect(screen.queryByText('Reward locked')).toBeNull();
    expect(screen.getByTestId('perps-recall-details').textContent).toBe(
      '活动将于 2030年1月1日 结束。 了解更多',
    );
    view.rerender(<PerpsRecallAction />);
    expect(screen.getByLabelText('回归奖励')).toBeTruthy();
    fireEvent.click(screen.getByTestId('perp-mobile-activity-center'));
    expect(mockDialogShow).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: '回归奖励' }),
    );
    view.rerender(<PerpsRecallBanner />);
    fireEvent.click(screen.getByTestId('perps-recall-banner-close'));
    expect(mockDialogShow).toHaveBeenLastCalledWith(
      expect.objectContaining({ onConfirmText: '下次提醒我' }),
    );
  });

  it('shows only the UTC deadline date and updates the wording when it ends', () => {
    const campaign = {
      ...progress,
      deadline: '2030-01-02T07:59:00+08:00',
    };
    const view = render(
      <PerpsRecallProgressCard progress={campaign} hasEnded={false} />,
    );
    expect(screen.getByTestId('perps-recall-details').textContent).toBe(
      'Campaign ends on Jan 1, 2030. Learn more',
    );
    expect(screen.getByTestId('perps-recall-help').textContent).toBe(
      'Learn more',
    );

    view.rerender(<PerpsRecallProgressCard progress={campaign} hasEnded />);
    expect(screen.getByTestId('perps-recall-details').textContent).toBe(
      'Campaign ended on Jan 1, 2030. Learn more',
    );
  });

  it.each(['native', 'desktop', 'web'] as const)(
    'preserves campaign link opening order on %s',
    async (platform) => {
      platformEnv.isNative = platform === 'native';
      platformEnv.isDesktop = platform === 'desktop';
      let resolveClose: (() => void) | undefined;
      mockPopoverClose.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveClose = resolve;
          }),
      );
      render(
        <PerpsRecallDialogContent
          activityId="recall-1"
          instanceId="test-instance"
        />,
      );
      fireEvent.click(screen.getByTestId('perps-recall-help'));
      expect(mockPopoverClose).toHaveBeenCalledTimes(1);
      expect(mockOpenUrlInApp).not.toHaveBeenCalled();
      expect(mockOpenUrlInDiscovery).not.toHaveBeenCalled();
      if (platform === 'web') {
        expect(mockOpenUrlExternal).toHaveBeenCalledWith(progress.blogUrl);
      } else {
        expect(mockOpenUrlExternal).not.toHaveBeenCalled();
      }

      await act(async () => resolveClose?.());
      expect(mockOpenUrlInApp).not.toHaveBeenCalled();
      if (platform === 'web') {
        expect(mockOpenUrlExternal).toHaveBeenCalledWith(progress.blogUrl);
        expect(mockOpenUrlInDiscovery).not.toHaveBeenCalled();
      } else {
        expect(mockOpenUrlInDiscovery).toHaveBeenCalledWith({
          url: progress.blogUrl,
        });
        expect(mockOpenUrlExternal).not.toHaveBeenCalled();
      }
    },
  );

  it.each([null, ''])(
    'hides the campaign link when no blog URL is provided (%s)',
    (blogUrl) => {
      render(
        <PerpsRecallProgressCard
          progress={{ ...progress, blogUrl }}
          hasEnded={false}
        />,
      );
      expect(screen.queryByTestId('perps-recall-help')).toBeNull();
      expect(screen.getByTestId('perps-recall-details').textContent).toBe(
        'Campaign ends on Jan 1, 2030.',
      );
    },
  );

  it('updates the banner illustration and progress ring with the active theme', () => {
    const renderContent = () => (
      <>
        <PerpsRecallBanner />
        <PerpsRecallProgressCard progress={progress} hasEnded={false} />
      </>
    );
    const view = render(renderContent());
    expect(view.container.querySelector('path[stroke="#111111"]')).toBeTruthy();
    expect(view.container.querySelector('path[fill="#FFFFFF"]')).toBeTruthy();
    expect(
      view.container.querySelector('circle[stroke="#22AB15"]'),
    ).toBeTruthy();

    mockDarkTheme = true;
    view.rerender(renderContent());
    expect(view.container.querySelector('path[stroke="#EEEEEE"]')).toBeTruthy();
    expect(view.container.querySelector('path[fill="#1B1B1B"]')).toBeTruthy();
    expect(
      view.container.querySelector('circle[stroke="#3EDC2F"]'),
    ).toBeTruthy();
    expect(view.container.querySelector('circle[stroke="#22AB15"]')).toBeNull();
  });

  it('uses a wide hub for recall content even without configured campaign links', async () => {
    mockGtMd = true;
    const onOpen = jest.fn();
    render(
      <ActivityHubAction
        source="Perps"
        renderTrigger={<span>Open activity center</span>}
        onOpenReferral={jest.fn()}
        detailEntry={{
          title: 'Comeback rewards',
          icon: 'GiftOutline',
          onOpen,
        }}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('activity-hub-detail-entry')).toBeTruthy(),
    );
    expect(screen.queryByTestId('perps-recall-progress')).toBeNull();
    expect(mockPopoverFloatingPanelProps).toHaveBeenLastCalledWith({
      width: 384,
    });
    expect(screen.getByTestId('activity-hub-open-perks')).toBeTruthy();
    expect(
      screen.getByText(`${ETranslations.perps_ongoing_events} (1)`),
    ).toBeTruthy();
    fireEvent.click(screen.getByTestId('activity-hub-detail-entry'));
    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1));
    expect(mockPopoverClose).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])(
    'lists recall first among current activities (wide screen: %s)',
    async (wideScreen) => {
      mockGtMd = wideScreen;
      const closePopover = jest.fn();
      const onOpen = jest.fn();
      render(
        <ActivityHubContent
          source="Perps"
          closePopover={closePopover}
          onOpenReferral={jest.fn()}
          campaigns={CAMPAIGNS}
          detailEntry={{
            title: 'Comeback rewards',
            subtitle: 'View your rewards and trading progress',
            icon: 'GiftOutline',
            onOpen,
          }}
        />,
      );
      expect(
        screen.getByText(`${ETranslations.perps_ongoing_events} (2)`),
      ).toBeTruthy();
      const recallCard = screen.getByTestId('activity-hub-detail-entry');
      expect(recallCard.parentElement).toBe(getCampaignCard().parentElement);
      expect(recallCard.nextElementSibling).toBe(getCampaignCard());
      expect(recallCard.parentElement).not.toBe(
        screen.getByTestId('activity-hub-open-perks').parentElement,
      );
      fireEvent.click(recallCard);
      await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1));
      expect(closePopover).toHaveBeenCalledTimes(1);
      expect(mockOpenUrlExternal).not.toHaveBeenCalled();
      expect(screen.getByTestId('activity-hub-detail-entry')).toBeTruthy();
      expect(getCampaignCard()).toBeTruthy();
    },
  );
});
