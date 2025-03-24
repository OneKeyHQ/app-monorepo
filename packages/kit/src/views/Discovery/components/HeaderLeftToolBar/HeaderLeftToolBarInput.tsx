import { useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ColorTokens, Icon } from '@onekeyhq/components';
import { Input, Popover, ScrollView, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { useSearchModalData } from '../../hooks/useSearchModalData';
import { SearchPopover } from '../../pages/Dashboard/Welcome/SearchPopover';
import { formatHiddenHttpsUrl } from '../../utils/explorerUtils';
import { DappInfoPopoverContent } from '../DappInfoPopoverContent';
import { SearchResultContent } from '../SearchResultContent';

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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollViewRef = useRef(null);
  const searchResultRef = useRef(null);
  const { hiddenHttpsUrl } = formatHiddenHttpsUrl(url);

  const {
    localData,
    searchList,
    displaySearchList,
    displayHistoryList,
    SEARCH_ITEM_ID,
    refreshLocalData,
  } = useSearchModalData(searchValue);

  return (
    <Stack flex={1}>
      <Input
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
        value={hiddenHttpsUrl || ''}
        selectTextOnFocus
        testID="explore-index-search-input"
        onChangeText={(text) => {
          setSearchValue(text);
          setIsPopoverVisible(true);
        }}
        onFocus={() => setIsPopoverVisible(true)}
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
          mx: 24,
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
