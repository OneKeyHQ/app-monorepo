import React, { useCallback, useRef, useState } from 'react';
import { debounce } from 'lodash';

import {
  Box,
  Divider,
  IconButton,
  Pressable,
  Searchbar,
  Typography,
  useThemeValue,
  useIsVerticalLayout,
} from '@onekeyhq/components/src';
import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  MARKET_TAB_NAME,
  SWAP_TAB_NAME,
} from '../../../../store/reducers/market';
import { useMarketTopTabName } from '../../hooks/useMarketList';
import { showMarketSearch } from '../../MarketSearch';
import { useMarketSearchTokenChange } from '../../hooks/useMarketSearch';
import { useIntl } from 'react-intl';

const Header: React.FC = () => {
  const intl = useIntl();
  const searchBarRef = useRef();
  const searchOnChangeDebounce = useMarketSearchTokenChange();
  const [searchInput, setSearchInput] = useState(() => '');
  return (
    <Box flexDirection="column">
      <Box mt="3" ml="6" ref={searchBarRef} width="360px">
        <Searchbar
          placeholder="Search Cryptos"
          w="full"
          value={searchInput}
          onChangeText={(text) => {
            setSearchInput(text);
            searchOnChangeDebounce(text);
          }}
          onClear={() => {
            setSearchInput('');
            searchOnChangeDebounce('');
          }}
          onFocus={() => {
            showMarketSearch({ triggerEle: searchBarRef.current });
          }}
        />
      </Box>
      <Divider mt="3" />
      <Typography.DisplayLarge ml="3" mt="6">
        {intl.formatMessage({ id: 'title__market' })}
      </Typography.DisplayLarge>
    </Box>
  );
};

const HeaderSmall: React.FC = () => {
  const tabName = useMarketTopTabName();
  const handleBg = useThemeValue('icon-subdued');
  const intl = useIntl();
  return (
    <Box
      p="3"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
    >
      <Box flexDirection="row">
        <Pressable
          onPress={() => {
            backgroundApiProxy.serviceMarket.switchMarketTopTab(
              MARKET_TAB_NAME,
            );
          }}
        >
          <Typography.DisplayMedium
            color={
              tabName === MARKET_TAB_NAME ? 'text-default' : 'text-disabled'
            }
          >
            {intl.formatMessage({ id: 'title__market' })}
          </Typography.DisplayMedium>
        </Pressable>
        <Pressable
          ml="3"
          onPress={() => {
            backgroundApiProxy.serviceMarket.switchMarketTopTab(SWAP_TAB_NAME);
          }}
        >
          <Typography.DisplayMedium
            color={tabName === SWAP_TAB_NAME ? 'text-default' : 'text-disabled'}
          >
            {intl.formatMessage({ id: 'title__swap' })}
          </Typography.DisplayMedium>
        </Pressable>
      </Box>
      <Box>
        <IconButton
          size="base"
          name="SearchSolid"
          iconSize={16}
          onPress={() => {
            showMarketSearch({
              modalProps: {
                headerShown: false,
                hideBackButton: true,
              },
              modalLizeProps: {
                handleStyle: { backgroundColor: handleBg },
                withHandle: true,
                handlePosition: 'inside',
              },
            });
          }}
        />
      </Box>
    </Box>
  );
};

const MarketHeader: React.FC = () => {
  const isVerticalLayout = useIsVerticalLayout();

  return isVerticalLayout ? <HeaderSmall /> : <Header />;
};

export default React.memo(MarketHeader);
