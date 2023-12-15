import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Button,
  Dialog,
  Empty,
  IconButton,
  Input,
  ListItem,
  ListView,
  Page,
  Skeleton,
  Stack,
  Toast,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useBrowserBookmarkAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  EDiscoveryModalRoutes,
  type IDiscoveryModalParamList,
} from '../../router/Routes';
import { getUrlIcon } from '../../utils/explorerUtils';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import type { IBrowserBookmark } from '../../types';

function BookmarkListModal() {
  const intl = useIntl();
  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();
  const { removeBrowserBookmark } = useBrowserBookmarkAction().current;

  const [firstLoad, setFirstLoad] = useState<boolean>(true);
  const { isLoading, result, run } = usePromiseResult(
    async () => {
      const data =
        await backgroundApiProxy.simpleDb.browserBookmarks.getRawData();
      setFirstLoad(false);
      return (data?.data as IBrowserBookmark[]) || [];
    },
    [],
    {
      watchLoading: true,
    },
  );

  const dataSource = useMemo(() => result ?? [], [result]);

  const displayEmptyView = useMemo(() => {
    if (firstLoad) return false;
    return dataSource.length === 0;
  }, [dataSource, firstLoad]);

  const [editTitle, setEditTitle] = useState<string>('');
  const onRename = useCallback(
    (item: IBrowserBookmark) => {
      setEditTitle('ABC');
      console.log('Rename');
      Dialog.show({
        title: item.title,
        description: item.title,
        renderContent: <Input value={editTitle} onChangeText={setEditTitle} />,
        onConfirm: () => {},
      });
    },
    [editTitle],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: 'actionn__bookmark' })}
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
          <Button>Edit</Button>
          {displayEmptyView ? (
            <Stack flex={1} alignItems="center" justifyContent="center">
              <Empty
                icon="CloudOffOutline"
                title="No Bookmarks yes."
                description="To add a bookmark, tap more in your browser."
              />
            </Stack>
          ) : (
            <ListView
              height="100%"
              estimatedItemSize="$10"
              data={dataSource}
              keyExtractor={(item) => item.url}
              renderItem={({ item }) => (
                <ListItem
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
                  <ActionList
                    title="Action List"
                    placement="right-start"
                    renderTrigger={
                      <IconButton
                        size="small"
                        icon="DotHorOutline"
                        variant="tertiary"
                        focusStyle={undefined}
                        p="$0.5"
                        m={-3}
                        testID="browser-bar-options"
                      />
                    }
                    items={[
                      {
                        label: 'Rename',
                        icon: 'StarSolid',
                        onPress: () => {
                          onRename(item);
                        },
                        testID: `action-list-item-rename`,
                      },
                      {
                        label: 'Remove Bookmark',
                        icon: 'ThumbtackSolid',
                        onPress: () => {
                          void removeBrowserBookmark(item.url);
                          Toast.success({
                            title: intl.formatMessage({
                              id: 'msg__bookmark_removed',
                            }),
                          });
                          void run();
                        },
                        testID: `action-list-item-rename`,
                      },
                    ]}
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

export default withBrowserProvider(BookmarkListModal);
