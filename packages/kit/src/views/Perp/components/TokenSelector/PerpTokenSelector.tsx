import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  DebugRenderTracker,
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
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsActiveAssetAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { usePerpTokenSelector } from '../../hooks';

import { PerpTokenSelectorRow } from './PerpTokenSelectorRow';

function TokenListHeader() {
  const intl = useIntl();
  return (
    <XStack
      px="$5"
      py="$3"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
    >
      <XStack width={150} justifyContent="flex-start">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.perp_token_selector_asset,
          })}
        </SizableText>
      </XStack>
      <XStack width={100} justifyContent="flex-start">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.perp_token_selector_last_price,
          })}
        </SizableText>
      </XStack>
      <XStack width={120} justifyContent="flex-start">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.perp_token_selector_24h_change,
          })}
        </SizableText>
      </XStack>
      <XStack width={100} justifyContent="flex-start">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.perp_position_funding,
          })}
        </SizableText>
      </XStack>
      <XStack width={100} justifyContent="flex-start">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.perp_token_selector_volume,
          })}
        </SizableText>
      </XStack>
      <XStack flex={1} justifyContent="flex-end">
        <SizableText size="$bodySm" color="$textSubdued" textAlign="right">
          {intl.formatMessage({
            id: ETranslations.perp_token_bar_open_Interest,
          })}
        </SizableText>
      </XStack>
    </XStack>
  );
}

function BasePerpTokenSelectorContent({
  onLoadingChange,
}: {
  onLoadingChange: (isLoading: boolean) => void;
}) {
  const intl = useIntl();
  const { searchQuery, setSearchQuery, filteredTokens } =
    usePerpTokenSelector();
  const { closePopover } = usePopoverContext();
  const actions = useHyperliquidActions();

  const handleSelectToken = useCallback(
    async (symbol: string) => {
      try {
        onLoadingChange(true);
        void closePopover?.();
        await actions.current.changeActiveAsset({ coin: symbol });
      } catch (error) {
        console.error('Failed to switch token:', error);
      } finally {
        onLoadingChange(false);
      }
    },
    [closePopover, actions, onLoadingChange],
  );

  const content = (
    <YStack>
      <YStack gap="$2">
        <XStack px="$5" pt="$5">
          <SearchBar
            containerProps={{
              borderRadius: '$2',
            }}
            autoFocus
            placeholder={intl.formatMessage({
              id: ETranslations.global_search_asset,
            })}
            onChangeText={setSearchQuery}
            // value={searchQuery} // keep value undefined to make debounce works
          />
        </XStack>
        <TokenListHeader />
      </YStack>

      {/* Token List */}
      <YStack flex={1} height={300}>
        <ListView
          useFlashList
          contentContainerStyle={{
            paddingBottom: 10,
          }}
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
                {searchQuery
                  ? intl.formatMessage({
                      id: ETranslations.perp_token_selector_empty,
                    })
                  : intl.formatMessage({
                      id: ETranslations.perp_token_selector_loading,
                    })}
              </SizableText>
            </XStack>
          }
        />
      </YStack>
    </YStack>
  );
  return (
    <DebugRenderTracker
      timesBadgePosition="top-right"
      name="PerpTokenSelectorContent"
    >
      {content}
    </DebugRenderTracker>
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
  const [currentToken] = usePerpsActiveAssetAtom();
  const { coin } = currentToken;
  const [isLoading, setIsLoading] = useState(false);
  return useMemo(
    () => (
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
              borderRadius="$full"
              bg={themeVariant === 'light' ? null : '$bgInverse'}
              tokenImageUri={`https://app.hyperliquid.xyz/coins/${coin}.svg`}
              fallbackIcon="CryptoCoinOutline"
            />

            {/* Token Name */}
            <SizableText size="$heading2xl">{coin}</SizableText>
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
    [isOpen, coin, isLoading, themeVariant],
  );
}

export const PerpTokenSelector = memo(BasePerpTokenSelector);
