/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockOpenUrlExternal = jest.fn();
const mockPopoverClose = jest.fn();
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
    Icon: Primitive,
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

jest.mock('@onekeyhq/components/src/layouts/Navigation/Header', () => ({
  HeaderIconButton: ({
    onPress,
    testID,
    title,
  }: {
    onPress?: () => void;
    testID?: string;
    title?: string;
  }) => (
    <button data-testid={testID} onClick={onPress} type="button">
      {title}
    </button>
  ),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
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
import { getActivityHubLayout } from './layout';

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
  });

  it('opens the referral page after the host closes', async () => {
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

    expect(screen.queryByTestId('activity-hub-invite')).toBeNull();
    expect(screen.queryByTestId('activity-hub-my-rewards')).toBeNull();

    fireEvent.click(screen.getByTestId('activity-hub-referral'));
    expect(closePopover).toHaveBeenCalledTimes(1);
    expect(onOpenReferral).not.toHaveBeenCalled();

    resolveClose?.();
    await waitFor(() => expect(onOpenReferral).toHaveBeenCalledTimes(1));
  });

  it('settles a canceled close without opening the referral page', async () => {
    const { OverlayCloseCancelledError } = jest.requireActual<
      typeof import('../../../../components/src/shared/overlayCloseCancellation')
    >('../../../../components/src/shared/overlayCloseCancellation');
    const closePopover = jest.fn(() =>
      Promise.reject(new OverlayCloseCancelledError('reopened')),
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
    await waitFor(() => expect(closePopover).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(onOpenReferral).not.toHaveBeenCalled();
  });

  it('opens the referral page from the gift when there are no campaigns', () => {
    const onOpenReferral = jest.fn();
    render(<ActivityHubAction source="Earn" onOpenReferral={onOpenReferral} />);

    const gift = screen.getByTestId('header-gift-action');
    expect(gift.textContent).toBe(ETranslations.sidebar_refer_a_friend);
    expect(mockPopoverFloatingPanelProps).not.toHaveBeenCalled();

    fireEvent.click(gift);
    expect(onOpenReferral).toHaveBeenCalledTimes(1);
  });

  it('keeps the popover when there are campaigns', () => {
    render(
      <ActivityHubAction
        source="Perps"
        onOpenReferral={jest.fn()}
        campaigns={CAMPAIGNS}
      />,
    );
    expect(mockPopoverFloatingPanelProps).toHaveBeenCalled();
  });

  it.each([
    {
      host: 'the shortcut-only popover',
      isNative: false,
      campaigns: undefined,
      width: getActivityHubLayout(false).panelWidth,
      basis: getActivityHubLayout(false).shortcutBasis,
    },
    {
      host: 'the popover with campaign cards',
      isNative: false,
      campaigns: CAMPAIGNS,
      width: getActivityHubLayout(true).panelWidth,
      basis: getActivityHubLayout(true).shortcutBasis,
    },
    {
      // Native popovers always Adapt to a Sheet that no floatingPanelProps
      // width can narrow, so the tiles have to keep the wide-panel basis.
      host: 'the native sheet',
      isNative: true,
      campaigns: undefined,
      width: undefined,
      basis: getActivityHubLayout(true).shortcutBasis,
    },
  ])(
    'pairs the width and tile basis of $host',
    async ({ isNative, campaigns, width, basis }) => {
      platformEnv.isNative = isNative;

      render(
        <ActivityHubAction
          source="Perps"
          onOpenReferral={jest.fn()}
          renderTrigger={<div />}
          campaigns={campaigns}
        />,
      );

      expect(mockPopoverFloatingPanelProps).toHaveBeenLastCalledWith({ width });
      await waitFor(() => expect(getShortcutBasis()).toBe(basis));
    },
  );

  it('narrows the tile basis only when the host marks the panel compact', () => {
    const props = {
      source: 'Earn',
      closePopover: jest.fn(),
      onOpenReferral: jest.fn(),
    } as const;
    const { rerender } = render(<ActivityHubContent {...props} />);

    expect(getShortcutBasis()).toBe(getActivityHubLayout(true).shortcutBasis);

    rerender(<ActivityHubContent {...props} isCompactPanel />);

    expect(getShortcutBasis()).toBe(getActivityHubLayout(false).shortcutBasis);
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
