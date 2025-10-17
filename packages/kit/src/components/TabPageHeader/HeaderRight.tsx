import { type ReactNode, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  SizableText,
  XStack,
  YStack,
  useIsHorizontalLayout,
  useMedia,
} from '@onekeyhq/components';
import {
  HeaderButtonGroup,
  HeaderIconButton,
  HeaderNotificationButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import { UniversalSearchInput } from '@onekeyhq/kit/src/components/TabPageHeader/UniversalSearchInput';
import { useNotificationsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import useAppNavigation from '../../hooks/useAppNavigation';
import { useReferFriends } from '../../hooks/useReferFriends';
import TabCountButton from '../../views/Discovery/components/MobileBrowser/TabCountButton';
import { HistoryIconButton } from '../../views/Discovery/pages/components/HistoryIconButton';

import { OneKeyIdButton } from './components';
import { MoreActionButton } from './MoreActionButton';

function GiftAction() {
  const { shareReferRewards } = useReferFriends();
  const handleShareReferRewards = useCallback(() => {
    void shareReferRewards();
  }, [shareReferRewards]);
  const intl = useIntl();
  return (
    <HeaderIconButton
      title={intl.formatMessage({ id: ETranslations.referral_title })}
      icon="GiftOutline"
      onPress={handleShareReferRewards}
    />
  );
}

function NotificationsButton() {
  const [{ firstTimeGuideOpened, badge }] = useNotificationsAtom();
  const navigation = useAppNavigation();
  const intl = useIntl();
  const openNotificationsModal = useCallback(async () => {
    navigation.pushModal(EModalRoutes.NotificationsModal, {
      screen: EModalNotificationsRoutes.NotificationList,
    });
  }, [navigation]);
  return (
    <HeaderNotificationButton
      key="notifications"
      testID="headerRightNotificationsButton"
      title={intl.formatMessage({
        id: ETranslations.global_notifications,
      })}
      showBadge={!firstTimeGuideOpened || !!badge}
      badgeCount={firstTimeGuideOpened ? badge : undefined}
      onPress={openNotificationsModal}
    />
  );
}

export function MoreAction() {
  return <MoreActionButton key="more-action" />;
}

export function SelectorTrigger() {
  return (
    <NetworkSelectorTriggerHome
      num={0}
      size="small"
      recordNetworkHistoryEnabled
    />
  );
}

function DepositAction() {
  const { gtMd } = useMedia();
  const intl = useIntl();
  return gtMd ? null : (
    <Button
      icon="WalletCryptoOutline"
      size="small"
      gap="$1.5"
      onPress={() => {
        alert('Deposit');
      }}
    >
      <XStack alignItems="center" gap="$1.5">
        <YStack
          bg="rgba(0, 0, 0, 0.11)"
          width={StyleSheet.hairlineWidth}
          height="$4"
        />
        <SizableText
          textBreakStrategy="simple"
          size="$bodySmMedium"
          color="$textSubdued"
        >
          {intl.formatMessage({ id: ETranslations.perp_trade_deposit })}
        </SizableText>
      </XStack>
    </Button>
  );
}

export function SearchInput() {
  const { gtLg } = useMedia();
  return <UniversalSearchInput size={gtLg ? 'large' : 'small'} />;
}

export function HeaderRight({
  tabRoute,
  customHeaderRightItems,
  renderCustomHeaderRightItems,
}: {
  sceneName: EAccountSelectorSceneName;
  tabRoute: ETabRoutes;
  customHeaderRightItems?: ReactNode;
  renderCustomHeaderRightItems?: ({
    fixedItems,
  }: {
    fixedItems: ReactNode;
  }) => ReactNode;
}) {
  const isHorizontal = useIsHorizontalLayout();
  const items = useMemo(() => {
    if (customHeaderRightItems) {
      return customHeaderRightItems;
    }

    const fixedItems = (
      <>
        {isHorizontal ? <NotificationsButton /> : null}
        <MoreAction />
        {isHorizontal ? (
          <OneKeyIdButton testID="header-right-onekey-id" />
        ) : null}
      </>
    );

    if (renderCustomHeaderRightItems) {
      return renderCustomHeaderRightItems({ fixedItems });
    }

    switch (tabRoute) {
      case ETabRoutes.Home:
        return (
          <>
            {isHorizontal ? <SearchInput /> : undefined}
            {isHorizontal ? undefined : <SelectorTrigger />}
            {fixedItems}
          </>
        );
      case ETabRoutes.Swap:
        return fixedItems;
      case ETabRoutes.WebviewPerpTrade:
        return fixedItems;
      case ETabRoutes.Market:
        return (
          <>
            {isHorizontal ? <SearchInput /> : undefined}
            {fixedItems}
          </>
        );
      case ETabRoutes.Discovery:
        return (
          <>
            <HistoryIconButton />
            {isHorizontal || !platformEnv.isNative ? undefined : (
              <TabCountButton testID="browser-header-tabs" />
            )}
            {fixedItems}
          </>
        );
      case ETabRoutes.Earn:
        return (
          <>
            <GiftAction />
            {fixedItems}
          </>
        );
      case ETabRoutes.Perp:
        return <DepositAction />;
      default:
        break;
    }
  }, [
    isHorizontal,
    tabRoute,
    customHeaderRightItems,
    renderCustomHeaderRightItems,
  ]);
  const width = useMemo(() => {
    if (platformEnv.isNative) {
      return undefined;
    }
    if (platformEnv.isDesktopMac) {
      return 'unset';
    }
    return '100%';
  }, []);
  return (
    <HeaderButtonGroup
      testID="Wallet-Page-Header-Right"
      className="app-region-no-drag"
      width={width}
      jc={platformEnv.isNative ? undefined : 'flex-end'}
    >
      {items}
    </HeaderButtonGroup>
  );
}
