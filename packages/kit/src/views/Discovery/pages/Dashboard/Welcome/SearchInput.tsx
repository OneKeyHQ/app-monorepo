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
} from '@onekeyhq/components';
import type { IScrollViewRef } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { shortcutsKeys } from '@onekeyhq/shared/src/shortcuts/shortcutsKeys.enum';

import { SearchResultContent } from '../../../components/SearchResultContent';
import { useSearchModalData } from '../../../hooks/useSearchModalData';

import { KeyboardShortcutKey } from './KeyboardShortcutKey';
import { SearchPopover } from './SearchPopover';

import type { ISearchResultContentRef } from '../../../components/SearchResultContent';

const ITEM_HEIGHT = 48; // Height of each item in the search results

export function SearchInput() {
  const intl = useIntl();
  const [searchValue, setSearchValue] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchResultRef = useRef<ISearchResultContentRef>(null);
  const scrollViewRef = useRef<IScrollViewRef>(null);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [isPopoverOpen]);

  const {
    localData,
    searchList,
    displaySearchList,
    displayHistoryList,
    SEARCH_ITEM_ID,
  } = useSearchModalData(searchValue);

  useEffect(() => {
    scrollViewRef?.current?.scrollTo({
      y: 0,
    });
  }, [searchValue]);

  const navigation = useAppNavigation();
  const handleSearchBarPress = useCallback(() => {
    // only on mobile
    if (!platformEnv.isDesktop) {
      navigation.pushModal(EModalRoutes.DiscoveryModal, {
        screen: EDiscoveryModalRoutes.SearchModal,
      });
    }
  }, [navigation]);

  const handleInputChange = useCallback((text: string) => {
    setSearchValue(text);
    setSelectedIndex(-1);
  }, []);

  const handleInputBlur = useCallback(() => {
    setTimeout(() => {
      setIsPopoverOpen(false);
    }, 100);
  }, []);

  useEffect(() => {
    if (scrollViewRef.current) {
      const getSelectedItemDistance = () => {
        if (selectedIndex < 4) return 0;

        // Calculate item height based on your UI design
        return selectedIndex * ITEM_HEIGHT;
      };

      const distance = getSelectedItemDistance();
      scrollViewRef.current.scrollTo({
        y: distance,
        animated: true,
      });
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Prevent default behavior for up and down arrow keys
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();

        // Calculate total items count
        const searchCount = displaySearchList ? searchList.length : 0;
        const historyCount = displayHistoryList
          ? localData?.historyData?.length || 0
          : 0;
        const totalItems = searchCount + historyCount;

        if (totalItems === 0) return;

        // Update selected index based on arrow key
        if (e.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 2 > totalItems ? prev : prev + 1));
        } else if (e.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev > -1 ? prev - 1 : -1));
        }
      }

      // Handle Enter key press - call openSelectedItem
      if (e.key === 'Enter') {
        e.preventDefault();
        if (searchResultRef.current) {
          searchResultRef.current.openSelectedItem();
          setIsPopoverOpen(false);
        }
      }
    },
    [
      displaySearchList,
      searchList.length,
      displayHistoryList,
      localData?.historyData?.length,
    ],
  );

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

          {platformEnv.isDesktop ? (
            <Input
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

          {platformEnv.isDesktop ? (
            <XStack gap="$1" pointerEvents="none">
              <KeyboardShortcutKey label={shortcutsKeys.CmdOrCtrl} />
              <KeyboardShortcutKey label="T" />
            </XStack>
          ) : null}
        </XStack>

        <SearchPopover isOpen={isPopoverOpen}>
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
                innerRef={searchResultRef}
                onItemClick={() => {
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
