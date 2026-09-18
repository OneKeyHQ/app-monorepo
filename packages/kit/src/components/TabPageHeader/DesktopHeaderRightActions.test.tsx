/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { DesktopHeaderRightActions } from './DesktopHeaderRightActions';

jest.mock('@onekeyhq/components/src/layouts/Navigation/Header', () => ({
  HeaderButtonGroup: ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>,
}));

jest.mock('./components', () => ({
  GiftAction: () => <div data-testid="header-gift-action" />,
  HeaderUpdateButton: () => <div data-testid="header-update-button" />,
  WalletConnectionForWeb: () => <div data-testid="wallet-connection-for-web" />,
}));

jest.mock('./components/HeaderNotificationIconButton', () => ({
  HeaderNotificationIconButton: ({ testID }: { testID?: string }) => (
    <div data-testid={testID ?? 'header-right-notification'} />
  ),
}));

jest.mock('../../views/Discovery/pages/components/HistoryIconButton', () => ({
  HistoryIconButton: () => <div data-testid="browser-history-button" />,
}));

function getHeaderRightGroup() {
  return screen.getByTestId('desktop-header-right-actions');
}

describe('DesktopHeaderRightActions', () => {
  it('keeps the Swap gift in the same aligned group as update and notification', () => {
    render(
      <DesktopHeaderRightActions
        tabRoute={ETabRoutes.Swap}
        customHeaderRightItems={
          <div data-testid="swap-invitee-reward-top-nav-button" />
        }
      />,
    );

    const group = getHeaderRightGroup();
    expect(
      group.contains(screen.getByTestId('swap-invitee-reward-top-nav-button')),
    ).toBe(true);
    expect(group.contains(screen.getByTestId('header-update-button'))).toBe(
      true,
    );
    expect(
      group.contains(screen.getByTestId('header-right-notification')),
    ).toBe(true);
  });

  it('keeps the Earn gift in the same aligned group as update and notification', () => {
    render(<DesktopHeaderRightActions tabRoute={ETabRoutes.Earn} />);

    const group = getHeaderRightGroup();
    expect(group.contains(screen.getByTestId('header-gift-action'))).toBe(true);
    expect(group.contains(screen.getByTestId('header-update-button'))).toBe(
      true,
    );
    expect(
      group.contains(screen.getByTestId('header-right-notification')),
    ).toBe(true);
  });

  it('still renders the system icons when Swap has no custom gift', () => {
    render(<DesktopHeaderRightActions tabRoute={ETabRoutes.Swap} />);

    const group = getHeaderRightGroup();
    expect(
      screen.queryByTestId('swap-invitee-reward-top-nav-button'),
    ).toBeNull();
    expect(screen.queryByTestId('header-gift-action')).toBeNull();
    expect(group.contains(screen.getByTestId('header-update-button'))).toBe(
      true,
    );
    expect(
      group.contains(screen.getByTestId('header-right-notification')),
    ).toBe(true);
  });
});
