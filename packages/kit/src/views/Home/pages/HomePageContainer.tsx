import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { RefreshControl, useWindowDimensions } from 'react-native';

import { Page, Tab } from '@onekeyhq/components';
import { getTokens } from '@onekeyhq/components/src/hooks';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_BTC, IMPL_TBTC } from '@onekeyhq/shared/src/engine/engineConsts';
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

function HomePage() {
  const screenWidth = useWindowDimensions().width;
  const sideBarWidth = getTokens().size.sideBarWidth.val;
  const intl = useIntl();

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
    () => (
      <AccountSelectorProviderMirror
        enabledNum={[0]}
        config={{
          sceneName: EAccountSelectorSceneName.home,
          sceneUrl: '',
        }}
      >
        <AccountSelectorTriggerHome num={0} linkNetwork />
      </AccountSelectorProviderMirror>
    ),
    [],
  );

  return useMemo(
    () => (
      <Page>
        <Page.Header headerTitle={headerTitle} />
        <Page.Body>
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
    [headerTitle, tabs, screenWidth, sideBarWidth, onRefresh],
  );
}

function HomePageContainer() {
  console.log('HomePageContainer render');

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
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
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
      availableNetworksMap={{
        0: {
          networkIds, // support available networks
          defaultNetworkId: getNetworkIdsMap().tbtc, // default selected networkId
        },
      }}
    >
      <HomePage />
      <OnboardingOnMount />
    </AccountSelectorProviderMirror>
  );
}

export { HomePageContainer };
