import { useCallback, useMemo, useState } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Empty,
  IconButton,
  ListItem,
  Page,
  SectionList,
  SizableText,
  Skeleton,
  Stack,
  Toast,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useBrowserAction,
  useBrowserHistoryAction,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { formatRelativeDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import type { IBrowserHistory } from '../../types';

function groupDataByDate(data: IBrowserHistory[]) {
  const groups = data.reduce<{ [date: string]: IBrowserHistory[] }>(
    (result, item) => {
      const date = formatRelativeDate(item.createdAt);
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

  const displayEmptyView = useMemo(() => {
    if (isNil(dataSource)) return false;
    return dataSource.length === 0;
  }, [dataSource]);

  const handleDeleteAll = useCallback(async () => {
    await removeAllBrowserHistory();
    setTimeout(() => {
      void run();
    }, 200);
  }, [run, removeAllBrowserHistory]);

  return (
    <Page>
      <Page.Header title={intl.formatMessage({ id: 'transaction__history' })} />
      <Page.Body>
        <Stack flex={1}>
          <Stack px="$4" flexDirection="row" justifyContent="flex-end">
            <Button
              w="auto"
              size="small"
              onPress={() => {
                Dialog.show({
                  title: 'Delete All ?',
                  onConfirm: () => handleDeleteAll(),
                });
              }}
            >
              Delete All
            </Button>
          </Stack>
          {displayEmptyView ? (
            <Stack flex={1} alignItems="center" justifyContent="center">
              <Empty
                icon="CloudOffOutline"
                title="No Historys yes."
                description="To add a History, tap more in your browser."
              />
            </Stack>
          ) : (
            <SectionList
              height="100%"
              estimatedItemSize="$10"
              sections={isNil(dataSource) ? [] : dataSource}
              renderSectionHeader={({ section: { title } }) => (
                <Stack bg="$bg" p="$3">
                  <SizableText size="$headingXs">{title}</SizableText>
                </Stack>
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
                  subtitle={item.url}
                  subtitleProps={{
                    numberOfLines: 1,
                  }}
                  testID={`search-modal-${item.url.toLowerCase()}`}
                  onPress={() => {
                    handleOpenWebSite({
                      navigation,
                      webSite: {
                        url: item.url,
                        title: item.title,
                      },
                    });
                  }}
                >
                  <IconButton
                    icon="ArchiveOutline"
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
                </ListItem>
              )}
            />
          )}
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default withBrowserProvider(HistoryListModal);
