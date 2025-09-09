import { useState } from 'react';

import {
  Badge,
  Button,
  Icon,
  NumberSizeableText,
  Popover,
  ScrollView,
  SearchBar,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
  numberFormat,
} from '@onekeyhq/shared/src/utils/numberUtils';

// eslint-disable-next-line import-path/parent-depth
import { Token } from '../../../../components/Token';
import { usePerpTokenSelector } from '../../hooks';

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
      floatingPanelProps={{
        width: 700,
      }}
      open={isOpen}
      onOpenChange={setIsOpen}
      placement="bottom-start"
      renderTrigger={
        <Badge
          gap="$3"
          bg="$bgApp"
          cursor="pointer"
          hoverStyle={{
            p: '$2',
            borderRadius: '$full',
            bg: '$bgHover',
          }}
          pressStyle={{
            p: '$2',
            borderRadius: '$full',
            bg: '$bgActive',
          }}
        >
          <Token
            size="md"
            tokenImageUri={`https://app.hyperliquid.xyz/coins/${currentToken}.svg`}
            fallbackIcon="CryptoCoinOutline"
          />

          {/* Token Name */}
          <SizableText size="$heading2xl">{currentToken}</SizableText>
          <Icon name="ChevronBottomOutline" size="$4" />
          {isLoading ? <Spinner size="small" /> : null}
        </Badge>
      }
      renderContent={
        <YStack>
          <XStack px="$5" pt="$5">
            <SearchBar
              containerProps={{
                borderRadius: '$2',
              }}
              autoFocus
              placeholder="Search"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </XStack>
          <XStack
            px="$5"
            py="$3"
            borderBottomWidth="$px"
            borderBottomColor="$borderSubdued"
          >
            <XStack width={140} justifyContent="flex-start">
              <SizableText size="$bodySm" color="$textSubdued">
                Asset
              </SizableText>
            </XStack>
            <XStack width={80} justifyContent="flex-start">
              <SizableText size="$bodySm" color="$textSubdued">
                Last Price
              </SizableText>
            </XStack>
            <XStack width={120} justifyContent="flex-start">
              <SizableText size="$bodySm" color="$textSubdued">
                24h Change
              </SizableText>
            </XStack>
            <XStack width={100} justifyContent="flex-start">
              <SizableText size="$bodySm" color="$textSubdued">
                8h Funding
              </SizableText>
            </XStack>
            <XStack width={100} justifyContent="flex-start">
              <SizableText size="$bodySm" color="$textSubdued">
                24h Volume
              </SizableText>
            </XStack>
            <XStack flex={1} justifyContent="flex-end">
              <SizableText size="$bodySm" color="$textSubdued">
                Open Interest
              </SizableText>
            </XStack>
          </XStack>

          {/* Token List */}
          <ScrollView flex={1} maxHeight={300}>
            <YStack>
              {filteredTokens.length === 0 ? (
                <XStack p="$5" justifyContent="center">
                  <SizableText size="$bodySm" color="$textSubdued">
                    {searchQuery
                      ? 'No matching tokens found'
                      : 'Loading tokens...'}
                  </SizableText>
                </XStack>
              ) : (
                filteredTokens.map((token) =>
                  token.isDelisted ? null : (
                    <XStack
                      key={token.name}
                      onPress={() => handleSelectToken(token.name)}
                      borderRadius="$0"
                      justifyContent="flex-start"
                      hoverStyle={{ bg: '$bgHover' }}
                      px="$5"
                      py="$3"
                      cursor="pointer"
                    >
                      <XStack flex={1} alignItems="center">
                        {/* Token Info */}
                        <XStack
                          width={140}
                          justifyContent="flex-start"
                          gap="$2"
                          alignItems="center"
                        >
                          <Token
                            size="xs"
                            tokenImageUri={`https://app.hyperliquid.xyz/coins/${token.name}.svg`}
                            fallbackIcon="CryptoCoinOutline"
                          />
                          <SizableText size="$bodySmMedium">
                            {token.name}
                          </SizableText>
                          <Badge radius="$2" bg="$bgInfo">
                            <SizableText color="$textInfo" size="$bodySm">
                              {token.maxLeverage}x
                            </SizableText>
                          </Badge>
                        </XStack>

                        <XStack width={80} justifyContent="flex-start">
                          <NumberSizeableText
                            formatter="price"
                            size="$bodySmMedium"
                            color="$text"
                          >
                            {token.markPrice}
                          </NumberSizeableText>
                        </XStack>

                        <XStack width={120} justifyContent="flex-start">
                          <SizableText
                            size="$bodySm"
                            color={
                              token.change24hPercent > 0 ? '$green11' : '$red11'
                            }
                          >
                            {numberFormat(token.change24h, {
                              formatter: 'price',
                            })}{' '}
                            /{' '}
                            <NumberSizeableText
                              size="$bodySm"
                              color={
                                token.change24hPercent > 0
                                  ? '$green11'
                                  : '$red11'
                              }
                              formatter="priceChange"
                              formatterOptions={{ showPlusMinusSigns: true }}
                            >
                              {token.change24hPercent.toString()}
                            </NumberSizeableText>
                          </SizableText>
                        </XStack>
                        <XStack width={100} justifyContent="flex-start">
                          <SizableText size="$bodySm" color="$text">
                            {(Number(token.fundingRate) * 100).toFixed(4)}%
                          </SizableText>
                        </XStack>

                        <XStack width={100} justifyContent="flex-start">
                          <SizableText size="$bodySm" color="$text">
                            $
                            {formatDisplayNumber(
                              NUMBER_FORMATTER.marketCap(token.volume24h),
                            )}
                          </SizableText>
                        </XStack>

                        <XStack flex={1} justifyContent="flex-end">
                          <SizableText size="$bodySm" color="$text">
                            $
                            {formatDisplayNumber(
                              NUMBER_FORMATTER.marketCap(token.openInterest),
                            )}
                          </SizableText>
                        </XStack>
                      </XStack>
                    </XStack>
                  ),
                )
              )}
            </YStack>
          </ScrollView>
        </YStack>
      }
    />
  );
}

export { PerpTokenSelector };
