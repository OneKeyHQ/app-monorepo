import { memo, useCallback } from 'react';

import { useMedia } from 'tamagui';

import { Portal } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IToken } from '@onekeyhq/shared/types/token';

import { TokenListView } from '../../../components/TokenListView';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { EModalRoutes } from '../../../routes/Modal/type';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useTokenListActions } from '../../../states/jotai/contexts/tokenList';
import { EModalAssetDetailRoutes } from '../../AssetDetails/router/types';
import { HomeTokenListProviderMirror } from '../components/HomeTokenListProviderMirror';
import { WalletActionsContainer } from '../components/WalletActions';
import { DEBOUNCE_INTERVAL, POLLING_INTERVAL_FOR_TOKEN } from '../constants';

type IProps = {
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};

function TokenListContainer(props: IProps) {
  const { onContentSizeChange } = props;

  const {
    activeAccount: { account, network },
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
  } = useTokenListActions().current;

  const promise = usePromiseResult(
    async () => {
      if (!account || !network) return;
      const r = await backgroundApiProxy.serviceToken.fetchAccountTokens({
        mergeTokens: true,
        networkId: network.id,
        accountAddress: account.address,
        // for performance testing
        limit: 300,
        flag: 'home-token-list',
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
      refreshSmallBalanceTokensFiatValue(r.smallBalanceTokens.fiatValue ?? '0');

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
      }
    },
    [
      account,
      network,
      refreshAllTokenList,
      refreshAllTokenListMap,
      refreshRiskyTokenList,
      refreshRiskyTokenListMap,
      refreshSmallBalanceTokenList,
      refreshSmallBalanceTokenListMap,
      refreshSmallBalanceTokensFiatValue,
      refreshTokenList,
      refreshTokenListMap,
    ],
    {
      debounced: DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_TOKEN,
      watchLoading: true,
    },
  );

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
        <WalletActionsContainer />
      </Portal.Body>
      <TokenListView
        withHeader
        withFooter
        withPrice
        isLoading={promise.isLoading}
        onPressToken={handleOnPressToken}
        onContentSizeChange={onContentSizeChange}
        {...(media.gtLg && {
          tableLayout: true,
        })}
      />
    </>
  );
}

const TokenListContainerWithProvider = memo((props: IProps) => (
  <HomeTokenListProviderMirror>
    <TokenListContainer {...props} />
  </HomeTokenListProviderMirror>
));
TokenListContainerWithProvider.displayName = 'TokenListContainerWithProvider';

export { TokenListContainerWithProvider };
