import { memo } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { TokenListView } from '../../../components/TokenListView';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useTokenListActions,
  withTokenListProvider,
} from '../../../states/jotai/contexts/token-list';

type IProps = {
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};

function TokenListContainer(props: IProps) {
  const { onContentSizeChange } = props;
  const { refreshTokenList, refreshTokenListMap } = useTokenListActions();

  const promise = usePromiseResult(async () => {
    const r =
      await backgroundApiProxy.serviceToken.fetchAccountTokensForDeepRefresh({
        accountId: '',
        networkId: 'evm--1',
        accountAddress: '0x76f3f64cb3cD19debEE51436dF630a342B736C24',
      });
    refreshTokenList(r);
    refreshTokenListMap(r.map);
  }, [refreshTokenList, refreshTokenListMap]);

  return (
    <TokenListView
      isLoading={promise.isLoading}
      onContentSizeChange={onContentSizeChange}
    />
  );
}

const TokenListContainerWithProvider = memo(
  withTokenListProvider<IProps>(TokenListContainer),
);

export { TokenListContainer, TokenListContainerWithProvider };
