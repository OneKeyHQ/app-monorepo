import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { RefreshControl, useWindowDimensions } from 'react-native';

import { Button, Page, Tab } from '@onekeyhq/components';
import { getTokens } from '@onekeyhq/components/src/hooks';
import { IMPL_BTC, IMPL_TBTC } from '@onekeyhq/shared/src/engine/engineConsts';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerHome,
} from '../../../components/AccountSelector';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { OnboardingOnMount } from '../../Onboarding/components';

import { HomeHeaderContainer } from './HomeHeaderContainer';
import { NFTListContainer } from './NFTListContainer';
import { TokenListContainerWithProvider } from './TokenListContainer';
import { TxHistoryListContainer } from './TxHistoryContainer';

function HomePage({ onPressHide }: { onPressHide: () => void }) {
  const screenWidth = useWindowDimensions().width;
  const sideBarWidth = getTokens().size.sideBarWidth.val;
  const intl = useIntl();
  const [isHide, setIsHide] = useState(false);

  const onRefresh = useCallback(() => {
    // tabsViewRef?.current?.setRefreshing(true);
  }, []);

  const tabs = useMemo(
    () => [
      {
        title: intl.formatMessage({
          id: 'asset__tokens',
        }),
        page: memo(TokenListContainerWithProvider, () => true),
      },
      {
        title: intl.formatMessage({
          id: 'asset__collectibles',
        }),
        page: memo(NFTListContainer, () => true),
      },
      // {
      //   title: 'Defi',
      //   page: memo(DefiListContainer, () => true),
      // },
      {
        title: intl.formatMessage({
          id: 'transaction__history',
        }),
        page: memo(TxHistoryListContainer, () => true),
      },
    ],
    [intl],
  );

  const headerTitle = useCallback(
    () =>
      isHide ? null : (
        <AccountSelectorProviderMirror
          enabledNum={[0]}
          config={{
            sceneName: EAccountSelectorSceneName.home,
            sceneUrl: '',
          }}
        >
          <AccountSelectorTriggerHome num={0} />
        </AccountSelectorProviderMirror>
      ),
    [isHide],
  );

  return useMemo(
    () => (
      <Page>
        <Page.Header headerTitle={headerTitle} />
        <Page.Body>
          {process.env.NODE_ENV !== 'production' ? (
            <Button
              onPress={async () => {
                setIsHide((v) => !v);
                await timerUtils.wait(1000);
                onPressHide();
              }}
            >
              home-hide-test
            </Button>
          ) : null}

          <Tab
            data={tabs}
            ListHeaderComponent={<HomeHeaderContainer />}
            initialScrollIndex={0}
            $md={{
              width: '100%',
            }}
            $gtMd={{
              width: screenWidth - sideBarWidth,
            }}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
          />
        </Page.Body>
      </Page>
    ),
    [headerTitle, tabs, screenWidth, sideBarWidth, onRefresh, onPressHide],
  );
}

function HomePageContainer() {
  const [isHide, setIsHide] = useState(false);
  console.log('HomePageContainer render');

  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    result: { networkIds },
  } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getNetworkIdsByImpls({
        impls: [
          IMPL_BTC,
          IMPL_TBTC,
          // IMPL_EVM,
        ],
      }),
    [],
    {
      initResult: {
        networkIds: [],
      },
    },
  );

  if (isHide) {
    return null;
  }
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
      // availableNetworksMap={{
      //   0: {
      //     networkIds, // support available networks
      //     defaultNetworkId: getNetworkIdsMap().tbtc, // default selected networkId
      //   },
      // }}
    >
      <HomePage onPressHide={() => setIsHide((v) => !v)} />
      <OnboardingOnMount />
    </AccountSelectorProviderMirror>
  );
}

export { HomePageContainer };
