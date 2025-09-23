import { memo } from 'react';

import { useAccountData } from '../../hooks/useAccountData';
import { useAggregateTokensListMapAtom } from '../../states/jotai/contexts/tokenList';
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
  const { $key, icon, networkId, isAllNetworks, showNetworkIcon } = props;

  const { network } = useAccountData({ networkId });

  const [aggregateTokensListMap] = useAggregateTokensListMapAtom();
  const { allAggregateTokenMap } = useTokenListViewContext();
  const allAggregateTokenList = allAggregateTokenMap?.[$key]?.tokens ?? [];
  const aggregateTokenList = aggregateTokensListMap[$key]?.tokens ?? [];
  const firstAggregateToken = aggregateTokenList?.[0];
  const { network: firstAggregateTokenNetwork } = useAccountData({
    networkId: firstAggregateToken?.networkId,
  });

  if (isAllNetworks && showNetworkIcon) {
    return (
      <Token
        size="lg"
        tokenImageUri={icon}
        networkImageUri={network?.logoURI}
        networkId={
          firstAggregateTokenNetwork &&
          aggregateTokenList?.length === 1 &&
          allAggregateTokenList.length === 0
            ? firstAggregateTokenNetwork.id
            : networkId
        }
        showNetworkIcon
      />
    );
  }

  return <Token size="lg" tokenImageUri={icon} />;
}

export default memo(TokenIconView);
