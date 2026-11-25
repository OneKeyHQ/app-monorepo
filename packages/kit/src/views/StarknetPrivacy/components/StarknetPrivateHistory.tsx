import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Stack, YStack } from '@onekeyhq/components';
import { AppPagerContent } from '@onekeyhq/kit/src/components/AppPager/AppPagerContent';
import { useAppPagerPage } from '@onekeyhq/kit/src/components/AppPager/useAppPagerPage';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { TokenDetailsPaginationObserver } from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/TokenDetailsPager';
import { TokenPrivacyPanel } from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/TokenPrivacyPanel';
import { withBrowserProvider } from '@onekeyhq/kit/src/views/Discovery/pages/Browser/WithBrowserProvider';
import { NativeHistoryList } from '@onekeyhq/kit/src/views/Home/components/HomeHistoryListView/NativeHistoryList';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EStrk20ErrorCode } from '@onekeyhq/shared/types/starknetPrivacy';

import { useStarknetPrivateHistory } from '../hooks/useStarknetPrivateHistory';
import { formatMockMessage } from '../utils/starknetPrivacyUtils';

import type { IProps } from '../../AssetDetails/pages/TokenDetails';

const HistoryList = withBrowserProvider(NativeHistoryList);
const padding = { top: 0, bottom: 0 };
const ignoreScroll = () => undefined;

function PrivateHistoryContent(
  props: IProps & { focused: boolean; scrollHost?: HTMLElement | null },
) {
  const {
    networkId,
    accountId,
    tokenInfo,
    focused,
    ListHeaderComponent,
    scrollHost,
  } = props;
  const intl = useIntl();
  const navigation = useAppNavigation();
  const history = useStarknetPrivateHistory({
    networkId,
    accountId,
    tokenAddress: tokenInfo.address,
    focused,
  });
  const onPress = useCallback(
    (tx: IAccountHistoryTx) => {
      if (!focused) return;
      navigation.push(EModalAssetDetailRoutes.HistoryDetails, {
        networkId,
        accountId,
        accountAddress: tx.decodedTx.owner,
        historyTx: tx,
      });
    },
    [accountId, focused, navigation, networkId],
  );
  const blocked = Boolean(history.errorKey);
  const header = (
    <YStack>
      {ListHeaderComponent as React.ReactElement}
      {history.errorKey && history.errorCode !== EStrk20ErrorCode.Locked ? (
        <Stack px="$5" pb="$3">
          <TokenPrivacyPanel
            state="error"
            title={formatMockMessage(intl, history.errorKey)}
            onSync={history.reload}
            busy={history.isLoading}
          />
        </Stack>
      ) : null}
    </YStack>
  );
  const hasWebPager = !platformEnv.isNative && props.isTabView;
  let footer: React.ReactElement | null = null;
  if (history.moreErrorKey)
    footer = (
      <Stack px="$5" py="$3">
        <TokenPrivacyPanel
          state="error"
          title={formatMockMessage(intl, history.moreErrorKey)}
          onSync={history.loadMore}
          busy={history.loadingMore}
        />
      </Stack>
    );
  else if (history.hasMore && !hasWebPager)
    footer = (
      <Button
        testID="starknet-private-history-more"
        alignSelf="center"
        size="small"
        loading={history.loadingMore}
        onPress={history.loadMore}
      >
        {intl.formatMessage({ id: ETranslations.global_view_more })}
      </Button>
    );
  const list = (
    <HistoryList
      hideValue
      showIcon={false}
      showFooter={false}
      showViewInExplorer={false}
      hideUndatedHeaders
      refreshEnabled={false}
      isAllNetworks={false}
      walletId={props.walletId}
      accountId={accountId}
      networkId={networkId}
      indexedAccountId={props.indexedAccountId}
      inTabList={props.inTabList}
      initialized={history.initialized}
      data={history.txs}
      onPressHistory={onPress}
      ListHeaderComponent={header}
      ListEmptyComponent={
        blocked || history.hasMore || history.isEnabled === false
          ? null
          : undefined
      }
      isSingleAccount
      onEndReached={
        focused && !history.moreErrorKey ? history.loadMore : undefined
      }
      isLoadingMore={history.loadingMore}
      hasMore={history.hasMore}
      webScrollHost={scrollHost}
      webContentPadding={padding}
      frozenTopEnabled={false}
      frozenTopIdentityKey={[networkId, accountId, tokenInfo.address].join('|')}
      observeFrozenTop={false}
      onAwayFromTopChange={ignoreScroll}
      ListFooterComponent={footer}
    />
  );
  if (!hasWebPager) return list;
  return (
    <>
      {list}
      <TokenDetailsPaginationObserver
        enabled={
          focused && history.initialized && !blocked && !history.moreErrorKey
        }
        hasMore={history.hasMore}
        isLoadingMore={history.loadingMore}
        progressKey={[
          networkId,
          accountId,
          tokenInfo.address,
          history.txs.length,
          history.txs.at(-1)?.id,
        ].join('|')}
        onEndReached={history.loadMore}
        onEndReachedThreshold={0.2}
        padding={padding}
      />
    </>
  );
}

function PrivateHistoryWithTab(props: IProps) {
  const pager = useAppPagerPage();
  const routeFocused = useRouteIsFocused();
  const focused = pager.isFocused && routeFocused;
  return (
    <AppPagerContent>
      <PrivateHistoryContent
        {...props}
        focused={focused}
        scrollHost={
          !platformEnv.isNative ? (focused && pager.owner) || null : undefined
        }
      />
    </AppPagerContent>
  );
}

export function StarknetPrivateHistory(props: IProps) {
  const routeFocused = useRouteIsFocused();
  return props.isTabView ? (
    <PrivateHistoryWithTab {...props} />
  ) : (
    <PrivateHistoryContent {...props} focused={routeFocused} />
  );
}
