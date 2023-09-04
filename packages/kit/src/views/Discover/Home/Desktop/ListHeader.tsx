import { type FC, useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Center, Input, Typography } from '@onekeyhq/components';

import { wait } from '../../../../utils/helper';
import { gotoSite, openMatchDApp } from '../../Explorer/Controller/gotoSite';
import SearchView from '../../Explorer/Search/SearchView';
import { BrowserShortcuts } from '../BrowserShortcuts';

import { discoverUIEventBus } from './eventBus';

import type {
  MatchDAppItemType,
  SearchViewKeyEventType,
  SearchViewRef,
} from '../../Explorer/explorerUtils';

const TypographyStrong = (text: string) => (
  <Typography.DisplayXLarge color="text-success">
    {text}
  </Typography.DisplayXLarge>
);

export const ListHeader: FC = () => {
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
    <Center>
      <Box width="640px" maxW="full" px="4">
        <Center mx="4" mt="8" mb="6">
          <Typography.DisplayXLarge>
            {intl.formatMessage(
              {
                id: 'title__explore_web_3_world_with_onekey',
              },
              { a: TypographyStrong },
            )}
          </Typography.DisplayXLarge>
        </Center>
        <Center position="relative">
          <Input
            size="xl"
            w="full"
            placeholder={intl.formatMessage({
              id: 'content__search_dapps_or_type_url',
            })}
            leftIconName="SearchOutline"
            value={text}
            onChangeText={onChangeText}
            onSubmitEditing={onSearch}
            onFocus={() => setShowSearch(true)}
            onBlur={() => setTimeout(() => setShowSearch(false), 200)}
            ref={ref}
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
        </Center>
        <Center>
          <Box w="360px">
            <BrowserShortcuts />
          </Box>
        </Center>
      </Box>
    </Center>
  );
};
