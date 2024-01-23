import type { FC } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { wait } from '@onekeyfe/hd-core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Image,
  Input,
  Pressable,
  Typography,
  useTheme,
} from '@onekeyhq/components';
import PNG from '@onekeyhq/kit/assets/discover/header_bg.png';
import PNGLight from '@onekeyhq/kit/assets/discover/header_bg_light.png';

import { gotoSite, openMatchDApp } from '../../Explorer/Controller/gotoSite';
import SearchView from '../../Explorer/Search/SearchView';
import { discoverUIEventBus } from '../eventBus';

import type {
  MatchDAppItemType,
  SearchViewKeyEventType,
  SearchViewRef,
} from '../../Explorer/explorerUtils';

const SearchInput: FC = () => {
  const intl = useIntl();
  const ref = useRef<any>(null);
  const searchViewRef = useRef<SearchViewRef>(null);
  const [text, onChangeText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const onSearch = useCallback(async () => {
    if (text) {
      setShowSearch(false);
      await wait(200);
      gotoSite({ url: text, userTriggered: true });
      setTimeout(() => {
        onChangeText('');
      }, 100);
    }
  }, [text]);

  const onKeyEvent = (event: SearchViewKeyEventType) =>
    searchViewRef.current?.onKeyPress(event);

  const onSearchSubmitEditing = useCallback(
    async (dapp: MatchDAppItemType | string) => {
      if (typeof dapp === 'string') {
        gotoSite({ url: dapp, userTriggered: true });
      } else {
        openMatchDApp(dapp);
      }
      setShowSearch(false);
      await wait(200);
      setTimeout(() => {
        onChangeText('');
      }, 100);
    },
    [],
  );

  useEffect(() => {
    const fn = () => {
      setShowSearch(false);
      // eslint-disable-next-line
      ref.current?.blur?.();
    };
    discoverUIEventBus.on('scroll', fn);
    return () => {
      discoverUIEventBus.off('scroll', fn);
    };
  }, []);
  return (
    <Box position="relative">
      <Box position="relative">
        <Input
          size="xl"
          w="full"
          placeholder={intl.formatMessage({
            id: 'content__search_dapps_or_type_url',
          })}
          bgColor="white"
          color="#000"
          leftIconName="SearchOutline"
          value={text}
          onChangeText={onChangeText}
          onSubmitEditing={onSearch}
          onFocus={() => setShowSearch(true)}
          onBlur={() => setTimeout(() => setShowSearch(false), 200)}
          ref={ref}
          pr="80px"
          // @ts-ignore
          onKeyPress={(event) => {
            const { key } = event.nativeEvent;
            if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'Enter') {
              if (onKeyEvent?.(key)) {
                // 阻断 上键、下键 事件传递
                event.preventDefault();
              }
            }
          }}
        />
        <Box position="absolute" right="0" top="0">
          <Box h="12" w="72px" p="2">
            <Pressable
              w="full"
              h="full"
              borderRadius={12}
              bgColor="#000"
              justifyContent="center"
              alignItems="center"
              onPress={onSearch}
              _hover={{ bgColor: '#222' }}
            >
              <Typography.Button2 color="#fff">
                {intl.formatMessage({ id: 'action__go' })}
              </Typography.Button2>
            </Pressable>
          </Box>
        </Box>
      </Box>
      {showSearch ? (
        <SearchView
          ref={searchViewRef}
          visible={showSearch}
          relativeComponent={ref.current}
          onSearchContentChange={onChangeText}
          searchContent={text}
          onSelectorItem={(item: MatchDAppItemType) => {
            setShowSearch(false);
            setTimeout(() => {
              onSearchSubmitEditing(item);
              // eslint-disable-next-line
                (ref.current as any)?.blur?.();
            }, 100);
          }}
        />
      ) : null}
    </Box>
  );
};

export const Header = () => {
  const intl = useIntl();
  const { isLight } = useTheme();
  return (
    <Box pb="8" px="4">
      <Box
        width="full"
        h="220px"
        borderRadius={12}
        overflow="hidden"
        position="relative"
      >
        <Image source={isLight ? PNGLight : PNG} w="full" h="full" />
        <Center position="absolute" w="full" h="full">
          <Typography.PageHeading
            color="text-default"
            fontSize={36}
            lineHeight={50}
          >
            {intl.formatMessage({ id: 'title__discover_dapps' })}
          </Typography.PageHeading>
          <Box w="4/5" mt="6">
            <SearchInput />
          </Box>
          <Typography.Body2 color="text-subdued" mt="4">
            {intl.formatMessage({
              id: 'form__explore_web3_world_with_onekey_a_safer_and_simpler_way',
            })}
          </Typography.Body2>
        </Center>
      </Box>
    </Box>
  );
};
