import { memo } from 'react';

import { useMedia } from 'tamagui';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { TokenListView } from '../../../components/TokenListView';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useTokenListActions,
  withTokenListProvider,
} from '../../../states/jotai/contexts/token-list';
import { DEBOUNCE_INTERVAL, POLLING_INTERVAL_FOR_TOKEN } from '../constants';

type IProps = {
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};

const networkId = 'evm--1';

function TokenListContainer(props: IProps) {
  const media = useMedia();
  const { onContentSizeChange } = props;
  const {
    refreshTokenList,
    refreshTokenListMap,
    refreshRiskyTokenList,
    refreshRiskyTokenListMap,
    refreshSmallBalanceTokenList,
    refreshSmallBalanceTokenListMap,
  } = useTokenListActions().current;

  const promise = usePromiseResult(
    async () => {
      const r = await backgroundApiProxy.serviceToken.fetchAccountTokens({
        networkId,
        accountAddress: '0x76f3f64cb3cD19debEE51436dF630a342B736C24',
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

      const allTokens = [
        ...r.tokens.data,
        ...r.riskTokens.data,
        ...r.smallBalanceTokens.data,
      ];

      if (allTokens && allTokens.length) {
        void backgroundApiProxy.serviceToken.updateLocalTokens({
          networkId,
          tokens: allTokens,
        });
      }
    },
    [
      refreshRiskyTokenList,
      refreshRiskyTokenListMap,
      refreshSmallBalanceTokenList,
      refreshSmallBalanceTokenListMap,
      refreshTokenList,
      refreshTokenListMap,
    ],
    {
      debounced: DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_TOKEN,
    },
  );

  return (
    <TokenListView
      withHeader
      withFooter
      isLoading={promise.isLoading}
      onContentSizeChange={onContentSizeChange}
      {...(media.gtLg && {
        tableLayout: true,
      })}
    />
  );
}

const TokenListContainerWithProvider = memo(
  withTokenListProvider<IProps>(TokenListContainer),
);

export { TokenListContainer, TokenListContainerWithProvider };
