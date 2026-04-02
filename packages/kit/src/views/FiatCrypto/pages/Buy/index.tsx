import type { RefObject } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, SegmentControl, Stack } from '@onekeyhq/components';
import { PagerView } from '@onekeyhq/components/src/composite/Carousel/pager';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalFiatCryptoRoutes,
  IModalFiatCryptoParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { HomeTokenListProviderMirror } from '../../../Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { SellOrBuyContent } from '../../components/SellOrBuy';
import { TokenDataContainer } from '../../components/TokenDataContainer';

import type { RouteProp } from '@react-navigation/core';
import type NativePagerView from 'react-native-pager-view';

type ITabType = 'buy' | 'sell';

const TAB_TO_INDEX: Record<ITabType, number> = { buy: 0, sell: 1 };
const INDEX_TO_TAB: ITabType[] = ['buy', 'sell'];

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

  const initialTab: ITabType = defaultTab ?? 'buy';
  const [activeTab, setActiveTab] = useState<ITabType>(initialTab);

  const pagerRef = useRef<NativePagerView>(null);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const handleTabChange = useCallback((value: string | number) => {
    const tab = value as ITabType;
    setActiveTab(tab);
    if (platformEnv.isNative) {
      pagerRef.current?.setPage(TAB_TO_INDEX[tab]);
    }
  }, []);

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

  const renderHeaderTitle = useCallback(
    () => (
      <SegmentControl
        value={activeTab}
        onChange={handleTabChange}
        options={segmentOptions}
      />
    ),
    [activeTab, handleTabChange, segmentOptions],
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
                  <Stack flex={1}>
                    <SellOrBuyContent
                      type="buy"
                      networkId={networkId}
                      accountId={accountId}
                    />
                  </Stack>
                  <Stack flex={1}>
                    <SellOrBuyContent
                      type="sell"
                      networkId={networkId}
                      accountId={accountId}
                    />
                  </Stack>
                </PagerView>
              ) : (
                <SellOrBuyContent
                  type={activeTab}
                  networkId={networkId}
                  accountId={accountId}
                />
              )}
            </Page.Body>
          </Page>
        </TokenDataContainer>
      </HomeTokenListProviderMirror>
    </AccountSelectorProviderMirror>
  );
};

export default BuyPage;
