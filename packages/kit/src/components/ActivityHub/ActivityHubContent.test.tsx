/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

const mockOpenUrlExternal = jest.fn();
const mockPopoverClose = jest.fn();
const mockHubShown = jest.fn();
const mockHubActionPressed = jest.fn();
const mockPopoverFloatingPanelProps = jest.fn();
let mockGtMd = true;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { runAfterActionListClose } = jest.requireActual<
    typeof import('../../../../components/src/actions/ActionList/runAfterClose')
  >('../../../../components/src/actions/ActionList/runAfterClose');
  const Primitive = ({
    children,
    flexBasis,
    testID,
    onPress,
  }: {
    children?: ReactNode;
    flexBasis?: string;
    testID?: string;
    onPress?: () => void;
  }) =>
    React.createElement(
      onPress ? 'button' : 'div',
      {
        'data-flex-basis': flexBasis,
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
    Image: Primitive,
    LottieView: Primitive,
    Popover: ({
      floatingPanelProps,
      renderContent,
    }: {
      floatingPanelProps?: unknown;
      renderContent: (params: {
        closePopover: typeof mockPopoverClose;
      }) => ReactNode;
    }) => {
      mockPopoverFloatingPanelProps(floatingPanelProps);
      return React.createElement(
        'div',
        null,
        renderContent({ closePopover: mockPopoverClose }),
      );
    },
    SizableText: Primitive,
    Stack: Primitive,
    XStack: Primitive,
    YStack: Primitive,
    useMedia: () => ({ gtMd: mockGtMd }),
    runAfterActionListClose,
  };
});

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
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: (...args: unknown[]) => {
    mockOpenUrlExternal(...args);
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

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
    mockGtMd = true;
    platformEnv.isNative = false;
    platformEnv.isWeb = false;
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
