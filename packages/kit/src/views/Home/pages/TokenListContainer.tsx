import { memo, useCallback, useEffect } from 'react';

import { CanceledError } from 'axios';

import {
  Portal,
  useMedia,
  useTabIsRefreshingFocused,
} from '@onekeyhq/components';
import type { ITabPageProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_TOKEN,
} from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EModalAssetDetailRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IToken } from '@onekeyhq/shared/types/token';

import { TokenListView } from '../../../components/TokenListView';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useTokenListActions } from '../../../states/jotai/contexts/tokenList';
import { HomeTokenListProviderMirror } from '../components/HomeTokenListProviderMirror';
import { WalletActions } from '../components/WalletActions';

function TokenListContainer(props: ITabPageProps) {
  const { onContentSizeChange } = props;
  const { isFocused } = useTabIsRefreshingFocused();

  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });

  const media = useMedia();
  const navigation = useAppNavigation();

  const {
    refreshAllTokenList,
    refreshAllTokenListMap,
    refreshTokenList,
    refreshTokenListMap,
    refreshRiskyTokenList,
    refreshRiskyTokenListMap,
    refreshSmallBalanceTokenList,
    refreshSmallBalanceTokenListMap,
    refreshSmallBalanceTokensFiatValue,
    updateTokenListState,
  } = useTokenListActions().current;

  usePromiseResult(
    async () => {
      try {
        if (!account || !network) return;

        await backgroundApiProxy.serviceToken.abortFetchAccountTokens();
        const accountAddress =
          await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
            accountId: account.id,
            networkId: network.id,
          });
        const blockedTokens =
          await backgroundApiProxy.serviceToken.getBlockedTokens({
            networkId: network.id,
          });
        const r = await backgroundApiProxy.serviceToken.fetchAccountTokens({
          mergeTokens: true,
          networkId: network.id,
          accountAddress,
          flag: 'home-token-list',
          xpub: await backgroundApiProxy.serviceAccount.getAccountXpub({
            accountId: account.id,
            networkId: network.id,
          }),
          blockedTokens: Object.keys(blockedTokens),
        });

        refreshTokenList({ keys: r.tokens.keys, tokens: r.tokens.data });
        refreshTokenListMap(r.tokens.map);
        refreshRiskyTokenList({
          keys: r.riskTokens.keys,
          riskyTokens: r.riskTokens.data,
        });
        refreshRiskyTokenListMap(r.riskTokens.map);
        refreshSmallBalanceTokenList({
          keys: r.smallBalanceTokens.keys,
          smallBalanceTokens: r.smallBalanceTokens.data,
        });
        refreshSmallBalanceTokenListMap(r.smallBalanceTokens.map);
        refreshSmallBalanceTokensFiatValue(
          r.smallBalanceTokens.fiatValue ?? '0',
        );

        if (r.allTokens) {
          refreshAllTokenList({
            keys: r.allTokens?.keys,
            tokens: r.allTokens?.data,
          });
          refreshAllTokenListMap(r.allTokens.map);
          const mergedTokens = r.allTokens.data;
          if (mergedTokens && mergedTokens.length) {
            void backgroundApiProxy.serviceToken.updateLocalTokens({
              networkId: network.id,
              tokens: mergedTokens,
            });
          }
          updateTokenListState({
            initialized: true,
            isRefreshing: false,
          });
        }
      } catch (e) {
        if (e instanceof CanceledError) {
          console.log('fetchAccountTokens canceled');
        } else {
          throw e;
        }
      }
    },
    [
      account,
      network,
      refreshTokenList,
      refreshTokenListMap,
      refreshRiskyTokenList,
      refreshRiskyTokenListMap,
      refreshSmallBalanceTokenList,
      refreshSmallBalanceTokenListMap,
      refreshSmallBalanceTokensFiatValue,
      updateTokenListState,
      refreshAllTokenList,
      refreshAllTokenListMap,
    ],
    {
      overrideIsFocused: (isPageFocused) => isPageFocused && isFocused,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_TOKEN,
    },
  );

  useEffect(() => {
    if (account?.id && network?.id && wallet?.id) {
      updateTokenListState({
        initialized: false,
        isRefreshing: true,
      });
    }
  }, [account?.id, network?.id, updateTokenListState, wallet?.id]);

  const handleOnPressToken = useCallback(
    (token: IToken) => {
      if (!account || !network) return;
      navigation.pushModal(EModalRoutes.MainModal, {
        screen: EModalAssetDetailRoutes.TokenDetails,
        params: {
          accountId: account.id,
          networkId: network.id,
          tokenInfo: token,
        },
      });
    },
    [account, navigation, network],
  );

  return (
    <>
      <Portal.Body container={Portal.Constant.WALLET_ACTIONS}>
        <WalletActions />
      </Portal.Body>
      <TokenListView
        withHeader
        withFooter
        withPrice
        onPressToken={handleOnPressToken}
        onContentSizeChange={onContentSizeChange}
        {...(media.gtLg && {
          tableLayout: true,
        })}
      />
    </>
  );
}

const TokenListContainerWithProvider = memo((props: ITabPageProps) => (
  <HomeTokenListProviderMirror>
    <TokenListContainer {...props} />
  </HomeTokenListProviderMirror>
));
TokenListContainerWithProvider.displayName = 'TokenListContainerWithProvider';

export { TokenListContainerWithProvider };
