import {
  ComponentProps,
  FC,
  forwardRef,
  useCallback,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { TextInput } from 'react-native';

import {
  HStack,
  ICON_NAMES,
  IconButton,
  Input,
  Pressable,
} from '@onekeyhq/components';

import {
  MatchDAppItemType,
  SearchContentType,
  SearchViewKeyEventType,
} from '../explorerUtils';
import SearchView from '../Search/SearchView';

import { useWebController } from './useWebController';

type BrowserURLInputProps = {
  onClear?: () => void;
  onChangeText?: (text: string) => void;
  customLeftIcon?: ICON_NAMES;
} & Omit<ComponentProps<typeof Input>, 'onChange' | 'onChangeText'>;

const BrowserURLInput = forwardRef<TextInput, BrowserURLInputProps>(
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
        autoCorrect={false}
        autoCapitalize="none"
        onPressRightIcon={onClear}
        onChangeText={handleChangeText}
        {...props}
      />
    );
  },
);

BrowserURLInput.displayName = 'BrowserURLInput';

function getHttpSafeState(searchContent?: SearchContentType): ICON_NAMES {
  try {
    if (!searchContent || !searchContent?.searchContent) {
      return 'SearchCircleSolid';
    }

    const url = new URL(searchContent?.searchContent ?? '');
    if (url.protocol === 'https:') {
      return 'LockClosedSolid';
    }
    if (url.protocol === 'http:') {
      return 'ExclamationCircleSolid';
    }
  } catch (e) {
    return 'SearchCircleSolid';
  }
  return 'SearchCircleSolid';
}
const WebControllerBarDesktop: FC = ({
  searchContent,
  onSearchContentChange,
  onSearchSubmitEditing,
  loading,
  canGoBack,
  canGoForward,
  onGoBack,
  onNext,
  onRefresh,
  onStopLoading,
}) => {
  const intl = useIntl();
  const [historyVisible, setHistoryVisible] = useState(false);
  const httpSafeState = getHttpSafeState(searchContent);
  const { url } = useWebController();

  const searchBar = useRef<TextInput>(null);
  // Todo Ref Type
  const searchView = useRef<any>(null);

  const onKeyEvent = (event: SearchViewKeyEventType) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    searchView?.current?.onKeyPress?.(event);
  };

  return (
    <>
      <HStack
        bg="background-default"
        w="100%"
        h="48px"
        px={8}
        space={3}
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

        <Pressable
          flex={1}
          style={{
            // @ts-expect-error
            WebkitAppRegion: 'no-drag',
          }}
        >
          <BrowserURLInput
            ref={searchBar}
            w="100%"
            h="32px"
            placeholder={intl.formatMessage({
              id: 'content__search_or_enter_dapp_url',
            })}
            customLeftIcon={httpSafeState}
            size="base"
            value={searchContent?.searchContent || url}
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
            }}
            onBlur={() => {
              setHistoryVisible(false);
            }}
          />
        </Pressable>

        {/* <IconButton
  type="plain"
  name="DotsHorizontalOutline"
  onPress={onMore}
  /> */}
      </HStack>
      {/* {moreView} */}
      <SearchView
        ref={searchView}
        visible={historyVisible}
        // onSearchContentChange={onSearchContentChange}
        searchContent={searchContent}
        onSelectorItem={(item: MatchDAppItemType) => {
          onSearchSubmitEditing?.(item);
          searchBar.current?.blur();
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
    </>
  );
};
WebControllerBarDesktop.displayName = 'WebControllerBarDesktop';

export default WebControllerBarDesktop;
