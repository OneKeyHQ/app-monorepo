import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Icon,
  Image,
  RichSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EEnterMethod } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/dapp';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IDApp } from '@onekeyhq/shared/types/discovery';

import { useWebSiteHandler } from '../hooks/useWebSiteHandler';
import { DappSearchModalSectionHeader } from '../pages/SearchModal/DappSearchModalSectionHeader';

import { DiscoveryIcon } from './DiscoveryIcon';

import type { ILocalDataType } from '../hooks/useSearchModalData';

const LoadingSkeleton = (
  <Image.Loading>
    <Skeleton width="100%" height="100%" />
  </Image.Loading>
);

export interface ISearchResultContentRef {
  openSelectedItem: () => void;
}

interface ISearchResultContentProps {
  searchValue: string;
  localData: ILocalDataType | null;
  searchList: IDApp[];
  displaySearchList: boolean;
  displayBookmarkList: boolean;
  displayHistoryList: boolean;
  SEARCH_ITEM_ID: string;
  useCurrentWindow?: boolean;
  tabId?: string;
  onItemClick?: (
    item: IDApp | { url: string; title: string; logo?: string },
  ) => void;
  selectedIndex?: number;
  innerRef?: React.RefObject<ISearchResultContentRef>;
}

export function SearchResultContent({
  searchValue,
  localData,
  searchList,
  displaySearchList,
  displayBookmarkList,
  displayHistoryList,
  SEARCH_ITEM_ID,
  useCurrentWindow,
  tabId,
  onItemClick,
  selectedIndex = -1,
  innerRef,
}: ISearchResultContentProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const handleWebSite = useWebSiteHandler();

  // State for keeping track of which section is active
  const [selectedSection, setSelectedSection] = useState<
    'search' | 'bookmark' | 'history'
  >('search');

  // References to track the number of items in each section
  const searchListRef = useRef<any>(null);
  const bookmarkListRef = useRef<any>(null);
  const historyListRef = useRef<any>(null);

  // References to track individual item elements
  const searchItemsRef = useRef<any[]>([]);
  const bookmarkItemsRef = useRef<any[]>([]);
  const historyItemsRef = useRef<any[]>([]);

  // Get total number of items in each section
  const searchCount = displaySearchList ? searchList.length : 0;
  const bookmarkCount = displayBookmarkList
    ? localData?.bookmarkData?.length || 0
    : 0;
  const historyCount = displayHistoryList
    ? localData?.historyData?.length || 0
    : 0;

  // Helper functions to calculate adjusted indices
  const getAdjustedBookmarkIndex = useCallback(() => {
    if (selectedSection !== 'bookmark') return -1;
    return displaySearchList ? selectedIndex - searchCount : selectedIndex;
  }, [selectedSection, selectedIndex, displaySearchList, searchCount]);

  const getAdjustedHistoryIndex = useCallback(() => {
    if (selectedSection !== 'history') return -1;

    if (displaySearchList && displayBookmarkList) {
      return selectedIndex - searchCount - bookmarkCount;
    }

    if (displaySearchList) {
      return selectedIndex - searchCount;
    }

    if (displayBookmarkList) {
      return selectedIndex - bookmarkCount;
    }

    return selectedIndex;
  }, [
    selectedSection,
    selectedIndex,
    displaySearchList,
    displayBookmarkList,
    searchCount,
    bookmarkCount,
  ]);

  // Section-specific index calculation as memoized values
  const searchIndex = useCallback(
    (index: number) => selectedSection === 'search' && selectedIndex === index,
    [selectedSection, selectedIndex],
  );

  const bookmarkIndex = useCallback(
    (index: number) =>
      selectedSection === 'bookmark' && getAdjustedBookmarkIndex() === index,
    [selectedSection, getAdjustedBookmarkIndex],
  );

  const historyIndex = useCallback(
    (index: number) =>
      selectedSection === 'history' && getAdjustedHistoryIndex() === index,
    [selectedSection, getAdjustedHistoryIndex],
  );

  // Update selectedSection based on displayedSections and selectedIndex
  useEffect(() => {
    // Default section based on what's displayed
    if (selectedIndex === -1) {
      if (displaySearchList) {
        setSelectedSection('search');
      } else if (displayBookmarkList) {
        setSelectedSection('bookmark');
      } else if (displayHistoryList) {
        setSelectedSection('history');
      }
      return;
    }

    // Determine which section the selectedIndex belongs to
    if (displaySearchList && selectedIndex < searchCount) {
      setSelectedSection('search');
    } else if (displayBookmarkList) {
      const adjustedIndex = displaySearchList
        ? selectedIndex - searchCount
        : selectedIndex;
      if (adjustedIndex >= 0 && adjustedIndex < bookmarkCount) {
        setSelectedSection('bookmark');
      }
    } else if (displayHistoryList) {
      const combinedCount =
        (displaySearchList ? searchCount : 0) +
        (displayBookmarkList ? bookmarkCount : 0);
      if (selectedIndex >= combinedCount) {
        setSelectedSection('history');
      }
    }
  }, [
    selectedIndex,
    displaySearchList,
    displayBookmarkList,
    displayHistoryList,
    searchCount,
    bookmarkCount,
    historyCount,
  ]);

  // Handlers for different types of items
  const handleSearchItemClick = useCallback(
    (item: IDApp) => {
      onItemClick?.(item);

      if (item.dappId === SEARCH_ITEM_ID) {
        handleWebSite({
          webSite: {
            url: searchValue,
            title: searchValue,
            logo: undefined,
            sortIndex: undefined,
          },
          useCurrentWindow,
          tabId,
          enterMethod: EEnterMethod.search,
        });
      } else {
        handleWebSite({
          dApp: item,
          useCurrentWindow,
          tabId,
          enterMethod: EEnterMethod.search,
        });
      }
    },
    [
      SEARCH_ITEM_ID,
      handleWebSite,
      onItemClick,
      searchValue,
      tabId,
      useCurrentWindow,
    ],
  );

  const handleBookmarkItemClick = useCallback(
    (item: { url: string; title: string; logo?: string }) => {
      onItemClick?.(item);

      handleWebSite({
        webSite: {
          url: item.url,
          title: item.title,
          logo: item.logo,
          sortIndex: undefined,
        },
        useCurrentWindow,
        tabId,
        enterMethod: EEnterMethod.bookmarkInSearch,
      });
    },
    [handleWebSite, onItemClick, tabId, useCurrentWindow],
  );

  const handleHistoryItemClick = useCallback(
    (item: { url: string; title: string; logo?: string }) => {
      onItemClick?.(item);

      handleWebSite({
        webSite: {
          url: item.url,
          title: item.title,
          logo: item.logo,
          sortIndex: undefined,
        },
        useCurrentWindow,
        tabId,
        enterMethod: EEnterMethod.historyInSearch,
      });
    },
    [handleWebSite, onItemClick, tabId, useCurrentWindow],
  );

  const openSelectedItem = useCallback(() => {
    // Priority: Check if first item is exact URL match when no item is manually selected
    try {
      if (
        displaySearchList &&
        searchList.length > 0 &&
        searchList[0].isExactUrl &&
        selectedIndex === -1
      ) {
        handleSearchItemClick(searchList[0]);
        return { type: 'exactUrl' };
      }
    } catch (error) {
      console.error('SearchResultContent.openSelectedItem failed:', error);
    }

    if (
      selectedSection === 'search' &&
      displaySearchList &&
      searchList[selectedIndex]
    ) {
      handleSearchItemClick(searchList[selectedIndex]);
      return { type: 'search' };
    }

    if (
      selectedSection === 'bookmark' &&
      displayBookmarkList &&
      localData?.bookmarkData
    ) {
      const adjustedIndex = getAdjustedBookmarkIndex();
      if (adjustedIndex >= 0 && adjustedIndex < localData.bookmarkData.length) {
        handleBookmarkItemClick(localData.bookmarkData[adjustedIndex]);
      }
      return { type: 'bookmark' };
    }

    if (
      selectedSection === 'history' &&
      displayHistoryList &&
      localData?.historyData
    ) {
      const adjustedIndex = getAdjustedHistoryIndex();
      if (adjustedIndex >= 0 && adjustedIndex < localData.historyData.length) {
        handleHistoryItemClick(localData.historyData[adjustedIndex]);
      }
      return { type: 'history' };
    }

    if (searchValue) {
      handleSearchItemClick({
        dappId: SEARCH_ITEM_ID,
        name: searchValue,
        logo: '',
        description: '',
        url: searchValue,
        networkIds: [],
        tags: [],
      });
      return { type: 'search' };
    }

    return { type: 'null' };
  }, [
    selectedSection,
    displaySearchList,
    searchList,
    selectedIndex,
    displayBookmarkList,
    localData?.bookmarkData,
    localData?.historyData,
    displayHistoryList,
    searchValue,
    handleSearchItemClick,
    getAdjustedBookmarkIndex,
    handleBookmarkItemClick,
    getAdjustedHistoryIndex,
    handleHistoryItemClick,
    SEARCH_ITEM_ID,
  ]);

  // Expose functions to parent components
  useImperativeHandle(
    innerRef,
    () => ({
      openSelectedItem,
    }),
    [openSelectedItem],
  );

  const renderList = useCallback(
    (list: IDApp[]) =>
      list.map((item, index) => (
        <ListItem
          key={index}
          // @ts-expect-error
          ref={
            ((el: any) => {
              searchItemsRef.current[index] = el;
            }) as any
          }
          avatarProps={{
            src: item.logo || item.originLogo,
            loading: LoadingSkeleton,
            bg: '$bgStrong',
            fallbackProps: {
              bg: '$transparent',
              justifyContent: 'center',
              alignItems: 'center',
              children: <Icon name="GlobusOutline" />,
            },
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: '$borderSubdued',
          }}
          renderItemText={() => (
            <RichSizeableText
              linkList={{ a: { url: undefined, cursor: 'auto' } }}
              numberOfLines={1}
              size="$bodyLgMedium"
              flex={1}
            >
              {item?.keyword
                ? item.name.replace(
                    new RegExp(
                      item.keyword.replace(/[[\]()+?*^$.|\\{}]/g, '\\$&'),
                      'ig',
                    ),
                    (match) => `<a>${match}</a>`,
                  )
                : item.name}
            </RichSizeableText>
          )}
          subtitleProps={{
            numberOfLines: 1,
          }}
          bg={searchIndex(index) ? '$bgActive' : undefined}
          onPress={() => handleSearchItemClick(item)}
          testID={`dapp-search${index}`}
        />
      )),
    [handleSearchItemClick, searchIndex],
  );

  return (
    <>
      {displaySearchList ? (
        <Stack ref={searchListRef}>{renderList(searchList)}</Stack>
      ) : null}

      {displayBookmarkList ? (
        <Stack ref={bookmarkListRef}>
          <DappSearchModalSectionHeader
            title={intl.formatMessage({
              id: ETranslations.explore_bookmarks,
            })}
            onMorePress={() => {
              navigation.pushModal(EModalRoutes.DiscoveryModal, {
                screen: EDiscoveryModalRoutes.BookmarkListModal,
              });
            }}
          />
          <XStack $gtMd={{ px: '$3' }}>
            {localData?.bookmarkData?.map((item, index) => (
              <Stack
                key={index}
                ref={(el) => {
                  bookmarkItemsRef.current[index] = el;
                }}
                flexBasis="25%"
                alignItems="center"
                py="$2"
                $gtMd={{
                  flexBasis: '16.66666667%',
                }}
                onPress={() => handleBookmarkItemClick(item)}
                focusStyle={{ bg: '$bgActive' }}
                hoverStyle={{ bg: '$bgHover' }}
                pressStyle={{ bg: '$bgActive' }}
                borderRadius="$3"
                bg={bookmarkIndex(index) ? '$bgActive' : undefined}
              >
                <DiscoveryIcon uri={item.logo} size="$14" borderRadius="$3" />
                <SizableText
                  mt="$2"
                  px="$2"
                  size="$bodyLgMedium"
                  textAlign="center"
                  $gtMd={{
                    size: '$bodyMdMedium',
                  }}
                  numberOfLines={1}
                >
                  {item.title}
                </SizableText>
              </Stack>
            ))}
          </XStack>
        </Stack>
      ) : null}
      {displayHistoryList ? (
        <Stack pt="$5" ref={historyListRef}>
          <DappSearchModalSectionHeader
            title={intl.formatMessage({
              id: ETranslations.browser_recently_closed,
            })}
            onMorePress={() => {
              navigation.pushModal(EModalRoutes.DiscoveryModal, {
                screen: EDiscoveryModalRoutes.HistoryListModal,
              });
            }}
          />
          {localData?.historyData.map((item, index) => (
            <ListItem
              key={index}
              // @ts-expect-error
              ref={(el: any) => {
                historyItemsRef.current[index] = el;
              }}
              avatarProps={{
                src: item.logo,
                loading: LoadingSkeleton,
                fallbackProps: {
                  bg: '$bgStrong',
                  justifyContent: 'center',
                  alignItems: 'center',
                  children: <Icon name="GlobusOutline" />,
                },
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: '$borderSubdued',
              }}
              title={item.title}
              titleMatch={item.titleMatch}
              titleProps={{
                numberOfLines: 1,
              }}
              subtitle={item.url}
              subTitleMatch={item.urlMatch}
              subtitleProps={{
                numberOfLines: 1,
              }}
              testID={`search-modal-${item.title.toLowerCase()}`}
              bg={historyIndex(index) ? '$bgActive' : undefined}
              onPress={() => handleHistoryItemClick(item)}
            />
          ))}
        </Stack>
      ) : null}
    </>
  );
}
