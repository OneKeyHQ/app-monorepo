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
} from '@onekeyhq/components/src/layouts/Navigation/Header';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import { UniversalSearchInput } from '@onekeyhq/kit/src/components/TabPageHeader/UniversalSearchInput';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useReferFriends } from '../../hooks/useReferFriends';
import TabCountButton from '../../views/Discovery/components/MobileBrowser/TabCountButton';
import { HistoryIconButton } from '../../views/Discovery/pages/components/HistoryIconButton';

import {
  DownloadButton,
  HeaderNotificationIconButton,
  LanguageButton,
  OneKeyIdButton,
  ThemeButton,
  WalletConnectionForWeb,
} from './components';
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
  const { gtXl, gtLg } = useMedia();
  const size = platformEnv.isWeb ? gtXl : gtLg;
  return <UniversalSearchInput size={size ? 'large' : 'small'} />;
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
  const { gtXl } = useMedia();

  const items = useMemo(() => {
    if (customHeaderRightItems) {
      return customHeaderRightItems;
    }

    const fixedItems = (
      <>
        {isHorizontal ? (
          <HeaderNotificationIconButton testID="header-right-notification" />
        ) : null}
        <MoreAction />
        {isHorizontal ? (
          <OneKeyIdButton testID="header-right-onekey-id" />
        ) : null}
        {isHorizontal ? <DownloadButton /> : null}
        {isHorizontal && gtXl ? <LanguageButton /> : null}
        {isHorizontal && gtXl ? <ThemeButton /> : null}
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
            <WalletConnectionForWeb tabRoute={tabRoute} />
            {fixedItems}
          </>
        );
      case ETabRoutes.Swap:
        return (
          <>
            <WalletConnectionForWeb tabRoute={tabRoute} />
            {fixedItems}
          </>
        );
      case ETabRoutes.WebviewPerpTrade:
        return (
          <>
            <WalletConnectionForWeb tabRoute={tabRoute} />
            {fixedItems}
          </>
        );
      case ETabRoutes.Market:
        return (
          <>
            {isHorizontal ? <SearchInput /> : undefined}
            <WalletConnectionForWeb tabRoute={tabRoute} />
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
            <WalletConnectionForWeb tabRoute={tabRoute} />
            {fixedItems}
          </>
        );
      case ETabRoutes.Earn:
        return (
          <>
            <GiftAction />
            <WalletConnectionForWeb tabRoute={tabRoute} />
            {fixedItems}
          </>
        );
      case ETabRoutes.Perp:
        return (
          <>
            <WalletConnectionForWeb tabRoute={tabRoute} />
            <DepositAction />
          </>
        );
      default:
        break;
    }
  }, [
    isHorizontal,
    gtXl,
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
