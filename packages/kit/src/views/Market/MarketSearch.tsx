import React, { FC, useCallback, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/native';

import { ModalizeProps } from 'react-native-modalize';
import {
  Box,
  Button,
  FlatList,
  ScrollView,
  Searchbar,
  Typography,
  Spinner,
  Center,
  useIsVerticalLayout,
} from '@onekeyhq/components/src';
import { debounce } from 'lodash';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  useMarketSearchContainerStyle,
  useMarketSearchHistory,
  useMarketSearchTokenChange,
  useMarketSearchTokens,
} from './hooks/useMarketSearch';
import TokenTag from './Components/MarketSearch/TokenTag';
import MarketSearchTab from './Components/MarketSearch/MarketSearchTab';
import { showOverlay } from '../../utils/overlayUtils';
import { OverlayPanel } from '../Overlay/OverlayPanel';
import { SelectProps } from '@onekeyhq/components/src/Select';
import { ModalProps } from '@onekeyhq/components/src/Modal';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { HomeRoutes, HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';
import { MarketTokenItem } from '../../store/reducers/market';
import MarketSearchList from './Components/MarketSearch/MarketSearchList';

type NavigationProps = NativeStackNavigationProp<HomeRoutesParams>;

const MarketSearch: FC<{
  closeOverlay: () => void;
}> = ({ closeOverlay }) => {
  const isVertical = useIsVerticalLayout();
  const searchHistory = useMarketSearchHistory();
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
        iconUrl: marketTokenItem.image ?? '',
        symbol: marketTokenItem.symbol ?? '',
      });
    },
    [navigation, closeOverlay],
  );

  const searchContent = useMemo(() => {
    if (searchKeyword && searchKeyword.length > 0) {
      return (
        <Box mt="3">
          <Typography.Subheading mb="3">Search Results</Typography.Subheading>
          {searchTokens ? (
            <MarketSearchList data={searchTokens} onPress={onTokenPress} />
          ) : (
            <Center w="full" h="full">
              <Spinner size="lg" />
            </Center>
          )}
        </Box>
      );
    }
    return (
      <Box>
        <Box flexDirection="row" justifyContent="space-between" mb={1}>
          <Typography.Subheading>RECENT SEARCHED</Typography.Subheading>
          {searchHistory && searchHistory.length > 0 ? (
            <Button
              type="plain"
              size="xs"
              leftIconName="TrashSolid"
              iconSize={16}
              mr="2"
              onPress={() => {
                backgroundApiProxy.serviceMarket.clearSearchHistory();
              }}
            >
              Clear All
            </Button>
          ) : null}
        </Box>
        {searchHistory && searchHistory.length > 0 ? (
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
        ) : null}
        <MarketSearchTab onPress={onTokenPress} />
      </Box>
    );
  }, [searchKeyword, searchHistory, onTokenPress, searchTokens]);
  const [searchInput, setSearchInput] = useState(() => '');
  const searchOnChangeDebounce = useMarketSearchTokenChange();
  return (
    <Box {...style}>
      {isVertical ? (
        <Searchbar
          placeholder="Search Tokens"
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
      <ScrollView flex={1}>{searchContent}</ScrollView>
    </Box>
  );
};

export const showMarketSearch = ({
  modalProps,
  triggerEle,
  modalLizeProps,
}: {
  modalProps?: ModalProps;
  triggerEle?: SelectProps['triggerEle'];
  modalLizeProps?: ModalizeProps;
}) =>
  showOverlay((closeOverlay) => (
    <OverlayPanel
      triggerEle={triggerEle}
      closeOverlay={closeOverlay}
      modalProps={modalProps}
      modalLizeProps={modalLizeProps}
      dropdownPosition="center"
      dropdownStyle={{ w: '360px', bg: 'surface-default', p: 0 }}
    >
      <MarketSearch closeOverlay={closeOverlay} />
    </OverlayPanel>
  ));
