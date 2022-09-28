import {
  ComponentProps,
  FC,
  forwardRef,
  useCallback,
  useEffect,
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
  SearchViewKeyEventType,
  WebControllerBarProps,
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

function getHttpSafeState(searchContent?: string): ICON_NAMES {
  try {
    if (!searchContent) {
      return 'SearchCircleSolid';
    }

    const url = new URL(searchContent);
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
const WebControllerBarDesktop: FC<WebControllerBarProps> = ({
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
  const { currentTab } = useWebController();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const url: string = currentTab?.url || '';
  const [searchText, setSearchText] = useState(url);
  const httpSafeState = getHttpSafeState(url);

  useEffect(() => {
    setSearchText(url);
  }, [url]);

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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            value={searchText}
            onClear={() => setSearchText('')}
            onChangeText={setSearchText}
            // @ts-ignore
            onSubmitEditing={({ nativeEvent: { text } }) => {
              const trimText = text.trim();
              if (trimText) {
                setSearchText(trimText);
                onSearchSubmitEditing(trimText);
              }
            }}
            // @ts-ignore
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
              if (searchText?.trim() === '') {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                setSearchText(url);
              }
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
        onSearchContentChange={setSearchText}
        searchContent={searchText}
        onSelectorItem={(item: MatchDAppItemType) => {
          onSearchSubmitEditing(item);
          searchBar.current?.blur();
        }}
        // onHoverItem={(item: MatchDAppItemType) => {
        //   let url;
        //   if (item.dapp) {
        //     url = item.dapp.url;
        //   } else if (item.webSite) {
        //     url = item.webSite.url;
        //   }
        //   if (url) onSearchTextChange(url);
        // }}
        relativeComponent={searchBar.current}
      />
    </>
  );
};
WebControllerBarDesktop.displayName = 'WebControllerBarDesktop';

export default WebControllerBarDesktop;
