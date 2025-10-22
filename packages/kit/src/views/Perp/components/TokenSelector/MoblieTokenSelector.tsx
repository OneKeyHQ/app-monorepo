import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  ListView,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsAllAssetsFilteredLengthAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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

  const [filteredTokensLength] = usePerpsAllAssetsFilteredLengthAtom();

  // cause ListView rerender
  // const [allAssetsFiltered] = usePerpsAllAssetsFilteredAtom();
  // console.log(allAssetsFiltered);

  const mockedListData = useMemo(() => {
    return Array.from({ length: filteredTokensLength }, (_, index) => ({
      index,
    }));
  }, [filteredTokensLength]);

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
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.perp_token_selector_asset,
          })}{' '}
          /{' '}
          {intl.formatMessage({
            id: ETranslations.perp_token_selector_volume,
          })}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.perp_token_selector_last_price,
          })}{' '}
          /{' '}
          {intl.formatMessage({
            id: ETranslations.perp_token_selector_24h_change,
          })}
        </SizableText>
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
