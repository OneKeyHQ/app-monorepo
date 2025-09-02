import { useState } from 'react';

import {
  Button,
  Icon,
  Image,
  Input,
  Popover,
  ScrollView,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { usePerpTokenSelector } from '../../hooks';

function AssetIcon({ symbol }: { symbol: string }) {
  // Use Hyperliquid's icon URL pattern
  const iconUrl = `https://app.hyperliquid.xyz/coins/${symbol}.svg`;

  return (
    <Image
      source={{ uri: iconUrl }}
      size={24}
      borderRadius={12}
      fallback={<Icon name="EthereumSolid" size="$6" />}
    />
  );
}

function PerpTokenSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    currentToken,
    searchQuery,
    setSearchQuery,
    filteredTokens,
    selectToken,
    isLoading,
  } = usePerpTokenSelector();

  const handleSelectToken = async (symbol: string) => {
    try {
      await selectToken(symbol);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to switch token:', error);
    }
  };

  return (
    <Popover
      title="Select Token"
      open={isOpen}
      onOpenChange={setIsOpen}
      placement="bottom-start"
      renderTrigger={
        <Button
          size="medium"
          iconAfter="ChevronDownSmallOutline"
          disabled={isLoading}
        >
          <XStack alignItems="center" space="$2">
            {/* Token Icon */}
            <AssetIcon symbol={currentToken || 'ETH'} />

            {/* Token Name */}
            <SizableText size="$bodyLg" fontWeight="600">
              {currentToken || 'ETH'}-USD
            </SizableText>

            {isLoading ? <Spinner size="small" /> : null}
          </XStack>
        </Button>
      }
      renderContent={
        <YStack width={800} maxHeight={500}>
          {/* Search Input */}
          <XStack
            p="$3"
            borderBottomWidth="$px"
            borderBottomColor="$borderSubdued"
          >
            <Input
              placeholder="Search tokens..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              leftIconName="SearchOutline"
              flex={1}
              size="small"
            />
          </XStack>

          {/* Column Headers */}
          <XStack
            p="$3"
            pb="$2"
            borderBottomWidth="$px"
            borderBottomColor="$borderSubdued"
            bg="$bgSubtle"
          >
            <XStack flex={1} justifyContent="flex-start">
              <SizableText size="$bodySm" color="$textSubdued" fontWeight="600">
                Symbol
              </SizableText>
            </XStack>
            <XStack width={80} justifyContent="center">
              <SizableText size="$bodySm" color="$textSubdued" fontWeight="600">
                Price
              </SizableText>
            </XStack>
            <XStack width={80} justifyContent="center">
              <SizableText size="$bodySm" color="$textSubdued" fontWeight="600">
                24h %
              </SizableText>
            </XStack>
          </XStack>

          {/* Token List */}
          <ScrollView flex={1} maxHeight={300}>
            <YStack>
              {filteredTokens.length === 0 ? (
                <XStack p="$4" justifyContent="center">
                  <SizableText size="$bodySm" color="$textSubdued">
                    {searchQuery
                      ? 'No matching tokens found'
                      : 'Loading tokens...'}
                  </SizableText>
                </XStack>
              ) : (
                filteredTokens.map((token) => (
                  <Button
                    key={token.name}
                    variant="tertiary"
                    size="medium"
                    onPress={() => handleSelectToken(token.name)}
                    borderRadius="$0"
                    justifyContent="flex-start"
                    hoverStyle={{ bg: '$bgHover' }}
                    p="$3"
                  >
                    <XStack flex={1} alignItems="center">
                      {/* Token Info */}
                      <XStack flex={1} alignItems="center" space="$3">
                        <AssetIcon symbol={token.name} />
                        <YStack alignItems="flex-start">
                          <XStack alignItems="center" space="$2">
                            <SizableText size="$bodyMd" fontWeight="600">
                              {token.name}-USD
                            </SizableText>
                          </XStack>
                          <SizableText size="$bodySm" color="$textSubdued">
                            {token.name}
                          </SizableText>
                        </YStack>
                      </XStack>

                      <XStack width={80} justifyContent="center">
                        <SizableText size="$bodySm" color="$textSubdued">
                          {token.markPrice}
                        </SizableText>
                      </XStack>

                      {/* Change - Placeholder for now */}
                      <XStack width={80} justifyContent="center">
                        <SizableText
                          size="$bodySm"
                          color={
                            token.change24hPercent > 0 ? '$green8' : '$red8'
                          }
                        >
                          {token.change24hPercent > 0 ? '+' : ''}
                          {token.change24h} /{' '}
                          {token.change24hPercent > 0 ? '+' : ''}
                          {token.change24hPercent.toFixed(2)}%
                        </SizableText>
                      </XStack>
                    </XStack>
                  </Button>
                ))
              )}
            </YStack>
          </ScrollView>
        </YStack>
      }
    />
  );
}

export { PerpTokenSelector };
