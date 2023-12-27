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

function TokenListContainer(props: IProps) {
  const media = useMedia();
  const { onContentSizeChange } = props;
  const { refreshTokenList, refreshTokenListMap } =
    useTokenListActions().current;

  const promise = usePromiseResult(
    async () => {
      const r =
        await backgroundApiProxy.serviceToken.fetchAccountTokensForDeepRefresh({
          accountId: '',
          networkId: 'evm--1',
          accountAddress: '0x76f3f64cb3cD19debEE51436dF630a342B736C24',
          // for performance testing
          limit: 300,
        });
      refreshTokenList(r);
      refreshTokenListMap(r.map);
    },
    [refreshTokenList, refreshTokenListMap],
    {
      debounced: DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_TOKEN,
    },
  );

  return (
    <TokenListView
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
