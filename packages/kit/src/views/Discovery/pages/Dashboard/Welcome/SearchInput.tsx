import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Input, Stack, View, XStack } from '@onekeyhq/components';
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

export function SearchInput() {
  const intl = useIntl();
  const [searchValue, setSearchValue] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [isPopoverOpen]);

  const {
    localData,
    searchList,
    displaySearchList,
    displayBookmarkList,
    displayHistoryList,
    SEARCH_ITEM_ID,
  } = useSearchModalData(searchValue);

  const navigation = useAppNavigation();
  const handleSearchBarPress = useCallback(() => {
    // only on mobile
    if (!platformEnv.isDesktop) {
      navigation.pushModal(EModalRoutes.DiscoveryModal, {
        screen: EDiscoveryModalRoutes.SearchModal,
      });
    }
  }, [navigation]);

  const hasResults =
    displaySearchList || displayBookmarkList || displayHistoryList;

  const handleInputChange = useCallback((text: string) => {
    setSearchValue(text);
    setSelectedIndex(-1);
  }, []);

  const handleInputBlur = useCallback(() => {
    setIsPopoverOpen(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Prevent default behavior for up and down arrow keys
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();

        // Calculate total items count
        const searchCount = displaySearchList ? searchList.length : 0;
        const bookmarkCount = displayBookmarkList
          ? localData?.bookmarkData?.length || 0
          : 0;
        const historyCount = displayHistoryList
          ? localData?.historyData?.length || 0
          : 0;
        const totalItems = searchCount + bookmarkCount + historyCount;

        if (totalItems === 0) return;

        // Update selected index based on arrow key
        if (e.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
        }
      }
    },
    [
      displaySearchList,
      displayBookmarkList,
      displayHistoryList,
      searchList.length,
      localData,
    ],
  );

  const searchInputTrigger = (
    <Stack position="relative" width="100%" $gtSm={{ w: 384 }}>
      <Input
        // @ts-expect-error
        onKeyPress={handleKeyDown}
        testID="search-input"
        placeholder={intl.formatMessage({
          id: ETranslations.browser_search_dapp_or_enter_url,
        })}
        size="large"
        leftIconName="SearchOutline"
        value={searchValue}
        onChangeText={handleInputChange}
        onFocus={() => {
          setIsPopoverOpen(true);
        }}
        onBlur={handleInputBlur}
        addOns={
          hasResults
            ? [
                {
                  iconName: 'ChevronDownSmallOutline',
                  onPress: () => setIsPopoverOpen(!isPopoverOpen),
                },
              ]
            : undefined
        }
        containerProps={{
          alignItems: 'center',
        }}
      />

      {platformEnv.isDesktop ? (
        <XStack
          position="absolute"
          right="$3"
          top="50%"
          style={{ transform: [{ translateY: -12 }] }}
          gap="$1"
          pointerEvents="none"
        >
          <KeyboardShortcutKey label={shortcutsKeys.CmdOrCtrl} />
          <KeyboardShortcutKey label="T" />
        </XStack>
      ) : null}
    </Stack>
  );

  return (
    <>
      <View position="relative">
        {searchInputTrigger}
        <SearchPopover isOpen={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <Stack p="$2" maxHeight={400}>
            <SearchResultContent
              searchValue={searchValue}
              localData={localData}
              searchList={searchList}
              displaySearchList={displaySearchList}
              displayBookmarkList={displayBookmarkList}
              displayHistoryList={displayHistoryList}
              SEARCH_ITEM_ID={SEARCH_ITEM_ID}
              selectedIndex={selectedIndex}
              onItemClick={() => {
                setIsPopoverOpen(false);
              }}
            />
          </Stack>
        </SearchPopover>
      </View>
    </>
  );
}
