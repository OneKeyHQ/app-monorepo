import { memo, useEffect, useMemo, useState } from 'react';

import {
  Badge,
  Icon,
  ListView,
  Popover,
  SearchBar,
  SizableText,
  Spinner,
  XStack,
  YStack,
  usePopoverContext,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { useCurrentTokenAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

import { usePerpTokenSelector } from '../../hooks';

import { PerpTokenSelectorRow } from './PerpTokenSelectorRow';

function BasePerpTokenSelectorContent({
  onLoadingChange,
}: {
  onLoadingChange: (isLoading: boolean) => void;
}) {
  const { closePopover } = usePopoverContext();
  const {
    searchQuery,
    setSearchQuery,
    filteredTokens,
    selectToken,
    isLoading,
  } = usePerpTokenSelector();

  useEffect(() => {
    onLoadingChange(isLoading);
  }, [isLoading, onLoadingChange]);

  const handleSelectToken = async (symbol: string) => {
    try {
      await selectToken(symbol);
      await closePopover?.();
    } catch (error) {
      console.error('Failed to switch token:', error);
    }
  };

  return (
    <YStack>
      <YStack gap="$2">
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
      </YStack>

      {/* Token List */}
      <YStack flex={1} maxHeight={300}>
        <ListView
          useFlashList
          data={filteredTokens.filter((token) => !token.isDelisted)}
          renderItem={({ item: token }) => (
            <PerpTokenSelectorRow
              token={token}
              onPress={() => handleSelectToken(token.name)}
            />
          )}
          ListEmptyComponent={
            <XStack p="$5" justifyContent="center">
              <SizableText size="$bodySm" color="$textSubdued">
                {searchQuery ? 'No matching tokens found' : 'Loading tokens...'}
              </SizableText>
            </XStack>
          }
        />
      </YStack>
    </YStack>
  );
}

function PerpTokenSelectorContent({
  isOpen,
  onLoadingChange,
}: {
  isOpen: boolean;
  onLoadingChange: (isLoading: boolean) => void;
}) {
  return isOpen ? (
    <BasePerpTokenSelectorContent onLoadingChange={onLoadingChange} />
  ) : null;
}

const PerpTokenSelectorContentMemo = memo(PerpTokenSelectorContent);

function BasePerpTokenSelector() {
  const themeVariant = useThemeVariant();
  const [isOpen, setIsOpen] = useState(false);
  const [currentToken] = useCurrentTokenAtom();
  const [isLoading, setIsLoading] = useState(false);
  return useMemo(
    () => (
      <Popover
        title="Select Token"
        floatingPanelProps={{
          width: 680,
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
              borderRadius="$full"
              bg={themeVariant === 'light' ? null : '$bgInverse'}
              tokenImageUri={`https://app.hyperliquid.xyz/coins/${currentToken}.svg`}
              fallbackIcon="CryptoCoinOutline"
            />

            {/* Token Name */}
            <SizableText size="$heading2xl">{currentToken}</SizableText>
            <Icon name="ChevronBottomOutline" size="$4" />
            {isLoading ? <Spinner size="small" /> : null}
          </Badge>
        }
        renderContent={({ isOpen: isOpenProp }) => (
          <PerpTokenSelectorContentMemo
            isOpen={isOpenProp ?? false}
            onLoadingChange={setIsLoading}
          />
        )}
      />
    ),
    [isOpen, currentToken, isLoading, themeVariant],
  );
}

export const PerpTokenSelector = memo(BasePerpTokenSelector);
