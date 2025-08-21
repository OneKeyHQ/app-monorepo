import { type ReactNode, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  SizableText,
  Stack,
  useIsHorizontalLayout,
  useMedia,
} from '@onekeyhq/components';
import {
  HeaderButtonGroup,
  HeaderIconButton,
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
import { useLoginOneKeyId } from '../../hooks/useLoginOneKeyId';
import { useReferFriends } from '../../hooks/useReferFriends';
import TabCountButton from '../../views/Discovery/components/MobileBrowser/TabCountButton';
import { HistoryIconButton } from '../../views/Discovery/pages/components/HistoryIconButton';

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
    <Stack key="notifications" testID="headerRightNotificationsButton">
      <HeaderIconButton
        title={intl.formatMessage({
          id: ETranslations.global_notifications,
        })}
        trackID="header-right-notifications"
        icon="BellOutline"
        onPress={openNotificationsModal}
      />
      {!firstTimeGuideOpened || badge ? (
        <Stack
          position="absolute"
          right="$-2.5"
          top="$-2"
          alignItems="flex-end"
          w="$10"
          pointerEvents="none"
        >
          <Stack
            bg="$bgApp"
            borderRadius="$full"
            borderWidth={2}
            borderColor="$transparent"
          >
            <Stack
              px="$1"
              borderRadius="$full"
              bg="$bgCriticalStrong"
              minWidth="$4"
              height="$4"
              alignItems="center"
              justifyContent="center"
            >
              {!firstTimeGuideOpened ? (
                <Stack
                  width="$1"
                  height="$1"
                  backgroundColor="white"
                  borderRadius="$full"
                />
              ) : (
                <SizableText color="$textOnColor" size="$bodySm">
                  {badge && badge > 99 ? '99+' : badge}
                </SizableText>
              )}
            </Stack>
          </Stack>
        </Stack>
      ) : null}
    </Stack>
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

function PeopleAction() {
  const { loginOneKeyId } = useLoginOneKeyId();
  const handlePress = useCallback(async () => {
    await loginOneKeyId({ toOneKeyIdPageOnLoginSuccess: true });
  }, [loginOneKeyId]);
  return (
    <HeaderIconButton
      key="onekey-id"
      title="OneKey ID"
      icon="PeopleOutline"
      onPress={handlePress}
      testID="header-right-onekey-id"
    />
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
        {isHorizontal ? <PeopleAction /> : null}
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
