import { useCallback, useEffect, useRef, useState } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Divider,
  IconButton,
  Page,
  SectionList,
  Skeleton,
  Toast,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useBrowserAction,
  useBrowserHistoryAction,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatRelativeDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import type { IBrowserHistory } from '../../types';

function groupDataByDate(data: IBrowserHistory[]) {
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
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { removeBrowserHistory, removeAllBrowserHistory } =
    useBrowserHistoryAction().current;

  const { handleOpenWebSite } = useBrowserAction().current;

  const [page, setPage] = useState(1);
  const { result: dataSource, run } = usePromiseResult(
    async () => {
      const data = await backgroundApiProxy.serviceDiscovery.fetchHistoryData(
        page,
      );
      const ret = groupDataByDate(data);
      return ret;
    },
    [page],
    {
      watchLoading: true,
    },
  );

  const removeHistoryFlagRef = useRef(false);
  const handleDeleteAll = useCallback(async () => {
    await removeAllBrowserHistory();
    removeHistoryFlagRef.current = true;
    setTimeout(() => {
      void run();
    }, 200);
  }, [run, removeAllBrowserHistory]);

  useEffect(() => {
    if (removeHistoryFlagRef.current && dataSource?.length === 0) {
      navigation.pop();
      removeHistoryFlagRef.current = false;
    }
  }, [navigation, dataSource?.length]);

  const headerRight = useCallback(
    () => (
      <XStack>
        {isEditing ? (
          <>
            <IconButton
              variant="tertiary"
              icon="BroomOutline"
              title={intl.formatMessage({
                id: ETranslations.explore_remove_all,
              })}
              onPress={() => {
                Dialog.show({
                  title: intl.formatMessage({
                    id: ETranslations.explore_clear_history_prompt,
                  }),
                  description: intl.formatMessage({
                    id: ETranslations.explore_clear_history_message,
                  }),
                  onConfirm: () => handleDeleteAll(),
                  onConfirmText: intl.formatMessage({
                    id: ETranslations.explore_remove_all,
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
        title={intl.formatMessage({ id: ETranslations.explore_history })}
        headerRight={headerRight}
      />
      <Page.Body>
        <SectionList
          testID="History-SectionList"
          height="100%"
          estimatedItemSize="$10"
          extraData={isEditing}
          sections={isNil(dataSource) ? [] : dataSource}
          renderSectionHeader={({ section: { title } }) => (
            <SectionList.SectionHeader title={title} />
          )}
          keyExtractor={keyExtractor}
          renderItem={({ item }: { item: IBrowserHistory }) => (
            <ListItem
              key={item.id}
              avatarProps={{
                src: item.logo,
                fallbackProps: {
                  children: <Skeleton w="$10" h="$10" />,
                },
              }}
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
                  handleOpenWebSite({
                    navigation,
                    webSite: {
                      url: item.url,
                      title: item.title,
                    },
                  });
                },
              })}
            >
              {isEditing ? (
                <ListItem.IconButton
                  icon="DeleteOutline"
                  onPress={() => {
                    void removeBrowserHistory(item.id);
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
            setPage((prev) => prev + 1);
          }}
        />
      </Page.Body>
    </Page>
  );
}

export default withBrowserProvider(HistoryListModal);
