import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Divider,
  Empty,
  IconButton,
  Page,
  SectionList,
  Toast,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useBrowserHistoryAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EEnterMethod } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/dapp';
import { formatRelativeDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { DiscoveryIcon } from '../../components/DiscoveryIcon';
import { useWebSiteHandler } from '../../hooks/useWebSiteHandler';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import type { IBrowserHistory } from '../../types';

function groupDataByDate(
  prev: { title: string; data: IBrowserHistory[] }[],
  data: IBrowserHistory[],
) {
  const groups = data.reduce<{ [date: string]: IBrowserHistory[] }>(
    (result, item) => {
      const date = formatRelativeDate(new Date(item.createdAt));
      if (result[date]) {
        result[date].push(item);
      } else {
        result[date] = [item];
      }
      return result;
    },
    {},
  );

  return Object.keys(groups).map((key) => ({ title: key, data: groups[key] }));
}

function HistoryListModal() {
  const [isEditing, setIsEditing] = useState(false);
  const [allHistoryData, setAllHistoryData] = useState<IBrowserHistory[]>([]);
  const [dataSource, setDataSource] = useState<
    {
      title: string;
      data: IBrowserHistory[];
    }[]
  >([]);
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { removeBrowserHistory, removeAllBrowserHistory } =
    useBrowserHistoryAction().current;

  const handleWebSite = useWebSiteHandler();

  const [page, setPage] = useState(1);

  const { run } = usePromiseResult(async () => {
    const data = await backgroundApiProxy.serviceDiscovery.fetchHistoryData(
      page,
    );

    if (page === 1) {
      setAllHistoryData(data);
    } else {
      setAllHistoryData((prev) => [...prev, ...data]);
    }

    return data;
  }, [page]);

  useEffect(() => {
    setDataSource((prev) => {
      groupDataByDate(prev, allHistoryData);
      return prev;
    });
  }, [allHistoryData]);

  const removeHistoryFlagRef = useRef(false);
  const handleDeleteAll = useCallback(async () => {
    await removeAllBrowserHistory();
    setAllHistoryData([]);
    removeHistoryFlagRef.current = true;
    setTimeout(() => {
      void run();
    }, 200);
  }, [run, removeAllBrowserHistory]);

  useEffect(() => {
    if (removeHistoryFlagRef.current && allHistoryData.length === 0) {
      navigation.pop();
      removeHistoryFlagRef.current = false;
    }
  }, [navigation, allHistoryData.length]);

  console.log('dataSource', dataSource);

  const headerRight = useCallback(
    () => (
      <XStack>
        {isEditing ? (
          <>
            <IconButton
              variant="tertiary"
              icon="BroomOutline"
              testID="history-clear-all-button"
              title={intl.formatMessage({
                id: ETranslations.explore_remove_all,
              })}
              onPress={() => {
                Dialog.show({
                  title: intl.formatMessage({
                    id: ETranslations.browser_clear_recently_closed,
                  }),
                  description: intl.formatMessage({
                    id: ETranslations.browser_clear_recently_closed_description,
                  }),
                  onConfirm: () => handleDeleteAll(),
                  onConfirmText: intl.formatMessage({
                    id: ETranslations.global_clear,
                  }),
                });
              }}
            />
            <Divider vertical mx="$3" />
          </>
        ) : null}
        <Button
          variant="tertiary"
          size="medium"
          onPress={() => setIsEditing((prev) => !prev)}
        >
          {isEditing
            ? intl.formatMessage({ id: ETranslations.global_done })
            : intl.formatMessage({ id: ETranslations.global_edit })}
        </Button>
      </XStack>
    ),
    [handleDeleteAll, isEditing, intl],
  );

  const keyExtractor = useCallback(
    (item: unknown) => (item as IBrowserHistory).id,
    [],
  );

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.browser_recently_closed,
        })}
        headerRight={headerRight}
      />
      <Page.Body>
        <SectionList
          testID="History-SectionList"
          height="100%"
          ListEmptyComponent={
            <Empty
              py="$32"
              my="$4"
              icon="ClockTimeHistoryOutline"
              title={intl.formatMessage({
                id: ETranslations.browser_no_closed_tabs,
              })}
            />
          }
          estimatedItemSize="$16"
          extraData={isEditing}
          sections={isNil(dataSource) ? [] : dataSource}
          renderSectionHeader={({ section: { title } }) => (
            <SectionList.SectionHeader title={title} />
          )}
          keyExtractor={keyExtractor}
          renderItem={({ item }: { item: IBrowserHistory }) => (
            <ListItem
              key={item.id}
              renderAvatar={<DiscoveryIcon uri={item.logo} size="$10" />}
              title={item.title}
              titleProps={{
                numberOfLines: 1,
              }}
              subtitle={item.url}
              subtitleProps={{
                numberOfLines: 1,
              }}
              testID={`search-modal-${item.url.toLowerCase()}`}
              {...(!isEditing && {
                onPress: () => {
                  handleWebSite({
                    webSite: {
                      url: item.url,
                      title: item.title,
                      logo: item.logo,
                      sortIndex: undefined,
                    },
                    shouldPopNavigation: true,
                    enterMethod: EEnterMethod.history,
                  });
                },
              })}
            >
              {isEditing ? (
                <ListItem.IconButton
                  icon="DeleteOutline"
                  onPress={() => {
                    void removeBrowserHistory(item.id);
                    setAllHistoryData((prev) =>
                      prev.filter((historyItem) => historyItem.id !== item.id),
                    );
                    removeHistoryFlagRef.current = true;
                    setTimeout(() => {
                      void run();
                    }, 200);
                    Toast.success({
                      title: intl.formatMessage({
                        id: ETranslations.explore_removed_success,
                      }),
                    });
                  }}
                />
              ) : null}
            </ListItem>
          )}
          onEndReached={() => {
            console.log('onEndReached', page);
            setPage((prev) => prev + 1);
          }}
          onEndReachedThreshold={0.5}
        />
      </Page.Body>
    </Page>
  );
}

export default withBrowserProvider(HistoryListModal);
