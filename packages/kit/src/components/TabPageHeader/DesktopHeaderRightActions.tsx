import type { ReactNode } from 'react';

import { HeaderButtonGroup } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { HistoryIconButton } from '../../views/Discovery/pages/components/HistoryIconButton';

import {
  GiftAction,
  HeaderUpdateButton,
  WalletConnectionForWeb,
} from './components';
import { HeaderNotificationIconButton } from './components/HeaderNotificationIconButton';

export function DesktopHeaderRightActions({
  tabRoute,
  customHeaderRightItems,
}: {
  tabRoute: ETabRoutes;
  customHeaderRightItems?: ReactNode;
}) {
  const leadingCustomItems =
    (tabRoute === ETabRoutes.Perp || tabRoute === ETabRoutes.Swap) &&
    customHeaderRightItems
      ? customHeaderRightItems
      : null;

  return (
    <HeaderButtonGroup
      testID="desktop-header-right-actions"
      className="app-region-no-drag"
    >
      {leadingCustomItems}
      {!leadingCustomItems && tabRoute === ETabRoutes.WebviewPerpTrade ? (
        <WalletConnectionForWeb tabRoute={tabRoute} />
      ) : null}
      {!leadingCustomItems && tabRoute === ETabRoutes.Earn ? (
        <GiftAction copyAsUrl />
      ) : null}
      {!leadingCustomItems && tabRoute === ETabRoutes.Discovery ? (
        <HistoryIconButton />
      ) : null}
      <HeaderUpdateButton />
      <HeaderNotificationIconButton testID="header-right-notification" />
    </HeaderButtonGroup>
  );
}
