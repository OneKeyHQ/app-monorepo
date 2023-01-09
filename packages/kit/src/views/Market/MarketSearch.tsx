import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Empty,
  Searchbar,
  Spinner,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { ModalProps } from '@onekeyhq/components/src/Modal';
import type { SelectProps } from '@onekeyhq/components/src/Select';
import type { HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';
import { HomeRoutes } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { showOverlay } from '../../utils/overlayUtils';
import { OverlayPanel } from '../Overlay/OverlayPanel';

import MarketSearchList from './Components/MarketSearch/MarketSearchList';
import MarketSearchTabView from './Components/MarketSearch/MarketSearchTabView';
import TokenTag from './Components/MarketSearch/TokenTag';
import { MARKET_FAKE_SKELETON_LIST_ARRAY } from './config';
import { useMarketSearchCategoryList } from './hooks/useMarketCategory';
import {
  useMarketSearchContainerStyle,
  useMarketSearchHistory,
  useMarketSearchSelectedCategory,
  useMarketSearchTokenChange,
  useMarketSearchTokens,
} from './hooks/useMarketSearch';

import type { MarketTokenItem } from '../../store/reducers/market';
import type { SearchTabItem } from './Components/MarketSearch/MarketSearchTabView';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ModalizeProps } from 'react-native-modalize';

type NavigationProps = NativeStackNavigationProp<HomeRoutesParams>;

const MarketSearch: FC<{
  closeOverlay: () => void;
}> = ({ closeOverlay }) => {
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const searchHistory = useMarketSearchHistory();
  const searchCategorys = useMarketSearchCategoryList();
  const searchSelectedCategory = useMarketSearchSelectedCategory();
  const { searchTokens, searchKeyword } = useMarketSearchTokens();
  const style = useMarketSearchContainerStyle();
  const navigation = useNavigation<NavigationProps>();
  const onTokenPress = useCallback(
    (marketTokenItem: MarketTokenItem) => {
      closeOverlay();
      navigation.navigate(HomeRoutes.MarketDetail, {
        marketTokenId: marketTokenItem.coingeckoId,
      });
      backgroundApiProxy.serviceMarket.saveSearchHistory({
        coingeckoId: marketTokenItem.coingeckoId,
        iconUrl: marketTokenItem.logoURI ?? marketTokenItem.image ?? '',
        symbol: marketTokenItem.symbol ?? '',
      });
    },
    [navigation, closeOverlay],
  );

  const options = useMemo<SearchTabItem[]>(
    () =>
      searchCategorys.map((c) => ({
        tabId: c.categoryId,
        name: c.name ?? '',
        // eslint-disable-next-line react/no-unstable-nested-components
        view: () => (
          <MarketSearchList
            onPress={onTokenPress}
            data={
              !c.coingeckoIds?.length
                ? MARKET_FAKE_SKELETON_LIST_ARRAY
                : c.coingeckoIds
            }
          />
        ),
      })),
    [onTokenPress, searchCategorys],
  );

  const searchSelectedCategoryIndex = useMemo(
    () =>
      searchCategorys.findIndex((c) => c.categoryId === searchSelectedCategory),
    [searchCategorys, searchSelectedCategory],
  );

  const searchContent = useMemo(() => {
    if (searchKeyword?.length) {
      return (
        <Box flex={1} mt="3">
          <Typography.Subheading ml={2} mb="3">
            {intl.formatMessage({ id: 'form__search_results_uppercase' })}
          </Typography.Subheading>
          {searchTokens ? (
            <MarketSearchList data={searchTokens} onPress={onTokenPress} />
          ) : (
            <Center w="full" h="300px">
              <Spinner size="lg" />
            </Center>
          )}
        </Box>
      );
    }
    return searchCategorys?.length ? (
      <Box flex={1}>
        {searchHistory?.length ? (
          <>
            <Box flexDirection="row" justifyContent="space-between" mb={2}>
              <Typography.Subheading>
                {intl.formatMessage({
                  id: 'form__recent_searched_uppercase',
                })}
              </Typography.Subheading>
              <Button
                type="plain"
                size="xs"
                leftIconName="TrashMini"
                iconSize={16}
                mr="2"
                onPress={() => {
                  backgroundApiProxy.serviceMarket.clearSearchHistory();
                }}
              >
                {intl.formatMessage({ id: 'action__clear_all' })}
              </Button>
            </Box>
            <Box mb={2} flexDirection="row" flexWrap="wrap">
              {searchHistory.map((t, i) => (
                <TokenTag
                  onPress={() => {
                    // goto marketoken detail
                    onTokenPress({
                      coingeckoId: t.coingeckoId,
                      image: t.iconUrl,
                      symbol: t.symbol,
                    });
                  }}
                  name={t.symbol}
                  logoURI={t.iconUrl}
                  key={i}
                />
              ))}
            </Box>
          </>
        ) : null}
        {searchSelectedCategoryIndex >= 0 ? (
          <MarketSearchTabView
            onTabChange={(index) => {
              backgroundApiProxy.serviceMarket.setMarketSearchTab(
                searchCategorys[index].categoryId,
              );
            }}
            options={options}
            navigationStateIndex={searchSelectedCategoryIndex}
          />
        ) : null}
      </Box>
    ) : (
      <Center flex={1}>
        <Empty
          title={intl.formatMessage({ id: 'title__no_history' })}
          subTitle={intl.formatMessage({
            id: 'content__search_for_token_name_or_contract_address',
          })}
          emoji="🕓"
        />
      </Center>
    );
  }, [
    searchKeyword?.length,
    searchCategorys,
    searchHistory,
    intl,
    searchSelectedCategoryIndex,
    options,
    searchTokens,
    onTokenPress,
  ]);
  const [searchInput, setSearchInput] = useState(() => '');
  const searchOnChangeDebounce = useMarketSearchTokenChange();
  return (
    <Box {...style} mt={1}>
      {isVertical ? (
        <Searchbar
          placeholder={intl.formatMessage({ id: 'form__search_tokens' })}
          value={searchInput}
          autoFocus
          w="full"
          mb={7}
          onChangeText={(text) => {
            setSearchInput(text);
            searchOnChangeDebounce(text);
          }}
          onClear={() => {
            setSearchInput('');
            searchOnChangeDebounce('');
          }}
        />
      ) : null}
      {searchContent}
    </Box>
  );
};

export const showMarketSearch = ({
  modalProps,
  triggerEle,
  modalLizeProps,
  searchOnChangeDebounce,
}: {
  modalProps?: ModalProps;
  triggerEle?: SelectProps['triggerEle'];
  modalLizeProps?: ModalizeProps;
  searchOnChangeDebounce: (text: string) => void;
}) =>
  showOverlay((closeOverlay) => (
    <OverlayPanel
      triggerEle={triggerEle}
      closeOverlay={() => {
        searchOnChangeDebounce('');
        closeOverlay();
      }}
      modalProps={modalProps}
      modalLizeProps={modalLizeProps}
      dropdownPosition="left"
      dropdownStyle={{ w: '360px', bg: 'surface-default', p: 0 }}
    >
      <MarketSearch closeOverlay={closeOverlay} />
    </OverlayPanel>
  ));
