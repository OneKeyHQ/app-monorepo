import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Input, Popover, Stack, XStack } from '@onekeyhq/components';
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

export function SearchInput() {
  const intl = useIntl();
  const [searchValue, setSearchValue] = useState('');
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
    if (platformEnv.isDesktop) {
      navigation.pushModal(EModalRoutes.DiscoveryModal, {
        screen: EDiscoveryModalRoutes.SearchModal,
      });
    }
  }, [navigation]);

  const hasResults =
    displaySearchList || displayBookmarkList || displayHistoryList;

  const inputContent = (
    <Stack
      position="relative"
      width="100%"
      $gtSm={{ w: 384 }}
      onPress={handleSearchBarPress}
      pressStyle={{
        opacity: 0.8,
      }}
      cursor="pointer"
    >
      <Input
        testID="search-input"
        placeholder={intl.formatMessage({
          id: ETranslations.browser_search_dapp_or_enter_url,
        })}
        readonly
        size="large"
        leftIconName="SearchOutline"
        onFocus={handleSearchBarPress}
        value={searchValue}
        onChangeText={setSearchValue}
        addOns={
          hasResults
            ? [
                {
                  iconName: 'ChevronDownSmallOutline',
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

  if (!hasResults) {
    return inputContent;
  }

  return (
    <Popover
      title="Search Results"
      placement="bottom-end"
      renderTrigger={inputContent}
      renderContent={({ closePopover }) => (
        <Stack p="$2" maxHeight={400}>
          <SearchResultContent
            searchValue={searchValue}
            localData={localData}
            searchList={searchList}
            displaySearchList={displaySearchList}
            displayBookmarkList={displayBookmarkList}
            displayHistoryList={displayHistoryList}
            SEARCH_ITEM_ID={SEARCH_ITEM_ID}
            onItemClick={() => {
              closePopover();
            }}
          />
        </Stack>
      )}
    />
  );
}
