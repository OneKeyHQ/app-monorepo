import { useCallback, useMemo, useState } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Divider,
  Empty,
  Icon,
  IconButton,
  ListItem,
  Page,
  SectionList,
  SizableText,
  Skeleton,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useBrowserAction,
  useBrowserHistoryAction,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { formatHistoryRecordDate } from '@onekeyhq/shared/src/utils/formatDateUtils';

import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import type { IBrowserHistory } from '../../types';

function groupDataByDate(data: IBrowserHistory[]) {
  const groups = data.reduce<{ [date: string]: IBrowserHistory[] }>(
    (result, item) => {
      const date = formatHistoryRecordDate(item.createdAt);
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

  const [page] = useState(1);

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

  const handleDeleteAll = useCallback(async () => {
    await removeAllBrowserHistory();
    setTimeout(() => {
      void run();
    }, 200);
  }, [run, removeAllBrowserHistory]);

  const headerRight = useCallback(
    () => (
      <XStack>
        {isEditing && (
          <>
            <IconButton
              variant="tertiary"
              icon="BroomOutline"
              title="Clear All"
              onPress={() => {
                Dialog.show({
                  title: 'Clear All History?',
                  description:
                    'Are you sure you want to delete all your browsing history? This action cannot be undone.',
                  onConfirm: () => handleDeleteAll(),
                  confirmButtonProps: {
                    variant: 'secondary',
                  },
                  onConfirmText: 'Clear All',
                });
              }}
            />
            <Divider vertical mx="$3" />
          </>
        )}
        <Button
          variant="tertiary"
          size="medium"
          onPress={() => setIsEditing((prev) => !prev)}
        >
          {isEditing ? 'Done' : 'Edit'}
        </Button>
      </XStack>
    ),
    [handleDeleteAll, isEditing],
  );

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: 'transaction__history' })}
        headerRight={headerRight}
      />
      <Page.Body>
        <SectionList
          height="100%"
          estimatedItemSize="$10"
          extraData={isEditing}
          sections={isNil(dataSource) ? [] : dataSource}
          renderSectionHeader={({ section: { title } }) => (
            <SectionList.SectionHeader title={title} />
          )}
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
              {isEditing && (
                <ListItem.IconButton
                  icon="DeleteOutline"
                  onPress={() => {
                    void removeBrowserHistory(item.id);
                    setTimeout(() => {
                      void run();
                    }, 200);
                    Toast.success({
                      title: 'Remove Success',
                    });
                  }}
                />
              )}
            </ListItem>
          )}
        />
      </Page.Body>
    </Page>
  );
}

export default withBrowserProvider(HistoryListModal);
