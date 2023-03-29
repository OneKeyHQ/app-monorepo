import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Button,
  Center,
  Empty,
  HStack,
  Modal,
  Searchbar,
  Spinner,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import NavigationButton from '@onekeyhq/components/src/Modal/Container/Header/NavigationButton';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { HomeRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import MarketSearchList from './Components/MarketSearch/MarketSearchList';
import MarketSearchTabView from './Components/MarketSearch/MarketSearchTabView';
import TokenTag from './Components/MarketSearch/TokenTag';
import { MARKET_FAKE_SKELETON_LIST_ARRAY } from './config';
import { useMarketSearchCategoryList } from './hooks/useMarketCategory';
import {
  useMarketSearchHistory,
  useMarketSearchSelectedCategory,
  useMarketSearchTokenChange,
  useMarketSearchTokens,
} from './hooks/useMarketSearch';

import type { MarketTokenItem } from '../../store/reducers/market';
import type { SearchTabItem } from './Components/MarketSearch/MarketSearchTabView';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<HomeRoutesParams>;

const MarketSearch: FC<{
  closeOverlay: () => void;
}> = ({ closeOverlay }) => {
  const intl = useIntl();
  const searchHistory = useMarketSearchHistory();
  const searchCategorys = useMarketSearchCategoryList();
  const searchSelectedCategory = useMarketSearchSelectedCategory();
  const { searchTokens, searchKeyword } = useMarketSearchTokens();
  const isVertical = useIsVerticalLayout();
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
  return (
    <Box flex={1} px={isVertical ? 4 : 6} mt={isVertical ? 3 : 5}>
      {searchContent}
    </Box>
  );
};

type SearchHeaderProps = {
  keyword: string;
  setKeyword: (keyword: string) => void;
};

const SearchHeader: FC<SearchHeaderProps> = ({ keyword, setKeyword }) => {
  const intl = useIntl();
  const modalClose = useModalClose();
  return (
    <HStack
      alignItems="center"
      borderBottomWidth={StyleSheet.hairlineWidth}
      borderBottomColor="border-subdued"
      pl={{ base: '4px', md: '12px' }}
      pr={{ base: '16px', md: '24px' }}
      h="57px"
    >
      <Searchbar
        autoFocus
        flex={1}
        w="auto"
        bgColor="transparent"
        borderWidth={0}
        focusOutlineColor="transparent"
        placeholder={intl.formatMessage({
          id: 'form__search_tokens',
        })}
        value={keyword}
        onClear={() => {
          setKeyword('');
        }}
        onChangeText={(text) => {
          setKeyword(text);
        }}
      />
      {!platformEnv.isNativeIOS && <NavigationButton onPress={modalClose} />}
    </HStack>
  );
};

const MarketSrarchModal: FC = () => {
  const onSearchKeywordChangeDebounce = useMarketSearchTokenChange();
  const modalClose = useModalClose();
  const [keyword, setKeyword] = useState('');
  onSearchKeywordChangeDebounce(keyword);
  return (
    <Modal
      size="sm"
      footer={null}
      height="640px"
      headerShown={false}
      staticChildrenProps={{
        flex: 1,
        overflow: 'hidden',
      }}
    >
      <SearchHeader keyword={keyword} setKeyword={setKeyword} />
      <MarketSearch closeOverlay={modalClose} />
    </Modal>
  );
};

export default MarketSrarchModal;
