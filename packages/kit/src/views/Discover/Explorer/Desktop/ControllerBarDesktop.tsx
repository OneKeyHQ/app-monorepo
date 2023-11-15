import type { ComponentProps } from 'react';
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IICON_NAMES } from '@onekeyhq/components';
import { IconButton, Input, XStack } from '@onekeyhq/components';

import { useWebController } from '../../Controller/useWebController';
import { useWebTabsActions } from '../Context/contextWebTabs';

import type { MatchDAppItemType } from '../../explorerUtils';
import type { TextInput } from 'react-native';

type BrowserURLInputProps = {
  onClear?: () => void;
  onChangeText?: (text: string) => void;
  customLeftIcon?: IICON_NAMES;
} & Omit<ComponentProps<typeof Input>, 'onChange' | 'onChangeText'>;

const BrowserURLInput = forwardRef<TextInput, BrowserURLInputProps>(
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
        ref={ref}
        value={value ?? innerValue}
        placeholder="Search..."
        autoCorrect={false}
        autoCapitalize="none"
        onChangeText={handleChangeText}
        {...props}
      />
    );
  },
);
BrowserURLInput.displayName = 'BrowserURLInput';

function getHttpSafeState(searchContent?: string): IICON_NAMES {
  try {
    if (!searchContent) {
      return 'SearchOutline';
    }

    const url = new URL(searchContent);
    if (url.protocol === 'https:') {
      return 'CheckRadioOutline';
    }
    if (url.protocol === 'http:') {
      return 'BrokenLinkOutline';
    }
  } catch (e) {
    return 'SearchOutline';
  }
  return 'SearchOutline';
}

function ControllerBarDesktop() {
  const actions = useWebTabsActions();
  const intl = useIntl();

  const [historyVisible, setHistoryVisible] = useState(false);
  const { currentTab, stopLoading, goBack, goForward, reload } =
    useWebController();
  const { loading, canGoBack, canGoForward } = currentTab ?? {};

  const onSearchSubmitEditing = (dapp: MatchDAppItemType | string) => {
    if (typeof dapp === 'string') {
      return actions.goToSite({ url: dapp, userTriggered: true });
    }
    actions.openMatchDApp(dapp);
  };

  const url: string =
    currentTab?.url && currentTab?.url !== 'about:blank' ? currentTab.url : '';
  const httpSafeState = getHttpSafeState(url);
  const [searchText, setSearchText] = useState(url);

  useEffect(() => {
    setSearchText(url);
  }, [url]);

  const searchBar = useRef<TextInput>(null);

  return (
    <XStack bg="$bg" w="100%" h="$12" px="$8" space="$3" alignItems="center">
      <IconButton
        icon="ArrowLeftOutline"
        disabled={!canGoBack}
        onPress={goBack}
      />
      <IconButton
        icon="ArrowTopOutline"
        disabled={!canGoForward}
        onPress={goForward}
      />
      <IconButton
        icon={loading ? 'CrossedLargeOutline' : 'RenewOutline'}
        onPress={loading ? stopLoading : reload}
      />
      <XStack>
        <BrowserURLInput
          ref={searchBar}
          w="100%"
          h="32px"
          placeholder={intl.formatMessage({
            id: 'content__search_or_enter_dapp_url',
          })}
          customLeftIcon={httpSafeState}
          size="medium"
          value={searchText}
          onChangeText={setSearchText}
          onClear={() => setSearchText('')}
          onSubmitEditing={({ nativeEvent: { text } }) => {
            const trimText = text.trim();
            if (trimText) {
              setSearchText(trimText);
              onSearchSubmitEditing(trimText);
            }
          }}
          onKeyPress={(event) => {
            const { key } = event.nativeEvent;
            if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'Enter') {
              // if (onKeyEvent?.(key)) {
              //   // 阻断 上键、下键 事件传递
              //   event.preventDefault();
              // }
            }
          }}
          selectTextOnFocus
          onFocus={() => {
            setHistoryVisible(true);
          }}
          onBlur={() => {
            if (searchText?.trim() === '') {
              setSearchText(url);
            }
            setHistoryVisible(false);
          }}
        />
      </XStack>
      {/* <NetworkAccountSelectorTriggerDesktop /> */}
      {/* BrowserToolbar gas panel */}
      {/* Toolbar More Menu */}
    </XStack>
    // Add: SearchView
  );
}

export default ControllerBarDesktop;
