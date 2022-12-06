import React, { useCallback, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  IconButton,
  Input,
  Pressable,
  Typography,
  useIsVerticalLayout,
  useThemeValue,
} from '@onekeyhq/components/src';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  MARKET_TAB_NAME,
  SWAP_TAB_NAME,
} from '@onekeyhq/kit/src/store/reducers/market';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SwapHeaderButtons } from '../../../Swap/SwapHeader';
import { useMarketTopTabName } from '../../hooks/useMarketList';
import { useMarketSearchTokenChange } from '../../hooks/useMarketSearch';
import { showMarketSearch } from '../../MarketSearch';

const Header: React.FC = () => {
  const intl = useIntl();
  const searchOnChangeDebounce = useMarketSearchTokenChange();
  const [searchInput, setSearchInput] = useState(() => '');
  const [searchFocused, setSearchFocused] = useState(() => false);
  const rightIconName = searchInput ? 'XCircleMini' : undefined;
  const inputRef = useRef(null);
  const searchBarRef = useRef();
  useFocusEffect(
    useCallback(() => {
      if (platformEnv.isRuntimeBrowser) {
        const triggleerSearch = (e: KeyboardEvent) => {
          if (e.code === 'KeyF' && !searchFocused) {
            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            inputRef?.current?.focus?.();
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
      <Box mt="3" ml="6" ref={searchBarRef} width="360px">
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
            setSearchFocused(true);
            showMarketSearch({ triggerEle: searchBarRef?.current });
          }}
          onBlur={() => {
            setSearchFocused(false);
          }}
        />
      </Box>
      <Divider mt="3" />
      <Typography.DisplayLarge ml="6" mt="6">
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
      px="4"
      pt="4"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      zIndex={1}
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
            name="MagnifyingGlassMini"
            type="plain"
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
                  tapGestureEnabled: false,
                  scrollViewProps: { keyboardShouldPersistTaps: 'handled' },
                },
              });
            }}
          />
        ) : null}
        {marketTopTabName === SWAP_TAB_NAME ? <SwapHeaderButtons /> : null}
      </Box>
    </Box>
  );
};

const MarketHeader: React.FC = () => {
  const isVerticalLayout = useIsVerticalLayout();

  return isVerticalLayout ? <HeaderSmall /> : <Header />;
};

export default React.memo(MarketHeader);
