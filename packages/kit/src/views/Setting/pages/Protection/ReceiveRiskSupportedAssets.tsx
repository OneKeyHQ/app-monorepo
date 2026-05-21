import { useCallback } from 'react';

import { Page, ScrollView, SectionList, YStack } from '@onekeyhq/components';
import HeaderIconButton from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderIconButton';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

type ISupportedToken = {
  symbol: string;
  name: string;
  tokenImageUri: string;
};

type ISupportedNetworkSection = {
  networkName: string;
  networkId: string;
  tokens: ISupportedToken[];
};

// Mock data — will be replaced by API response once backend ships.
// Reference: Confluence KYT spec P0 / P1 / P2 supported assets.
const USDT_IMAGE =
  'https://uni.onekey-asset.com/server-service-onekey/coin-images/Tether-USD-USDT.png';
const USDC_IMAGE =
  'https://uni.onekey-asset.com/server-service-onekey/coin-images/USD-Coin-USDC.png';

const MOCK_SUPPORTED_ASSETS: ISupportedNetworkSection[] = [
  {
    networkName: 'Tron',
    networkId: getNetworkIdsMap().trx,
    tokens: [
      { symbol: 'USDT', name: 'Tether USD', tokenImageUri: USDT_IMAGE },
      { symbol: 'USDC', name: 'USD Coin', tokenImageUri: USDC_IMAGE },
    ],
  },
  {
    networkName: 'Ethereum',
    networkId: getNetworkIdsMap().eth,
    tokens: [
      { symbol: 'USDT', name: 'Tether USD', tokenImageUri: USDT_IMAGE },
      { symbol: 'USDC', name: 'USD Coin', tokenImageUri: USDC_IMAGE },
    ],
  },
  {
    networkName: 'BNB Smart Chain',
    networkId: getNetworkIdsMap().bsc,
    tokens: [
      { symbol: 'USDT', name: 'Tether USD', tokenImageUri: USDT_IMAGE },
      { symbol: 'USDC', name: 'USD Coin', tokenImageUri: USDC_IMAGE },
    ],
  },
  {
    networkName: 'Base',
    networkId: getNetworkIdsMap().base,
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', tokenImageUri: USDC_IMAGE },
      { symbol: 'USDT', name: 'Tether USD', tokenImageUri: USDT_IMAGE },
    ],
  },
  {
    networkName: 'Solana',
    networkId: getNetworkIdsMap().sol,
    tokens: [
      { symbol: 'USDT', name: 'Tether USD', tokenImageUri: USDT_IMAGE },
      { symbol: 'USDC', name: 'USD Coin', tokenImageUri: USDC_IMAGE },
    ],
  },
  {
    networkName: 'Arbitrum',
    networkId: getNetworkIdsMap().arbitrum,
    tokens: [
      { symbol: 'USDT', name: 'Tether USD', tokenImageUri: USDT_IMAGE },
      { symbol: 'USDC', name: 'USD Coin', tokenImageUri: USDC_IMAGE },
    ],
  },
  {
    networkName: 'Polygon',
    networkId: getNetworkIdsMap().polygon,
    tokens: [
      { symbol: 'USDT', name: 'Tether USD', tokenImageUri: USDT_IMAGE },
      { symbol: 'USDC', name: 'USD Coin', tokenImageUri: USDC_IMAGE },
    ],
  },
  {
    networkName: 'Optimism',
    networkId: getNetworkIdsMap().optimism,
    tokens: [
      { symbol: 'USDT', name: 'Tether USD', tokenImageUri: USDT_IMAGE },
      { symbol: 'USDC', name: 'USD Coin', tokenImageUri: USDC_IMAGE },
    ],
  },
  {
    networkName: 'Avalanche',
    networkId: getNetworkIdsMap().avalanche,
    tokens: [
      { symbol: 'USDT', name: 'Tether USD', tokenImageUri: USDT_IMAGE },
      { symbol: 'USDC', name: 'USD Coin', tokenImageUri: USDC_IMAGE },
    ],
  },
];

const ReceiveRiskSupportedAssetsPage = () => {
  const headerRight = useCallback(
    () => (
      <HeaderIconButton
        icon="QuestionmarkOutline"
        onPress={() => {
          // TODO: open help / docs once content is ready.
        }}
      />
    ),
    [],
  );

  return (
    <Page>
      <Page.Header title="Supported assets" headerRight={headerRight} />
      <Page.Body>
        <ScrollView>
          <YStack pb="$10">
            {MOCK_SUPPORTED_ASSETS.map((section) => (
              <YStack key={section.networkName}>
                <SectionList.SectionHeader title={section.networkName} />
                {section.tokens.map((token) => (
                  <ListItem
                    key={`${section.networkName}-${token.symbol}`}
                    title={token.symbol}
                    subtitle={token.name}
                    renderAvatar={
                      <Token
                        size="lg"
                        tokenImageUri={token.tokenImageUri}
                        networkId={section.networkId}
                      />
                    }
                  />
                ))}
              </YStack>
            ))}
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
};

export default ReceiveRiskSupportedAssetsPage;
