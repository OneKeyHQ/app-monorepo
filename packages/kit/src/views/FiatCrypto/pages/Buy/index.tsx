import type { RefObject } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Empty, Page, SegmentControl, Stack } from '@onekeyhq/components';
import { PagerView } from '@onekeyhq/components/src/composite/Carousel/pager';
import {
  HeaderButtonGroup,
  HeaderIconButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBotWalletDeactivatedStatus } from '@onekeyhq/kit/src/hooks/useBotWalletDeactivatedStatus';
import { getBotWalletDisabledMessage } from '@onekeyhq/kit/src/utils/botWalletDisabledToast';
import {
  BUY_GUIDE_URL,
  SELL_GUIDE_URL,
} from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalFiatCryptoRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalFiatCryptoParamList } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  openUrlExternal,
  openUrlInDiscovery,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { HomeTokenListProviderMirror } from '../../../Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import {
  OrdersBanner,
  getOrdersBannerTarget,
} from '../../components/Headless/OrdersBanner';
import { SellOrBuyContent } from '../../components/SellOrBuy';
import { TokenDataContainer } from '../../components/TokenDataContainer';
import { useHeadlessBuyOrders } from '../../hooks/useHeadlessBuyOrders';
import { FiatCryptoTestIDs } from '../../testIDs';

import type { IOrdersBannerTarget } from '../../components/Headless/OrdersBanner';
import type { RouteProp } from '@react-navigation/core';
import type NativePagerView from 'react-native-pager-view';

type ITabType = 'buy' | 'sell';

const TAB_TO_INDEX: Record<ITabType, number> = { buy: 0, sell: 1 };
const INDEX_TO_TAB: ITabType[] = ['buy', 'sell'];
const TAB_GUIDE_URLS: Record<ITabType, string> = {
  buy: BUY_GUIDE_URL,
  sell: SELL_GUIDE_URL,
};

function BotWalletBuyBlockedPlaceholder() {
  return (
    <Stack flex={1} justifyContent="center" px="$5">
      <Empty
        illustration="WalletAdd"
        title={getBotWalletDisabledMessage('addMoney')}
      />
    </Stack>
  );
}

const BuyPage = () => {
  const route =
    useRoute<
      RouteProp<IModalFiatCryptoParamList, EModalFiatCryptoRoutes.BuyModal>
    >();
  const {
    networkId,
    accountId,
    tokens = [],
    map = {},
    defaultTab,
  } = route.params;
  const intl = useIntl();
  const navigation = useAppNavigation();
  // Native buy orders (iOS only; empty elsewhere). Entering this page is one
  // of the allowed status-lookup moments, hence refreshOnMount.
  const { visibleOrders, processingOrders, unseenFailedOrder } =
    useHeadlessBuyOrders({ refreshOnMount: true });
  const bannerTarget = useMemo(
    () => getOrdersBannerTarget({ processingOrders, unseenFailedOrder }),
    [processingOrders, unseenFailedOrder],
  );
  const openOrders = useCallback(() => {
    defaultLogger.fiatCrypto.onramper.ordersEntryPressed({
      source: 'icon',
      processingCount: processingOrders.length,
    });
    navigation.push(EModalFiatCryptoRoutes.HeadlessBuyOrders);
  }, [navigation, processingOrders.length]);
  const handleBannerPress = useCallback(
    (target: IOrdersBannerTarget) => {
      defaultLogger.fiatCrypto.onramper.ordersEntryPressed({
        source: 'banner',
        processingCount: processingOrders.length,
      });
      if (target.kind === 'order') {
        navigation.push(EModalFiatCryptoRoutes.HeadlessBuyOrderDetail, {
          transactionId: target.order.transactionId,
        });
      } else {
        navigation.push(EModalFiatCryptoRoutes.HeadlessBuyOrders);
      }
    },
    [navigation, processingOrders.length],
  );
  const walletId = useMemo(
    () =>
      accountUtils.getWalletIdFromAccountId({
        accountId: accountId ?? '',
      }),
    [accountId],
  );
  const { isBotWallet, isBotWalletDeactivated } = useBotWalletDeactivatedStatus(
    {
      walletId,
    },
  );
  const isBuyBlockedByBotWallet = isBotWallet && isBotWalletDeactivated;

  const initialTab: ITabType = defaultTab ?? 'buy';
  const [activeTab, setActiveTab] = useState<ITabType>(initialTab);

  const pagerRef = useRef<NativePagerView>(null);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const switchToTab = useCallback((tab: ITabType) => {
    setActiveTab(tab);
    if (platformEnv.isNative) {
      pagerRef.current?.setPage(TAB_TO_INDEX[tab]);
    }
  }, []);

  const handleTabChange = useCallback(
    (value: string | number) => {
      const tab = value as ITabType;
      switchToTab(tab);
    },
    [switchToTab],
  );

  const handlePageSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      const newTab = INDEX_TO_TAB[e.nativeEvent.position];
      if (newTab && newTab !== activeTabRef.current) {
        setActiveTab(newTab);
      }
    },
    [],
  );

  const segmentOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.global_buy }),
        value: 'buy' as const,
      },
      {
        label: intl.formatMessage({ id: ETranslations.global_cash_out }),
        value: 'sell' as const,
      },
    ],
    [intl],
  );

  const headerRight = useCallback(
    () => (
      <HeaderButtonGroup>
        {/* Order history entry, only once this device has an order. */}
        {visibleOrders.length > 0 ? (
          <HeaderIconButton
            testID="fiat-crypto-orders-button"
            icon="ClockTimeHistoryOutline"
            onPress={openOrders}
          />
        ) : null}
        <HeaderIconButton
          icon="QuestionmarkOutline"
          onPress={() => {
            const url = TAB_GUIDE_URLS[activeTab];
            if (platformEnv.isDesktop || platformEnv.isNative) {
              openUrlInDiscovery({ url });
            } else {
              openUrlExternal(url);
            }
          }}
        />
      </HeaderButtonGroup>
    ),
    [activeTab, openOrders, visibleOrders.length],
  );

  const renderHeaderTitle = useCallback(
    () => (
      <SegmentControl
        testID={FiatCryptoTestIDs.segmentControl}
        value={activeTab}
        onChange={handleTabChange}
        options={segmentOptions}
      />
    ),
    [activeTab, handleTabChange, segmentOptions],
  );

  // Native iOS only (the only platform with native buy orders): a stable
  // header element whose content follows the order state.
  const buyListHeader = platformEnv.isNativeIOS ? (
    <OrdersBanner target={bannerTarget} onPress={handleBannerPress} />
  ) : undefined;
  const buyContent = isBuyBlockedByBotWallet ? (
    <BotWalletBuyBlockedPlaceholder />
  ) : (
    <SellOrBuyContent
      type="buy"
      networkId={networkId}
      accountId={accountId}
      listHeader={buyListHeader}
    />
  );

  const activeTabContent =
    activeTab === 'buy' ? (
      buyContent
    ) : (
      <SellOrBuyContent
        type="sell"
        networkId={networkId}
        accountId={accountId}
      />
    );

  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <HomeTokenListProviderMirror>
        <TokenDataContainer
          networkId={networkId}
          accountId={accountId}
          initialMap={map}
          initialTokens={tokens}
        >
          <Page safeAreaEnabled={false}>
            <Page.Header
              headerTitle={renderHeaderTitle}
              headerTitleAlign="center"
              headerRight={headerRight}
            />
            <Page.Body>
              {platformEnv.isNative ? (
                <PagerView
                  ref={pagerRef as RefObject<NativePagerView>}
                  style={{ flex: 1 }}
                  initialPage={TAB_TO_INDEX[initialTab]}
                  onPageSelected={handlePageSelected}
                  keyboardDismissMode="on-drag"
                  pageWidth="100%"
                >
                  <Stack flex={1}>{buyContent}</Stack>
                  <Stack flex={1}>
                    <SellOrBuyContent
                      type="sell"
                      networkId={networkId}
                      accountId={accountId}
                    />
                  </Stack>
                </PagerView>
              ) : (
                activeTabContent
              )}
            </Page.Body>
          </Page>
        </TokenDataContainer>
      </HomeTokenListProviderMirror>
    </AccountSelectorProviderMirror>
  );
};

export default BuyPage;
