import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Input,
  ScrollView,
  SizableText,
  Stack,
  View,
  XStack,
  useShortcuts,
} from '@onekeyhq/components';
import type { IScrollViewRef } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { shortcutsKeys } from '@onekeyhq/shared/src/shortcuts/shortcutsKeys.enum';

import { SearchResultContent } from '../../../components/SearchResultContent';
import { useSearchModalData } from '../../../hooks/useSearchModalData';
import { useSearchPopover } from '../../../hooks/useSearchPopover';
import {
  useSearchPopoverShortcutsFeatureFlag,
  useSearchPopoverUIFeatureFlag,
} from '../../../hooks/useSearchPopoverFeatureFlag';

import { KeyboardShortcutKey } from './KeyboardShortcutKey';
import { SearchPopover } from './SearchPopover';

import type { ISearchResultContentRef } from '../../../components/SearchResultContent';
import type { TextInput } from 'react-native';

export function SearchInput() {
  const searchPopoverShortcutsFeatureFlag =
    useSearchPopoverShortcutsFeatureFlag();
  const searchPopoverUIFeatureFlag = useSearchPopoverUIFeatureFlag();
  const intl = useIntl();
  const [searchValue, setSearchValue] = useState('');
  const searchResultRef = useRef<ISearchResultContentRef>(null);
  const scrollViewRef = useRef<IScrollViewRef>(null);
  const inputRef = useRef<TextInput>(null);
  const navigation = useAppNavigation();

  const focusInputWithDelay = useCallback(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
  }, []);

  const {
    localData,
    searchList,
    displaySearchList,
    displayHistoryList,
    SEARCH_ITEM_ID,
    refreshLocalData,
    totalItems,
  } = useSearchModalData(searchValue);

  const {
    handleInputBlur,
    handleKeyDown,
    handleSearchBarPress,
    isPopoverOpen,
    isPopoverVisible,
    selectedIndex,
    setIsPopoverOpen,
  } = useSearchPopover({
    scrollViewRef: scrollViewRef as any,
    totalItems,
    searchValue,
    refreshLocalData,
    onEnterPress: () => {
      if (searchResultRef.current) {
        searchResultRef.current.openSelectedItem();
        setIsPopoverOpen(false);

        // clear search value when create new tab
        setSearchValue('');
      }
    },
    onEscape: () => {
      inputRef.current?.blur();
    },
    displaySearchList: Boolean(displaySearchList),
    displayHistoryList: Boolean(displayHistoryList),
  });

  useEffect(() => {
    if (platformEnv.isDesktop) {
      focusInputWithDelay();
    }
  }, [focusInputWithDelay]);

  useListenTabFocusState(ETabRoutes.Discovery, () => {
    focusInputWithDelay();
  });

  const handleInputChange = useCallback(
    (text: string) => {
      setSearchValue(text);
      if (text.length > 0) {
        setIsPopoverOpen(true);
      }
    },
    [setIsPopoverOpen],
  );

  useShortcuts(EShortcutEvents.NewTab, () => {
    if (searchPopoverShortcutsFeatureFlag) {
      focusInputWithDelay();
    } else {
      navigation.pushModal(EModalRoutes.DiscoveryModal, {
        screen: EDiscoveryModalRoutes.SearchModal,
      });
    }
  });

  return (
    <>
      <View position="relative" width="100%">
        <XStack
          testID="search-input"
          gap="$2"
          position="relative"
          width="100%"
          backgroundColor="$bgStrong"
          borderRadius="$full"
          alignItems="center"
          borderWidth={2}
          borderColor={isPopoverOpen ? '$focusRing' : 'transparent'}
          hoverStyle={{
            cursor: 'pointer',
            opacity: 0.8,
          }}
          pressStyle={{
            opacity: 1,
          }}
          onPress={handleSearchBarPress}
          px="$3"
          $gtSm={{
            w: 384,
          }}
        >
          <Icon name="SearchOutline" size="$5" color="$textSubdued" />

          {searchPopoverUIFeatureFlag ? (
            <Input
              ref={inputRef}
              containerProps={{
                flex: 1,
                borderWidth: 0,
                bg: 'transparent',
                p: 0,
              }}
              InputComponentStyle={{
                p: 0,
                bg: 'transparent',
              }}
              // @ts-expect-error
              onKeyPress={handleKeyDown}
              testID="search-input"
              placeholder={intl.formatMessage({
                id: ETranslations.browser_search_dapp_or_enter_url,
              })}
              size="large"
              value={searchValue}
              onChangeText={handleInputChange}
              onFocus={() => {
                setIsPopoverOpen(true);
              }}
              onBlur={handleInputBlur}
            />
          ) : (
            <Stack py="$3" flex={1}>
              <SizableText size="$bodyLg" color="$textPlaceholder">
                {intl.formatMessage({
                  id: ETranslations.browser_search_dapp_or_enter_url,
                })}
              </SizableText>
            </Stack>
          )}

          {searchPopoverShortcutsFeatureFlag ? (
            <XStack gap="$1" pointerEvents="none">
              <KeyboardShortcutKey label={shortcutsKeys.CmdOrCtrl} />
              <KeyboardShortcutKey label="T" />
            </XStack>
          ) : null}
        </XStack>

        <SearchPopover
          containerProps={{
            $gtSm: { width: 384 },
          }}
          isOpen={isPopoverVisible}
        >
          <ScrollView ref={scrollViewRef} maxHeight={310}>
            <Stack py="$2">
              <SearchResultContent
                searchValue={searchValue}
                localData={localData}
                searchList={searchList}
                displaySearchList={displaySearchList}
                displayBookmarkList={false}
                displayHistoryList={displayHistoryList}
                SEARCH_ITEM_ID={SEARCH_ITEM_ID}
                selectedIndex={selectedIndex}
                innerRef={searchResultRef as any}
                onItemClick={() => {
                  setSearchValue('');
                  setIsPopoverOpen(false);
                }}
              />
            </Stack>
          </ScrollView>
        </SearchPopover>
      </View>
    </>
  );
}
