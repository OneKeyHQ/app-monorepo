import { memo, useMemo } from 'react';

import { checkIsOnlyOneTokenHasBalance } from '@onekeyhq/shared/src/utils/tokenUtils';

import { useAccountData } from '../../hooks/useAccountData';
import {
  useAggregateTokensListMapAtom,
  useAllTokenListMapAtom,
} from '../../states/jotai/contexts/tokenList';
import { Token } from '../Token';

import { useTokenListViewContext } from './TokenListViewContext';

type IProps = {
  $key: string;
  icon?: string;
  networkId: string | undefined;
  isAllNetworks?: boolean;
  showNetworkIcon?: boolean;
  isAggregateToken?: boolean;
};

function TokenIconView(props: IProps) {
  const {
    $key,
    icon,
    networkId,
    isAllNetworks,
    showNetworkIcon,
    isAggregateToken,
  } = props;

  const { network } = useAccountData({ networkId });

  const [aggregateTokensListMap] = useAggregateTokensListMapAtom();
  const { allAggregateTokenMap } = useTokenListViewContext();
  const [allTokenListMap] = useAllTokenListMapAtom();
  const allAggregateTokenList = useMemo(
    () => allAggregateTokenMap?.[$key]?.tokens ?? [],
    [allAggregateTokenMap, $key],
  );
  const aggregateTokenList = useMemo(
    () => aggregateTokensListMap[$key]?.tokens ?? [],
    [aggregateTokensListMap, $key],
  );
  const firstAggregateToken = aggregateTokenList?.[0];
  const { network: firstAggregateTokenNetwork } = useAccountData({
    networkId: firstAggregateToken?.networkId,
  });

  const { tokenHasBalance, tokenHasBalanceCount } = useMemo(() => {
    if (isAggregateToken) {
      return checkIsOnlyOneTokenHasBalance({
        tokenMap: allTokenListMap,
        aggregateTokenList,
        allAggregateTokenList,
      });
    }
    return {
      tokenHasBalance: undefined,
      tokenHasBalanceCount: 0,
    };
  }, [
    aggregateTokenList,
    allTokenListMap,
    allAggregateTokenList,
    isAggregateToken,
  ]);

  if (isAllNetworks && showNetworkIcon) {
    return (
      <Token
        size="lg"
        tokenImageUri={icon}
        networkImageUri={network?.logoURI}
        networkId={
          (firstAggregateTokenNetwork &&
            aggregateTokenList?.length === 1 &&
            allAggregateTokenList.length === 0) ||
          (tokenHasBalance && tokenHasBalanceCount === 1)
            ? tokenHasBalance?.networkId ?? firstAggregateTokenNetwork?.id ?? ''
            : networkId
        }
        showNetworkIcon
      />
    );
  }

  return <Token size="lg" tokenImageUri={icon} />;
}

export default memo(TokenIconView);
