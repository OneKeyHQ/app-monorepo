import React, { useCallback, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';

import {
  Box,
  Divider,
  IconButton,
  Pressable,
  Searchbar,
  Typography,
  useThemeValue,
  useIsVerticalLayout,
  Input,
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
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const Header: React.FC = () => {
  const intl = useIntl();
  const searchOnChangeDebounce = useMarketSearchTokenChange();
  const [searchInput, setSearchInput] = useState(() => '');
  const [searchFocused, setSearchFocused] = useState(() => false);
  const [blurCount, setBlurCount] = useState(0);
  const rightIconName = searchInput ? 'CloseCircleSolid' : undefined;
  const inputRef = useRef(null);
  const searchBarRef = useRef();
  useFocusEffect(
    useCallback(() => {
      if (platformEnv.isRuntimeBrowser) {
        const triggleerSearch = (e: KeyboardEvent) => {
          if (e.code === 'KeyF' && !searchFocused) {
            inputRef?.current?.focus();
          }
        };
        document.addEventListener('keydown', triggleerSearch);
        return () => {
          document.removeEventListener('keydown', triggleerSearch);
        };
      }
    }, [searchFocused]),
  );

  return (
    <Box flexDirection="column">
      <Box mt="8" ml="6" ref={searchBarRef} width="360px">
        <Input
          ref={inputRef}
          placeholder={intl.formatMessage({ id: 'form__search_tokens' })}
          w="full"
          rightIconName={rightIconName}
          leftIconName="SearchOutline"
          value={searchInput}
          onChangeText={(text) => {
            setSearchInput(text);
            searchOnChangeDebounce(text);
          }}
          onPressRightIcon={() => {
            setSearchInput('');
            searchOnChangeDebounce('');
          }}
          onFocus={() => {
            if (!searchFocused) {
              setSearchFocused(true);
              showMarketSearch({ triggerEle: searchBarRef?.current });
            }
          }}
          onBlur={() => {
            if (blurCount <= 1) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                inputRef.current?.focus();
                setBlurCount((pre) => pre + 1);
                return;
            }
            setBlurCount(0);
            setSearchFocused(false);
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
  const marketTopTabName = useMarketTopTabName();
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
        {marketTopTabName === MARKET_TAB_NAME ? (
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
        ) : null}
      </Box>
    </Box>
  );
};

const MarketHeader: React.FC = () => {
  const isVerticalLayout = useIsVerticalLayout();

  return isVerticalLayout ? <HeaderSmall /> : <Header />;
};

export default React.memo(MarketHeader);
