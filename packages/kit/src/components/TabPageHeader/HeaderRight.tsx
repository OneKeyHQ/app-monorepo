import { type ReactNode, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  NavBackButton,
  SizableText,
  XStack,
  YStack,
  rootNavigationRef,
  useIsWebHorizontalLayout,
  useMedia,
} from '@onekeyhq/components';
import { HeaderButtonGroup } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import { UniversalSearchInput } from '@onekeyhq/kit/src/components/TabPageHeader/UniversalSearchInput';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes/tabMarket';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import TabCountButton from '../../views/Discovery/components/MobileBrowser/TabCountButton';
import { HistoryIconButton } from '../../views/Discovery/pages/components/HistoryIconButton';
import { MoreActionButton } from '../MoreActionButton';

import {
  DownloadButton,
  GiftAction,
  HeaderNotificationIconButton,
  LanguageButton,
  ThemeButton,
  WalletConnectionForWeb,
} from './components';
import { UrlAccountPageHeader } from './urlAccountPageHeader';

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

export function SearchInput({
  isUrlWallet = false,
}: { isUrlWallet?: boolean } = {}) {
  const { gtXl, gtLg, gt2xl } = useMedia();

  let size: boolean;
  if (isUrlWallet) {
    size = platformEnv.isWeb ? gt2xl : gtXl;
  } else {
    size = platformEnv.isWeb ? gtXl : gtLg;
  }

  return <UniversalSearchInput size={size ? 'large' : 'small'} />;
}

export function HeaderRight({
  selectedHeaderTab,
  sceneName,
  tabRoute,
  customHeaderRightItems,
  renderCustomHeaderRightItems,
}: {
  selectedHeaderTab?: ETranslations;
  sceneName: EAccountSelectorSceneName;
  tabRoute: ETabRoutes;
  customHeaderRightItems?: ReactNode;
  renderCustomHeaderRightItems?: ({
    fixedItems,
  }: {
    fixedItems: ReactNode;
  }) => ReactNode;
}) {
  const isHorizontal = useIsWebHorizontalLayout();
  const { gtXl, gtMd } = useMedia();

  const items = useMemo(() => {
    if (customHeaderRightItems) {
      return customHeaderRightItems;
    }

    const fixedItems = (
      <>
        <HeaderNotificationIconButton testID="header-right-notification" />
        <MoreAction />
        {isHorizontal && platformEnv.isWebDappMode ? <DownloadButton /> : null}
        {isHorizontal && platformEnv.isWebDappMode && gtXl ? (
          <LanguageButton />
        ) : null}
        {isHorizontal && platformEnv.isWebDappMode && gtXl ? (
          <ThemeButton />
        ) : null}
      </>
    );

    const earnItems = (
      <>
        <GiftAction copyAsUrl />
        <WalletConnectionForWeb tabRoute={tabRoute} />
        {fixedItems}
      </>
    );

    if (renderCustomHeaderRightItems) {
      return renderCustomHeaderRightItems({ fixedItems });
    }

    switch (tabRoute) {
      case ETabRoutes.Home: {
        const isUrlWallet =
          platformEnv.isWebDappMode &&
          sceneName === EAccountSelectorSceneName.homeUrlAccount;

        const urlAccountBackButton =
          isUrlWallet && gtMd && platformEnv.isWebDappMode ? (
            <NavBackButton
              onPress={() => {
                rootNavigationRef.current?.navigate(ETabRoutes.Market, {
                  screen: ETabMarketRoutes.TabMarket,
                });
              }}
            />
          ) : null;

        return (
          <>
            {urlAccountBackButton}
            {isHorizontal ? (
              <SearchInput isUrlWallet={isUrlWallet} />
            ) : undefined}
            {isHorizontal ? undefined : <SelectorTrigger />}
            {isUrlWallet && gtMd && platformEnv.isWebDappMode ? (
              <UrlAccountPageHeader />
            ) : (
              <WalletConnectionForWeb tabRoute={tabRoute} />
            )}
            {fixedItems}
          </>
        );
      }
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
        if (selectedHeaderTab === ETranslations.global_earn) {
          return (
            <>
              <GiftAction copyAsUrl />
              <WalletConnectionForWeb tabRoute={tabRoute} />
            </>
          );
        }
        if (selectedHeaderTab === ETranslations.global_market) {
          return <WalletConnectionForWeb tabRoute={tabRoute} />;
        }
        return (
          <>
            <HistoryIconButton />
            {isHorizontal || !platformEnv.isNative ? undefined : (
              <TabCountButton testID="browser-header-tabs" />
            )}
            <WalletConnectionForWeb tabRoute={tabRoute} />
          </>
        );
      case ETabRoutes.Earn:
        return earnItems;
      case ETabRoutes.Perp:
        return (
          <>
            <WalletConnectionForWeb tabRoute={tabRoute} />
            <DepositAction />
          </>
        );
      case ETabRoutes.ReferFriends:
        return fixedItems;
      default:
        break;
    }
  }, [
    customHeaderRightItems,
    isHorizontal,
    gtXl,
    tabRoute,
    renderCustomHeaderRightItems,
    selectedHeaderTab,
    sceneName,
    gtMd,
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
