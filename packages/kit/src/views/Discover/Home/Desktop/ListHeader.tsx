import { type FC, useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Center, Input, Typography } from '@onekeyhq/components';

import { gotoSite, openMatchDApp } from '../../Explorer/Controller/gotoSite';
import SearchView from '../../Explorer/Search/SearchView';
import { BrowserShortcuts } from '../BrowserShortcuts';

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
  const onSearch = useCallback(() => {
    if (text) {
      gotoSite({ url: text, userTriggered: true });
    }
  }, [text]);

  const onKeyEvent = (event: SearchViewKeyEventType) =>
    searchViewRef.current?.onKeyPress(event);

  const onSearchSubmitEditing = (dapp: MatchDAppItemType | string) => {
    if (typeof dapp === 'string') {
      return gotoSite({ url: dapp, userTriggered: true });
    }
    openMatchDApp(dapp);
  };

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
        <Center>
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
            onBlur={() => setShowSearch(false)}
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
