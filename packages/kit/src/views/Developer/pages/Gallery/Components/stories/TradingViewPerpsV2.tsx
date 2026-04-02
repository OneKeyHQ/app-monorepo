import { useState } from 'react';

import { Button, SizableText, Stack, XStack } from '@onekeyhq/components';
import { TradingViewPerpsV2 } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2';
import { ProviderJotaiContextHyperliquid } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

import { Layout } from './utils/Layout';

const TradingViewPerpsV2Gallery = () => {
  const [currentSymbol, setCurrentSymbol] = useState('BTC');

  const tokens = [
    { symbol: 'BTC', name: 'BTC' },
    { symbol: 'ETH', name: 'ETH' },
    { symbol: 'SOL', name: 'SOL' },
  ];

  return (
    <Layout
      getFilePath={() => __CURRENT_FILE_PATH__}
      componentName="TradingViewPerpsV2"
      elements={[
        {
          title: 'Perps Trading View - Symbol切换测试',
          element: (
            <ProviderJotaiContextHyperliquid>
              <Stack gap="$1">
                <XStack gap="$1" justifyContent="center">
                  {tokens.map((token) => (
                    <Button
                      key={token.symbol}
                      variant={
                        currentSymbol === token.symbol ? 'primary' : 'secondary'
                      }
                      size="small"
                      onPress={() => {
                        console.log(
                          `🔄 Switching symbol from ${currentSymbol} to ${token.symbol}`,
                        );
                        setCurrentSymbol(token.symbol);
                      }}
                    >
                      {token.name}
                    </Button>
                  ))}
                </XStack>

                <Stack alignItems="center">
                  <SizableText>Current Symbol: {currentSymbol}</SizableText>
                </Stack>

                <Stack w="100%" h={500}>
                  <TradingViewPerpsV2
                    symbol={currentSymbol}
                    userAddress="0x5618207d27D78F09f61A5D92190d58c453feB4b7"
                  />
                </Stack>
              </Stack>
            </ProviderJotaiContextHyperliquid>
          ),
        },
      ]}
    />
  );
};

export default TradingViewPerpsV2Gallery;
