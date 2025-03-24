import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ColorTokens, IScrollViewRef, Icon } from '@onekeyhq/components';
import { Input, Popover, ScrollView, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { useSearchModalData } from '../../hooks/useSearchModalData';
import { SearchPopover } from '../../pages/Dashboard/Welcome/SearchPopover';
import { formatHiddenHttpsUrl } from '../../utils/explorerUtils';
import { DappInfoPopoverContent } from '../DappInfoPopoverContent';
import { SearchResultContent } from '../SearchResultContent';

import type { ISearchResultContentRef } from '../SearchResultContent';
import type {
  NativeSyntheticEvent,
  TextInput,
  TextInputKeyPressEventData,
} from 'react-native';

interface IHeaderLeftToolBarInputProps {
  iconConfig: {
    iconName: NonNullable<Parameters<typeof Icon>[0]['name']>;
    iconColor: ColorTokens;
  };
  url: string;
  isBookmark?: boolean;
  isPinned?: boolean;
  onBookmarkPress?: (bookmark: boolean) => void;
  onPinnedPress?: (pinned: boolean) => void;
  inputProps?: {
    onPress?: () => void;
  };
  hostSecurity: any;
}

function HeaderLeftToolBarInput({
  iconConfig,
  url,
  isBookmark,
  isPinned,
  onBookmarkPress,
  onPinnedPress,
  inputProps,
  hostSecurity,
}: IHeaderLeftToolBarInputProps) {
  const intl = useIntl();
  const [dappInfoIsOpen, setDappInfoIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [isPopoverVisible, setIsPopoverVisible] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [internalValue, setInternalValue] = useState('');
  const scrollViewRef = useRef<IScrollViewRef>(null);
  const searchResultRef = useRef<ISearchResultContentRef>(null);
  const inputRef = useRef<TextInput>(null);
  const { hiddenHttpsUrl } = formatHiddenHttpsUrl(url);

  useEffect(() => {
    if (hiddenHttpsUrl) {
      setInternalValue(hiddenHttpsUrl);
    }
  }, [hiddenHttpsUrl]);

  const {
    localData,
    searchList,
    displaySearchList,
    displayHistoryList,
    SEARCH_ITEM_ID,
  } = useSearchModalData(searchValue);

  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: 0,
      });
    }
  }, [searchValue]);

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
          setIsPopoverVisible(false);
        }
      }

      if (e.key === 'Escape') {
        setIsPopoverVisible(false);
        inputRef.current?.blur();
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
    <Stack flex={1}>
      <Input
        ref={inputRef}
        containerProps={{ mx: '$6', flex: 1 } as any}
        size="small"
        leftAddOnProps={{
          ...iconConfig,
          iconSize: '$4',
          mr: '$-2',
          onPress: () => {
            setDappInfoIsOpen(true);
          },
        }}
        pb="$1.5"
        value={internalValue}
        onChangeText={(text) => {
          setInternalValue(text);
          setSearchValue(text);
          setIsPopoverVisible(true);
        }}
        selectTextOnFocus
        testID="explore-index-search-input"
        onFocus={() => setIsPopoverVisible(true)}
        // @ts-expect-error
        onKeyPress={handleKeyDown}
        addOns={[
          {
            iconName: isBookmark ? 'StarSolid' : 'StarOutline',
            onPress: () => onBookmarkPress?.(!isBookmark),
            tooltipProps: {
              shortcutKey: EShortcutEvents.AddOrRemoveBookmark,
              renderContent: intl.formatMessage({
                id: isBookmark
                  ? ETranslations.explore_remove_bookmark
                  : ETranslations.explore_add_bookmark,
              }),
            },
            testID: `action-header-item-${
              !isBookmark ? 'bookmark' : 'remove-bookmark'
            }`,
            ...(isBookmark && {
              iconColor: '$icon',
            }),
          },
          {
            iconName: isPinned ? 'ThumbtackSolid' : 'ThumbtackOutline',
            onPress: () => onPinnedPress?.(!isPinned),
            tooltipProps: {
              shortcutKey: EShortcutEvents.PinOrUnpinTab,
              renderContent: intl.formatMessage({
                id: isPinned
                  ? ETranslations.explore_unpin
                  : ETranslations.explore_pin,
              }),
            },
            testID: `action-header-item-${!isPinned ? 'pin' : 'un-pin'}`,
            ...(isPinned && {
              iconColor: '$icon',
            }),
          },
        ]}
        {...inputProps}
      />
      <Stack ml={24}>
        <Popover
          placement="bottom-start"
          title="dApp info"
          open={dappInfoIsOpen}
          onOpenChange={setDappInfoIsOpen}
          renderTrigger={<Stack />}
          renderContent={({ closePopover }) => (
            <DappInfoPopoverContent
              iconConfig={iconConfig}
              hostSecurity={hostSecurity}
              closePopover={closePopover}
            />
          )}
        />
      </Stack>

      <SearchPopover
        containerProps={{
          px: 24,
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
              innerRef={searchResultRef}
              onItemClick={() => {
                setIsPopoverVisible(false);
              }}
            />
          </Stack>
        </ScrollView>
      </SearchPopover>
    </Stack>
  );
}

export default HeaderLeftToolBarInput;
