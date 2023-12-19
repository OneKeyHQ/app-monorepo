import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Button,
  Dialog,
  Empty,
  IconButton,
  Input,
  ListItem,
  Page,
  Skeleton,
  SortableCell,
  SortableListView,
  Stack,
  SwipeableCell,
  Toast,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETabRoutes } from '@onekeyhq/kit/src/routes/Tab/type';
import {
  useBrowserAction,
  useBrowserBookmarkAction,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { type IDiscoveryModalParamList } from '../../router/Routes';
import { getUrlIcon } from '../../utils/explorerUtils';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import type { IBrowserBookmark } from '../../types';

function BookmarkListModal() {
  const intl = useIntl();
  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();
  const { buildBookmarkData, removeBrowserBookmark, modifyBrowserBookmark } =
    useBrowserBookmarkAction().current;
  const { openMatchDApp } = useBrowserAction().current;

  const [firstLoad, setFirstLoad] = useState<boolean>(true);
  const [dataSource, setDataSource] = useState<IBrowserBookmark[]>([]);
  const { run } = usePromiseResult(
    async () => {
      const data =
        await backgroundApiProxy.simpleDb.browserBookmarks.getRawData();
      setFirstLoad(false);
      setDataSource((data?.data as IBrowserBookmark[]) || []);
      return (data?.data as IBrowserBookmark[]) || [];
    },
    [],
    {
      watchLoading: true,
    },
  );

  const displayEmptyView = useMemo(() => {
    if (firstLoad) return false;
    return dataSource.length === 0;
  }, [dataSource, firstLoad]);

  const onRename = useCallback(
    (item: IBrowserBookmark) => {
      console.log('Rename');
      Dialog.confirm({
        title: item.title,
        description: item.title,
        renderContent: (
          <Dialog.Form
            formProps={{
              defaultValues: { name: item.title },
            }}
          >
            <Dialog.FormField name="name">
              <Input autoFocus flex={1} />
            </Dialog.FormField>
          </Dialog.Form>
        ),
        onConfirm: (dialogInstance) => {
          // @ts-expect-error
          // eslint-disable-next-line no-unsafe-optional-chaining, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          const { name } = dialogInstance.getForm()?.getValues();
          console.log(name);
          void modifyBrowserBookmark({ ...item, title: name });
          setTimeout(() => {
            void run();
          }, 200);
        },
      });
    },
    [modifyBrowserBookmark, run],
  );

  const [isEditing, setIsEditing] = useState(false);
  const deleteCell = useCallback(
    async (getIndex: () => number | undefined) => {
      const index = getIndex();
      if (index === undefined) {
        return;
      }
      await removeBrowserBookmark(dataSource[index].url);
      setTimeout(() => {
        void run();
      }, 200);
    },
    [removeBrowserBookmark, run, dataSource],
  );
  const onSortBookmarks = useCallback(
    (data: IBrowserBookmark[]) => {
      buildBookmarkData(data);
      setDataSource(data);
    },
    [buildBookmarkData],
  );

  const CELL_HEIGHT = 44;

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: 'actionn__bookmark' })}
        headerSearchBarOptions={{
          autoFocus: false,
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
          <Stack px="$4" flexDirection="row" justifyContent="flex-end">
            <Button
              w="$20"
              size="small"
              onPress={() => {
                setIsEditing((prev) => !prev);
              }}
            >
              Edit
            </Button>
          </Stack>
          {displayEmptyView ? (
            <Stack flex={1} alignItems="center" justifyContent="center">
              <Empty
                icon="CloudOffOutline"
                title="No Bookmarks yes."
                description="To add a bookmark, tap more in your browser."
              />
            </Stack>
          ) : (
            <SortableListView
              data={dataSource}
              keyExtractor={(item) => item.url}
              getItemLayout={(_, index) => ({
                length: CELL_HEIGHT,
                offset: index * CELL_HEIGHT,
                index,
              })}
              onDragEnd={(ret) => onSortBookmarks(ret.data)}
              renderItem={({ item, getIndex, drag, isActive }) => (
                <SwipeableCell
                  swipeEnabled={!isEditing}
                  rightItemList={[
                    {
                      width: 200,
                      title: 'DELETE',
                      backgroundColor: '$bgCriticalStrong',
                      onPress: ({ close }) => {
                        close?.();
                        void deleteCell(getIndex);
                      },
                    },
                  ]}
                >
                  <SortableCell
                    h={CELL_HEIGHT}
                    isEditing={isEditing}
                    alignItems="center"
                    justifyContent="center"
                    drag={drag}
                    isActive={isActive}
                    onDeletePress={() => {
                      void deleteCell(getIndex);
                    }}
                  >
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
                        void openMatchDApp({
                          id: '',
                          webSite: {
                            url: item.url,
                            title: item.title,
                          },
                          isNewWindow: true,
                        });
                        if (platformEnv.isDesktop) {
                          navigation.switchTab(ETabRoutes.MultiTabBrowser);
                        } else {
                          navigation.pop();
                        }
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
                  </SortableCell>
                </SwipeableCell>
              )}
            />
          )}
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default withBrowserProvider(BookmarkListModal);
