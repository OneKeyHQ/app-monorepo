import { useCallback, useRef } from 'react';

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
}: ISearchResultContentProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const jumpPageRef = useRef(false);
  const handleWebSite = useWebSiteHandler();

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
          onPress={() => {
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
          }}
          testID={`dapp-search${index}`}
        />
      )),
    [handleWebSite, searchValue, tabId, useCurrentWindow, SEARCH_ITEM_ID],
  );

  return (
    <>
      {displaySearchList ? renderList(searchList) : null}

      {displayBookmarkList ? (
        <Stack>
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
                onPress={() => {
                  handleWebSite({
                    webSite: {
                      url: item.url,
                      title: item.title,
                    },
                    useCurrentWindow,
                    tabId,
                    enterMethod: EEnterMethod.bookmarkInSearch,
                  });
                }}
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
        <Stack pt="$5">
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
              onPress={() => {
                handleWebSite({
                  webSite: {
                    url: item.url,
                    title: item.title,
                  },
                  useCurrentWindow,
                  tabId,
                  enterMethod: EEnterMethod.historyInSearch,
                });
              }}
            />
          ))}
        </Stack>
      ) : null}
    </>
  );
}
