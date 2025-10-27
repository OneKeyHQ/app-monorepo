import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  ListView,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAllAssetCtxsAtom,
  usePerpsAllAssetsFilteredAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { usePerpTokenSortConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { sortPerpsAssetIndices } from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IPerpTokenSortConfig,
  IPerpTokenSortField,
} from '@onekeyhq/shared/types/hyperliquid';

import { usePerpTokenSelector } from '../../hooks';
import { PerpsAccountSelectorProviderMirror } from '../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import { PerpTokenSelectorRow } from './PerpTokenSelectorRow';

function MobileTokenSelectorModal({
  onLoadingChange,
}: {
  onLoadingChange: (isLoading: boolean) => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const actions = useHyperliquidActions();
  const { searchQuery, setSearchQuery } = usePerpTokenSelector();

  const handleSelectToken = async (symbol: string) => {
    try {
      onLoadingChange(true);
      navigation.popStack();
      await actions.current.changeActiveAsset({ coin: symbol });
    } catch (error) {
      console.error('Failed to switch token:', error);
    } finally {
      onLoadingChange(false);
    }
  };

  const [{ assets }] = usePerpsAllAssetsFilteredAtom();
  const [{ assetCtxs }] = usePerpsAllAssetCtxsAtom();
  const [sortConfig, setSortConfig] = usePerpTokenSortConfigPersistAtom();

  const mockedListData = useMemo(() => {
    const sortedIndices = sortPerpsAssetIndices({
      assets,
      assetCtxs,
      sortField: sortConfig?.field ?? '',
      sortDirection: sortConfig?.direction ?? 'desc',
    });
    return sortedIndices.map((originalIndex) => ({
      index: originalIndex,
    }));
  }, [assets, assetCtxs, sortConfig]);

  const handleSortPress = useCallback(
    (field: IPerpTokenSortField) => {
      setSortConfig((prev: IPerpTokenSortConfig | null) => {
        if (prev?.field === field) {
          if (prev.direction === 'asc') {
            return null;
          }
          return { field, direction: 'asc' };
        }
        return { field, direction: 'desc' };
      });
    },
    [setSortConfig],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.token_selector_title })}
        headerSearchBarOptions={{
          placeholder: intl.formatMessage({
            id: ETranslations.global_search_asset,
          }),
          onChangeText: ({ nativeEvent }) => {
            const afterTrim = nativeEvent.text.trim();
            setSearchQuery(afterTrim);
          },
          searchBarInputValue: undefined, // keep value undefined to make SearchBar Input debounce works
        }}
      />
      <XStack
        px="$5"
        pb="$3"
        justifyContent="space-between"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
      >
        <XStack
          gap="$1"
          alignItems="center"
          onPress={() => handleSortPress('volume24h')}
          cursor="pointer"
          userSelect="none"
        >
          <SizableText
            size="$bodySm"
            color={sortConfig?.field === 'volume24h' ? '$text' : '$textSubdued'}
          >
            {intl.formatMessage({
              id: ETranslations.perp_token_selector_asset,
            })}{' '}
            /{' '}
            {intl.formatMessage({
              id: ETranslations.perp_token_selector_volume,
            })}
          </SizableText>
          {sortConfig?.field === 'volume24h' ? (
            <Icon
              name={
                sortConfig.direction === 'asc'
                  ? 'ChevronTopOutline'
                  : 'ChevronBottomOutline'
              }
              size="$3"
              color="$icon"
            />
          ) : null}
        </XStack>
        <XStack
          gap="$1"
          alignItems="center"
          onPress={() => handleSortPress('change24hPercent')}
          cursor="pointer"
          userSelect="none"
        >
          <SizableText
            size="$bodySm"
            color={
              sortConfig?.field === 'change24hPercent'
                ? '$text'
                : '$textSubdued'
            }
          >
            {intl.formatMessage({
              id: ETranslations.perp_token_selector_last_price,
            })}{' '}
            /{' '}
            {intl.formatMessage({
              id: ETranslations.perp_token_selector_24h_change,
            })}
          </SizableText>
          {sortConfig?.field === 'change24hPercent' ? (
            <Icon
              name={
                sortConfig.direction === 'asc'
                  ? 'ChevronTopOutline'
                  : 'ChevronBottomOutline'
              }
              size="$3"
              color="$icon"
            />
          ) : null}
        </XStack>
      </XStack>
      <Page.Body>
        <YStack flex={1} mt="$2">
          <ListView
            useFlashList
            contentContainerStyle={{
              paddingBottom: 10,
            }}
            data={mockedListData} // eslint-disable-line spellcheck/spell-checker
            renderItem={({ item: mockedToken }) => (
              <PerpTokenSelectorRow
                isOnModal
                mockedToken={mockedToken}
                onPress={(name) => handleSelectToken(name)}
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
      </Page.Body>
    </Page>
  );
}

function MobileTokenSelectorWithProvider() {
  return (
    <PerpsAccountSelectorProviderMirror>
      <PerpsProviderMirror>
        <MobileTokenSelectorModal onLoadingChange={() => {}} />
      </PerpsProviderMirror>
    </PerpsAccountSelectorProviderMirror>
  );
}

export default memo(MobileTokenSelectorWithProvider);
