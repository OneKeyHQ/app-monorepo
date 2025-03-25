import { useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ColorTokens, IScrollViewRef, Icon } from '@onekeyhq/components';
import { Input, Popover, ScrollView, Stack } from '@onekeyhq/components';
import { useShortcutsOnRouteFocused } from '@onekeyhq/kit/src/hooks/useShortcutsOnRouteFocused';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { useSearchModalData } from '../../hooks/useSearchModalData';
import { useSearchPopover } from '../../hooks/useSearchPopover';
import { SearchPopover } from '../../pages/Dashboard/Welcome/SearchPopover';
import { formatHiddenHttpsUrl } from '../../utils/explorerUtils';
import { DappInfoPopoverContent } from '../DappInfoPopoverContent';
import { SearchResultContent } from '../SearchResultContent';

import type { ISearchResultContentRef } from '../SearchResultContent';
import type { TextInput } from 'react-native';

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
    totalItems,
  } = useSearchModalData(searchValue);

  const {
    selectedIndex,
    handleKeyDown,
    handleInputBlur,
    isPopoverOpen,
    setIsPopoverOpen,
  } = useSearchPopover({
    scrollViewRef,
    totalItems,
    searchValue,
    displaySearchList,
    displayHistoryList,
    onEnterPress: () => {
      if (searchResultRef.current) {
        searchResultRef.current.openSelectedItem();
        setIsPopoverOpen(false);
      }
    },
    onEscape: () => {
      setIsPopoverOpen(false);
      inputRef.current?.blur();
    },
  });

  useShortcutsOnRouteFocused(EShortcutEvents.ChangeCurrentTabUrl, () => {
    if (platformEnv.isDesktop) {
      inputRef.current?.focus();
    }
  });

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
          setIsPopoverOpen(true);
        }}
        onBlur={handleInputBlur}
        selectTextOnFocus
        testID="explore-index-search-input"
        onFocus={() => setIsPopoverOpen(true)}
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
        isOpen={isPopoverOpen}
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
                setIsPopoverOpen(false);
              }}
            />
          </Stack>
        </ScrollView>
      </SearchPopover>
    </Stack>
  );
}

export default HeaderLeftToolBarInput;
