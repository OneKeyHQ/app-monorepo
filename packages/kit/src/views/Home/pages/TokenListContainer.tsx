import { memo, useCallback, useState } from 'react';

import { useMedia } from 'tamagui';

import { Portal } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getMergedTokenData } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IToken, ITokenData } from '@onekeyhq/shared/types/token';

import { TokenListView } from '../../../components/TokenListView';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { EModalRoutes } from '../../../routes/Modal/type';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useTokenListActions,
  withTokenListProvider,
} from '../../../states/jotai/contexts/tokenList';
import { EModalAssetDetailRoutes } from '../../AssetDetails/router/types';
import { DEBOUNCE_INTERVAL, POLLING_INTERVAL_FOR_TOKEN } from '../constants';

import { WalletActionsContainer } from './WalletActionsContainer';

type IProps = {
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};

function TokenListContainer(props: IProps) {
  const { onContentSizeChange } = props;
  const [allTokens, setAllTokens] = useState<ITokenData>();

  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });

  const media = useMedia();
  const navigation = useAppNavigation();
  const {
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
        networkId: network.id,
        accountAddress: account.address,
        // for performance testing
        limit: 300,
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

      const mergedTokenData = getMergedTokenData({
        tokens: r.tokens,
        smallBalanceTokens: r.smallBalanceTokens,
        riskTokens: r.riskTokens,
      });

      setAllTokens(mergedTokenData.tokens);

      const mergedTokens = mergedTokenData.tokens.data;

      if (mergedTokens && mergedTokens.length) {
        void backgroundApiProxy.serviceToken.updateLocalTokens({
          networkId: network.id,
          tokens: mergedTokens,
        });
      }
    },
    [
      account,
      network,
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
        <WalletActionsContainer tokens={allTokens} />
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

const TokenListContainerWithProvider = memo(
  withTokenListProvider<IProps>(TokenListContainer),
);

export { TokenListContainer, TokenListContainerWithProvider };
