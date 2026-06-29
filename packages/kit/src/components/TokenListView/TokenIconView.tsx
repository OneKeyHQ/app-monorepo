import { memo, useMemo } from 'react';

import { useMedia } from '@onekeyhq/components';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { checkIsOnlyOneTokenHasBalance } from '@onekeyhq/shared/src/utils/tokenUtils';

import { useAggregateSubTokenFiatMap } from '../../states/jotai/contexts/tokenList/cells';
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

  const {
    allAggregateTokenMap,
    ownedAggregateTokenListMap,
    networksMap,
    tokenListMap: contextTokenListMap,
    useCellSeam,
  } = useTokenListViewContext();
  const allAggregateTokenList = useMemo(
    () => allAggregateTokenMap?.[$key]?.tokens ?? [],
    [allAggregateTokenMap, $key],
  );
  const aggregateTokenList = useMemo(
    () => ownedAggregateTokenListMap?.[$key]?.tokens ?? [],
    [ownedAggregateTokenListMap, $key],
  );
  const firstAggregateToken = aggregateTokenList?.[0];

  // Per-network sub-token fiat slice (red-team C-F2): the home cell-seam reads
  // the live sub-cells; non-cell paths read the host-provided map. NEVER the
  // summed aggCell — these keys are per-network sub-token `$key`s.
  const subTokenFiatMap = useAggregateSubTokenFiatMap({
    aggKey: $key,
    aggregateTokenList,
    useCellSeam,
    contextTokenListMap,
  });

  const { tokenHasBalance, tokenHasBalanceCount } = useMemo(() => {
    if (isAggregateToken) {
      return checkIsOnlyOneTokenHasBalance({
        tokenMap: subTokenFiatMap,
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
    subTokenFiatMap,
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
