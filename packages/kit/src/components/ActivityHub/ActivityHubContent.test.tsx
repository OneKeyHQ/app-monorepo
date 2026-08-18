/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockShareReferRewards = jest.fn();
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
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useReferFriends', () => ({
  useReferFriends: () => ({
    shareReferRewards: mockShareReferRewards,
  }),
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

import { ActivityHubAction } from './ActivityHubAction';
import { ActivityHubContent } from './ActivityHubContent';
import { getActivityHubLayout } from './layout';

describe('ActivityHubContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGtMd = true;
  });

  it('opens invite share and invitee rewards after the host closes', async () => {
    let resolveClose: (() => void) | undefined;
    const closePopover = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveClose = resolve;
        }),
    );
    const onOpenInviteeReward = jest.fn();

    render(
      <ActivityHubContent
        source="Swap"
        copyAsUrl
        closePopover={closePopover}
        onOpenInviteeReward={onOpenInviteeReward}
      />,
    );

    fireEvent.click(screen.getByTestId('activity-hub-invite'));
    expect(closePopover).toHaveBeenCalledTimes(1);
    expect(mockShareReferRewards).not.toHaveBeenCalled();

    resolveClose?.();
    await waitFor(() =>
      expect(mockShareReferRewards).toHaveBeenCalledWith(
        undefined,
        undefined,
        'Swap',
        true,
      ),
    );

    fireEvent.click(screen.getByTestId('activity-hub-my-rewards'));
    expect(closePopover).toHaveBeenCalledTimes(2);
    expect(onOpenInviteeReward).not.toHaveBeenCalled();

    resolveClose?.();
    await waitFor(() => expect(onOpenInviteeReward).toHaveBeenCalledTimes(1));
  });

  it('hides campaign cards when the list is empty', () => {
    render(
      <ActivityHubContent
        source="Earn"
        closePopover={jest.fn()}
        onOpenInviteeReward={jest.fn()}
      />,
    );

    expect(screen.queryByText(/perps.ongoing_events/)).toBeNull();
  });

  it('keeps the popover close promise', async () => {
    let resolveClose: (() => void) | undefined;
    mockPopoverClose.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveClose = resolve;
        }),
    );
    const onOpenInviteeReward = jest.fn();

    render(
      <ActivityHubAction
        source="Earn"
        onOpenInviteeReward={onOpenInviteeReward}
        renderTrigger={<div />}
      />,
    );

    fireEvent.click(screen.getByTestId('activity-hub-my-rewards'));
    expect(mockPopoverClose).toHaveBeenCalledTimes(1);
    expect(onOpenInviteeReward).not.toHaveBeenCalled();

    resolveClose?.();
    await waitFor(() => expect(onOpenInviteeReward).toHaveBeenCalledTimes(1));
  });

  it('pairs the popover width with the shortcut basis', () => {
    const narrowPanel = getActivityHubLayout(false);

    render(
      <ActivityHubAction
        source="Earn"
        onOpenInviteeReward={jest.fn()}
        renderTrigger={<div />}
      />,
    );

    expect(mockPopoverFloatingPanelProps).toHaveBeenLastCalledWith({
      width: narrowPanel.panelWidth,
    });
    expect(
      screen.getByTestId('activity-hub-invite').getAttribute('data-flex-basis'),
    ).toBe(narrowPanel.shortcutBasis);
  });

  it('keeps the wide-panel tile basis on the md sheet', () => {
    mockGtMd = false;

    render(
      <ActivityHubContent
        source="Earn"
        closePopover={jest.fn()}
        onOpenInviteeReward={jest.fn()}
      />,
    );

    expect(
      screen.getByTestId('activity-hub-invite').getAttribute('data-flex-basis'),
    ).toBe(getActivityHubLayout(true).shortcutBasis);
  });

  it('widens the popover when campaign cards are shown', () => {
    const withCampaigns = getActivityHubLayout(true);

    render(
      <ActivityHubAction
        source="Perps"
        onOpenInviteeReward={jest.fn()}
        renderTrigger={<div />}
        campaigns={[
          {
            id: 'campaign-1',
            title: 'campaign title',
            subtitle: 'campaign subtitle',
            url: 'https://onekey.so',
          },
        ]}
      />,
    );

    expect(mockPopoverFloatingPanelProps).toHaveBeenLastCalledWith({
      width: withCampaigns.panelWidth,
    });
    expect(
      screen.getByTestId('activity-hub-invite').getAttribute('data-flex-basis'),
    ).toBe(withCampaigns.shortcutBasis);
  });
});
