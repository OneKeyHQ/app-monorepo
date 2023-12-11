import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { RefreshControl, useWindowDimensions } from 'react-native';

import { Page, Tab, XStack } from '@onekeyhq/components';
import { getTokens } from '@onekeyhq/components/src/hooks';

import { HomeHeaderContainer } from './HomeHeaderContainer';
import { NFTListContainer } from './NFTListContainer';
import { TokenListContainerWithProvider } from './TokenListContainer';
import { ToolListContainer } from './ToolListContainer';
import { TxHistoryListContainer } from './TxHistoryContainer';
import { WalletActionsContainer } from './WalletActionsContainer';
import { WalletOverviewContainer } from './WalletOverviewContainer';

function HomePageContainer() {
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
      {
        title: intl.formatMessage({
          id: 'transaction__history',
        }),
        page: memo(TxHistoryListContainer, () => true),
      },
      {
        title: intl.formatMessage({
          id: 'form__tools',
        }),
        page: memo(ToolListContainer, () => true),
      },
    ],
    [intl],
  );

  const renderHeaderView = useCallback(
    () => (
      <XStack justifyContent="space-between" alignItems="center">
        <WalletOverviewContainer />
        <WalletActionsContainer />
      </XStack>
    ),
    [],
  );

  return useMemo(
    () => (
      <Page>
        <Page.Header headerTitle={() => <HomeHeaderContainer />} />
        <Page.Body alignItems="center">
          <Tab
            // @ts-expect-error
            data={tabs}
            ListHeaderComponent={<>{renderHeaderView()}</>}
            initialScrollIndex={0}
            $md={{
              width: '100%',
            }}
            $gtMd={{
              width: screenWidth - sideBarWidth - 150,
              maxWidth: 1024,
            }}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
          />
        </Page.Body>
      </Page>
    ),
    [screenWidth, sideBarWidth, onRefresh, renderHeaderView, tabs],
  );
}

export { HomePageContainer };
