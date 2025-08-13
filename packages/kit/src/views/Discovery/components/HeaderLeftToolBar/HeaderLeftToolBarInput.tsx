import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ColorTokens, IScrollViewRef, Icon } from '@onekeyhq/components';
import { Input, Popover, ScrollView, Stack } from '@onekeyhq/components';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { useShortcutsOnRouteFocused } from '@onekeyhq/kit/src/hooks/useShortcutsOnRouteFocused';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { useSearchModalData } from '../../hooks/useSearchModalData';
import { useSearchPopover } from '../../hooks/useSearchPopover';
import { useSearchPopoverShortcutsFeatureFlag } from '../../hooks/useSearchPopoverFeatureFlag';
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
  isLoading?: boolean;
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
  isLoading,
}: IHeaderLeftToolBarInputProps) {
  const intl = useIntl();
  const [dappInfoIsOpen, setDappInfoIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [internalValue, setInternalValue] = useState('');
  const scrollViewRef = useRef<IScrollViewRef>(null);
  const searchResultRef = useRef<ISearchResultContentRef>(null);
  const inputRef = useRef<TextInput>(null);
  const { hiddenHttpsUrl } = formatHiddenHttpsUrl(url);
  const searchPopoverShortcutsFeatureFlag =
    useSearchPopoverShortcutsFeatureFlag();

  const resetInputToUrl = useCallback(() => {
    if (hiddenHttpsUrl) {
      setInternalValue(hiddenHttpsUrl);
      setSearchValue(hiddenHttpsUrl);
    }
  }, [hiddenHttpsUrl]);

  useEffect(() => {
    resetInputToUrl();
  }, [resetInputToUrl]);

  useEffect(() => {
    if (isLoading) {
      resetInputToUrl();
    }
  }, [isLoading, resetInputToUrl]);

  const {
    localData,
    searchList,
    displaySearchList,
    displayHistoryList,
    SEARCH_ITEM_ID,
    totalItems,
    refreshLocalData,
  } = useSearchModalData(searchValue);

  const {
    selectedIndex,
    handleKeyDown,
    handleInputBlur,
    isPopoverVisible,
    setIsPopoverOpen,
  } = useSearchPopover({
    refreshLocalData,
    scrollViewRef: scrollViewRef as any,
    totalItems,
    searchValue,
    displaySearchList,
    displayHistoryList,
    onEnterPress: () => {
      if (searchResultRef.current) {
        searchResultRef.current.openSelectedItem();
        setIsPopoverOpen(false);
      }

      inputRef.current?.blur();
    },
    onEscape: () => {
      inputRef.current?.blur();
    },
  });

  useShortcutsOnRouteFocused(EShortcutEvents.ChangeCurrentTabUrl, () => {
    if (searchPopoverShortcutsFeatureFlag) {
      inputRef.current?.focus();
    }
  });

  useShortcutsOnRouteFocused(EShortcutEvents.Refresh, () => {
    if (searchPopoverShortcutsFeatureFlag) {
      inputRef.current?.blur();

      if (hiddenHttpsUrl) {
        setInternalValue(hiddenHttpsUrl);
      }
    }
  });

  useListenTabFocusState(ETabRoutes.Discovery, () => {
    resetInputToUrl();
  });

  return (
    <Stack
      flex={1}
      onPress={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
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
          title={intl.formatMessage({ id: ETranslations.global_info })}
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
              useCurrentWindow={!isPinned}
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
