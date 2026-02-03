import { memo, useMemo } from 'react';

import { useMedia } from '@onekeyhq/components';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { checkIsOnlyOneTokenHasBalance } from '@onekeyhq/shared/src/utils/tokenUtils';

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

  const { gtMd } = useMedia();

  const tokenSize = gtMd ? 'md' : 'lg';

  const [aggregateTokensListMap] = useAggregateTokensListMapAtom();
  const { allAggregateTokenMap, networksMap } = useTokenListViewContext();
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

  const selectedNetworkId =
    (firstAggregateToken?.networkId &&
      aggregateTokenList?.length === 1 &&
      allAggregateTokenList.length === 0) ||
    (tokenHasBalance && tokenHasBalanceCount === 1)
      ? (tokenHasBalance?.networkId ?? firstAggregateToken?.networkId ?? '')
      : (networkId ?? '');

  const network = useMemo(() => {
    if (!selectedNetworkId) {
      return undefined;
    }
    return (
      networksMap?.[selectedNetworkId] ??
      networkUtils.getLocalNetworkInfo(selectedNetworkId)
    );
  }, [networksMap, selectedNetworkId]);

  if (isAllNetworks && showNetworkIcon) {
    return (
      <Token
        size={tokenSize}
        tokenImageUri={icon}
        networkImageUri={network?.logoURI}
        networkId={selectedNetworkId}
        showNetworkIcon
      />
    );
  }

  return <Token size={tokenSize} tokenImageUri={icon} />;
}

export default memo(TokenIconView);
