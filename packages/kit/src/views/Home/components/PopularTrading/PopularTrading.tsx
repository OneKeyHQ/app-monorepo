import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { memo } from 'react';
import { ListView, Stack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';

function PopularTrading() {
  const { result: popularTradingTokens, isLoading } = usePromiseResult(
    async () => backgroundApiProxy.serviceSwap.fetchPopularTrading(),
    [],
    { watchLoading: true, initResult: [] },
  );

  console.log('popularTradingTokens', popularTradingTokens);

  return (
    <ListView
      data={popularTradingTokens}
      keyExtractor={(item) => `${item.networkId}-${item.symbol}`}
      renderItem={({ item }) => (
        <ListItem
          renderAvatar={
            <Token
              size="lg"
              tokenImageUri={item.logoURI}
              networkId={item.networkId}
              showNetworkIcon
            />
          }
          title={item.symbol}
        />
      )}
    />
  );
}

export default memo(PopularTrading);
