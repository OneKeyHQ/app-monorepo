import React, {
  ComponentProps,
  FC,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import { Box, HStack, IconButton, Input } from '@onekeyhq/components';
import type { ICON_NAMES } from '@onekeyhq/components';

import SearchView from '../Search/SearchView';

import type { ExplorerViewProps } from '..';
import type { MatchDAppItemType } from '../Search/useSearchHistories';

type BrowserURLInputProps = {
  onClear?: () => void;
  onChangeText?: (text: string) => void;
  customLeftIcon?: ICON_NAMES;
} & Omit<ComponentProps<typeof Input>, 'onChange' | 'onChangeText'>;

const BrowserURLInput = React.forwardRef<typeof Input, BrowserURLInputProps>(
  // eslint-disable-next-line react/prop-types
  ({ value, onClear, onChangeText, customLeftIcon, ...props }, ref) => {
    const [innerValue, setInnerValue] = useState(value);
    const handleChangeText = useCallback(
      (text: string) => {
        if (typeof value === 'undefined') {
          setInnerValue(text);
        } else if (typeof onChangeText !== 'undefined') {
          onChangeText(text);
        }
      },
      [value, onChangeText],
    );

    return (
      <Input
        // @ts-expect-error
        ref={ref}
        value={value ?? innerValue}
        leftIconName={customLeftIcon ?? 'SearchOutline'}
        // rightIconName={rightIconName}
        placeholder="Search..."
        onPressRightIcon={onClear}
        onChangeText={handleChangeText}
        {...props}
      />
    );
  },
);

BrowserURLInput.displayName = 'BrowserURLInput';

export type KeyEventType = 'ArrowUp' | 'ArrowDown';

const Desktop: FC<ExplorerViewProps> = ({
  searchContent,
  onSearchContentChange,
  onSearchSubmitEditing,
  explorerContent,
  loading,
  canGoBack,
  canGoForward,
  onGoBack,
  onNext,
  onRefresh,
  onStopLoading,
  moreView,
  showExplorerBar,
}) => {
  const intl = useIntl();

  const [historyVisible, setHistoryVisible] = React.useState(false);
  const [httpSafeState, setHttpSafeState] = useState<ICON_NAMES>(
    'ExclamationCircleSolid',
  );

  const searchBar = useRef<any>(null);
  // Todo Ref Type
  const searchView = useRef<any>(null);

  const onKeyEvent = (event: KeyEventType) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    searchView?.current?.onKeyPress?.(event);
  };

  useEffect(() => {
    try {
      if (!searchContent || !searchContent?.searchContent) {
        setHttpSafeState('SearchCircleSolid');
        return;
      }

      const url = new URL(searchContent?.searchContent ?? '');
      if (url.protocol === 'https:') {
        setHttpSafeState('LockClosedSolid');
      } else if (url.protocol === 'http:') {
        setHttpSafeState('ExclamationCircleSolid');
      } else {
        setHttpSafeState('SearchCircleSolid');
      }
    } catch (e) {
      setHttpSafeState('SearchCircleSolid');
    }
  }, [searchContent]);

  return (
    <Box flex="1" zIndex={3}>
      {!!showExplorerBar && (
        <Box bg="surface-subdued" zIndex={5}>
          <HStack
            w="100%"
            h="64px"
            px={8}
            space={3}
            flexDirection="row"
            alignItems="center"
          >
            <IconButton
              type="plain"
              name="ArrowLeftOutline"
              disabled={!canGoBack}
              onPress={onGoBack}
            />
            <IconButton
              type="plain"
              name="ArrowRightOutline"
              disabled={!canGoForward}
              onPress={onNext}
            />
            <IconButton
              type="plain"
              name={loading ? 'CloseOutline' : 'RefreshOutline'}
              onPress={loading ? onStopLoading : onRefresh}
            />

            <BrowserURLInput
              ref={searchBar}
              flex={1}
              h="38px"
              placeholder={intl.formatMessage({
                id: 'content__search_or_enter_dapp_url',
              })}
              customLeftIcon={httpSafeState}
              size="base"
              value={searchContent?.searchContent}
              onClear={() => onSearchContentChange?.({ searchContent: '' })}
              onChangeText={(text) =>
                onSearchContentChange?.({ searchContent: text })
              }
              onSubmitEditing={(event) => {
                if (searchContent?.dapp) {
                  onSearchSubmitEditing?.(searchContent.dapp);
                } else {
                  onSearchContentChange?.({
                    searchContent: event.nativeEvent.text,
                  });
                  onSearchSubmitEditing?.(event.nativeEvent.text);
                }
              }}
              onKeyPress={(event) => {
                const { key } = event.nativeEvent;
                if (key === 'ArrowUp' || key === 'ArrowDown') {
                  onKeyEvent?.(key);
                  // 阻断 上键、下键 事件传递
                  event.preventDefault();
                }
              }}
              onFocus={() => {
                setHistoryVisible(true);
                console.log('onFocus');
              }}
              onBlur={() => {
                setHistoryVisible(false);
                console.log('onBlur');
              }}
            />

            {/* <IconButton
            type="plain"
            name="DotsHorizontalOutline"
            onPress={onMore}
          /> */}
          </HStack>
          {moreView}
          <SearchView
            ref={searchView}
            visible={historyVisible}
            onVisibleChange={setHistoryVisible}
            // onSearchContentChange={onSearchContentChange}
            searchContent={searchContent}
            onSelectorItem={(item: MatchDAppItemType) => {
              onSearchSubmitEditing?.(item);
            }}
            onHoverItem={(item: MatchDAppItemType) => {
              let url;
              if (item.dapp) {
                url = item.dapp.url;
              } else if (item.webSite) {
                url = item.webSite.url;
              }
              if (url)
                onSearchContentChange?.({
                  searchContent: url,
                  dapp: item,
                });
            }}
            relativeComponent={searchBar.current}
          />
        </Box>
      )}

      <Box flex={1} zIndex={3}>
        {explorerContent}
      </Box>
    </Box>
  );
};

export default Desktop;
