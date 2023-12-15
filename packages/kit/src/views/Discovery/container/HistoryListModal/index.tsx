import { useCallback, useMemo, useState } from 'react';

import dayjs from 'dayjs';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Empty,
  IconButton,
  ListItem,
  Page,
  SectionList,
  Skeleton,
  Stack,
  Text,
  Toast,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useBrowserHistoryAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  EDiscoveryModalRoutes,
  type IDiscoveryModalParamList,
} from '../../router/Routes';
import { getUrlIcon } from '../../utils/explorerUtils';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import type { IBrowserHistory } from '../../types';

function formatDate(timestamp: number) {
  const today = dayjs().startOf('day');
  const yesterday = dayjs().subtract(1, 'day').startOf('day');

  const inputDate = dayjs(timestamp);

  if (inputDate.isSame(today, 'day')) {
    return 'Today';
  }
  if (inputDate.isSame(yesterday, 'day')) {
    return 'Yesterday';
  }

  return inputDate.format('YYYY-MM-DD');
}

function groupDataByDate(data: IBrowserHistory[]) {
  const groups = data.reduce<{ [date: string]: IBrowserHistory[] }>(
    (result, item) => {
      const date = formatDate(item.createdAt);
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
  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();
  const { removeBrowserHistory } = useBrowserHistoryAction().current;

  const [page] = useState(1);

  const [firstLoad, setFirstLoad] = useState<boolean>(true);
  const { isLoading, result, run } = usePromiseResult(
    async () => {
      const data = await backgroundApiProxy.serviceDiscovery.fetchHistoryData(
        page,
      );
      const ret = groupDataByDate(data);
      setFirstLoad(false);
      return ret;
    },
    [page],
    {
      watchLoading: true,
    },
  );

  const dataSource = useMemo(() => result ?? [], [result]);

  const displayEmptyView = useMemo(() => {
    if (firstLoad) return false;
    return dataSource.length === 0;
  }, [dataSource, firstLoad]);

  const handleDeleteAll = useCallback(async () => {
    await backgroundApiProxy.serviceDiscovery.clearBrowserHistory();
    void run();
    return true;
  }, [run]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: 'transaction__history' })}
        headerSearchBarOptions={{
          autoFocus: true,
          placeholder: 'Search',
          inputType: 'text',
          hideNavigationBar: true,
          hideWhenScrolling: false,
          onChangeText: ({ nativeEvent }) => {
            console.log(nativeEvent.text);
          },
        }}
      />
      <Page.Body>
        <Stack flex={1}>
          <Button
            onPress={() => {
              Dialog.show({
                title: 'Delete All ?',
                onConfirm: () => handleDeleteAll(),
              });
            }}
          >
            Delete All
          </Button>
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
              sections={dataSource}
              renderSectionHeader={({ section: { title } }) => (
                <Stack bg="$bg">
                  <Text variant="$headingXs">{title}</Text>
                </Stack>
              )}
              renderItem={({ item }: { item: IBrowserHistory }) => (
                <ListItem
                  key={item.id}
                  avatarProps={{
                    src: getUrlIcon(item.url),
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
                    console.log('===>onPress');
                  }}
                >
                  <IconButton
                    icon="ArchiveOutline"
                    onPress={() => {
                      void removeBrowserHistory(item.id);
                      setTimeout(() => {
                        void run();
                      });
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
