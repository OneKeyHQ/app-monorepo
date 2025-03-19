import { useCallback, useEffect, useRef, useState } from 'react';

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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
}: ISearchResultContentProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const jumpPageRef = useRef(false);
  const handleWebSite = useWebSiteHandler();

  // State for keeping track of keyboard navigation
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedSection, setSelectedSection] = useState<
    'search' | 'bookmark' | 'history'
  >('search');

  // References to track the number of items in each section
  const searchListRef = useRef<HTMLDivElement>(null);
  const bookmarkListRef = useRef<HTMLDivElement>(null);
  const historyListRef = useRef<HTMLDivElement>(null);

  // Get total number of items in each section
  const searchCount = displaySearchList ? searchList.length : 0;
  const bookmarkCount = displayBookmarkList
    ? localData?.bookmarkData?.length || 0
    : 0;
  const historyCount = displayHistoryList
    ? localData?.historyData?.length || 0
    : 0;

  // Reset selection when search results change
  useEffect(() => {
    setSelectedIndex(-1);
    if (displaySearchList) {
      setSelectedSection('search');
    } else if (displayBookmarkList) {
      setSelectedSection('bookmark');
    } else if (displayHistoryList) {
      setSelectedSection('history');
    }
  }, [displaySearchList, displayBookmarkList, displayHistoryList, searchValue]);

  // Handlers for different types of items
  const handleSearchItemClick = useCallback(
    (item: IDApp) => {
      onItemClick?.(item);

      if (item.dappId === SEARCH_ITEM_ID) {
        handleWebSite({
          webSite: {
            url: searchValue,
            title: searchValue,
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
        },
        useCurrentWindow,
        tabId,
        enterMethod: EEnterMethod.historyInSearch,
      });
    },
    [handleWebSite, onItemClick, tabId, useCurrentWindow],
  );

  // Handle keyboard navigation
  useEffect(() => {
    if (!platformEnv.isDesktop) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();

        if (selectedIndex === -1) {
          // First item selection
          setSelectedIndex(0);
          return;
        }

        if (selectedSection === 'search' && selectedIndex < searchCount - 1) {
          // Navigate within search section
          setSelectedIndex(selectedIndex + 1);
        } else if (
          selectedSection === 'search' &&
          selectedIndex === searchCount - 1
        ) {
          // Move to bookmark section
          if (displayBookmarkList) {
            setSelectedSection('bookmark');
            setSelectedIndex(0);
          } else if (displayHistoryList) {
            // Skip to history if bookmarks are not displayed
            setSelectedSection('history');
            setSelectedIndex(0);
          }
        } else if (
          selectedSection === 'bookmark' &&
          selectedIndex < bookmarkCount - 1
        ) {
          // Navigate within bookmark section
          setSelectedIndex(selectedIndex + 1);
        } else if (
          selectedSection === 'bookmark' &&
          selectedIndex === bookmarkCount - 1
        ) {
          // Move to history section
          if (displayHistoryList) {
            setSelectedSection('history');
            setSelectedIndex(0);
          }
        } else if (
          selectedSection === 'history' &&
          selectedIndex < historyCount - 1
        ) {
          // Navigate within history section
          setSelectedIndex(selectedIndex + 1);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();

        if (selectedIndex === -1) {
          // Select last item when pressing up from no selection
          if (displayHistoryList) {
            setSelectedSection('history');
            setSelectedIndex(historyCount - 1);
          } else if (displayBookmarkList) {
            setSelectedSection('bookmark');
            setSelectedIndex(bookmarkCount - 1);
          } else if (displaySearchList) {
            setSelectedSection('search');
            setSelectedIndex(searchCount - 1);
          }
          return;
        }

        if (selectedSection === 'search' && selectedIndex > 0) {
          // Navigate within search section
          setSelectedIndex(selectedIndex - 1);
        } else if (selectedSection === 'bookmark' && selectedIndex > 0) {
          // Navigate within bookmark section
          setSelectedIndex(selectedIndex - 1);
        } else if (selectedSection === 'bookmark' && selectedIndex === 0) {
          // Move back to search section
          if (displaySearchList) {
            setSelectedSection('search');
            setSelectedIndex(searchCount - 1);
          }
        } else if (selectedSection === 'history' && selectedIndex > 0) {
          // Navigate within history section
          setSelectedIndex(selectedIndex - 1);
        } else if (selectedSection === 'history' && selectedIndex === 0) {
          // Move back to bookmark section
          if (displayBookmarkList) {
            setSelectedSection('bookmark');
            setSelectedIndex(bookmarkCount - 1);
          } else if (displaySearchList) {
            // Skip back to search if bookmarks are not displayed
            setSelectedSection('search');
            setSelectedIndex(searchCount - 1);
          }
        }
      } else if (e.key === 'Enter') {
        // Trigger click on selected item
        if (selectedIndex !== -1) {
          e.preventDefault();

          if (selectedSection === 'search' && displaySearchList) {
            const item = searchList[selectedIndex];
            handleSearchItemClick(item);
          } else if (
            selectedSection === 'bookmark' &&
            displayBookmarkList &&
            localData?.bookmarkData
          ) {
            const item = localData.bookmarkData[selectedIndex];
            handleBookmarkItemClick(item);
          } else if (
            selectedSection === 'history' &&
            displayHistoryList &&
            localData?.historyData
          ) {
            const item = localData.historyData[selectedIndex];
            handleHistoryItemClick(item);
          }
        }
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    selectedIndex,
    selectedSection,
    searchCount,
    bookmarkCount,
    historyCount,
    displaySearchList,
    displayBookmarkList,
    displayHistoryList,
    handleSearchItemClick,
    handleBookmarkItemClick,
    handleHistoryItemClick,
    searchList,
    localData?.bookmarkData,
    localData?.historyData,
  ]);

  const renderList = useCallback(
    (list: IDApp[]) =>
      list.map((item, index) => (
        <ListItem
          key={index}
          avatarProps={{
            src: item.logo || item.originLogo,
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
          renderItemText={() => (
            <RichSizeableText
              linkList={{ a: { url: undefined, cursor: 'auto' } }}
              numberOfLines={1}
              size="$bodyLgMedium"
              flex={1}
            >
              {item?.keyword
                ? item.name.replace(
                    new RegExp(item.keyword, 'ig'),
                    `<a>${item.keyword}</a>`,
                  )
                : item.name}
            </RichSizeableText>
          )}
          subtitleProps={{
            numberOfLines: 1,
          }}
          bg={
            selectedSection === 'search' && selectedIndex === index
              ? '$bgActive'
              : undefined
          }
          onPress={() => handleSearchItemClick(item)}
          testID={`dapp-search${index}`}
        />
      )),
    [handleSearchItemClick, selectedSection, selectedIndex],
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
              jumpPageRef.current = true;
              navigation.pushModal(EModalRoutes.DiscoveryModal, {
                screen: EDiscoveryModalRoutes.BookmarkListModal,
              });
            }}
          />
          <XStack $gtMd={{ px: '$3' }}>
            {localData?.bookmarkData?.map((item, index) => (
              <Stack
                key={index}
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
                bg={
                  selectedSection === 'bookmark' && selectedIndex === index
                    ? '$bgActive'
                    : undefined
                }
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
              jumpPageRef.current = true;
              navigation.pushModal(EModalRoutes.DiscoveryModal, {
                screen: EDiscoveryModalRoutes.HistoryListModal,
              });
            }}
          />
          {localData?.historyData.map((item, index) => (
            <ListItem
              key={index}
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
              bg={
                selectedSection === 'history' && selectedIndex === index
                  ? '$bgActive'
                  : undefined
              }
              onPress={() => handleHistoryItemClick(item)}
            />
          ))}
        </Stack>
      ) : null}
    </>
  );
}
