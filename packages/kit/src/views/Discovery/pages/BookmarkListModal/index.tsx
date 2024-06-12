import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Input,
  Page,
  Skeleton,
  SortableListView,
  Toast,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useBrowserAction,
  useBrowserBookmarkAction,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import type { IBrowserBookmark } from '../../types';

function BookmarkListModal() {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const { buildBookmarkData, removeBrowserBookmark, modifyBrowserBookmark } =
    useBrowserBookmarkAction().current;
  const { handleOpenWebSite } = useBrowserAction().current;

  const [dataSource, setDataSource] = useState<IBrowserBookmark[]>([]);
  const { run, result } = usePromiseResult(
    async () => {
      const bookmarks =
        await backgroundApiProxy.serviceDiscovery.getBookmarkData({
          generateIcon: true,
        });
      setDataSource(bookmarks || []);
      return bookmarks || [];
    },
    [],
    {
      watchLoading: true,
    },
  );

  const onRename = useCallback(
    (item: IBrowserBookmark) => {
      Dialog.confirm({
        title: intl.formatMessage({
          id: ETranslations.explore_rename,
        }),
        renderContent: (
          <Dialog.Form
            formProps={{
              defaultValues: { name: item.title },
            }}
          >
            <Dialog.FormField
              name="name"
              rules={{
                required: {
                  value: true,
                  message: intl.formatMessage({
                    id: ETranslations.explore_enter_bookmark_name,
                  }),
                },
                minLength: {
                  value: 1,
                  message: intl.formatMessage({
                    id: ETranslations.explore_bookmark_at_least,
                  }),
                },
                maxLength: {
                  value: 24,
                  message: intl.formatMessage({
                    id: ETranslations.explore_bookmark_exceed,
                  }),
                },
              }}
            >
              <Input autoFocus flex={1} />
            </Dialog.FormField>
          </Dialog.Form>
        ),
        onConfirm: (dialogInstance) => {
          const form = dialogInstance.getForm()?.getValues();
          if (form?.name) {
            void modifyBrowserBookmark({ ...item, title: form.name });
          }
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.explore_removed_success,
            }),
          });
          setTimeout(() => {
            void run();
          }, 200);
        },
      });
    },
    [modifyBrowserBookmark, run, intl],
  );

  const removeBookmarkFlagRef = useRef(false);
  const [isEditing, setIsEditing] = useState(false);
  const deleteCell = useCallback(
    async (getIndex: () => number | undefined) => {
      const index = getIndex();
      if (index === undefined) {
        return;
      }
      await removeBrowserBookmark(dataSource[index].url);
      removeBookmarkFlagRef.current = true;
      setTimeout(async () => {
        await run();
      }, 200);
    },
    [removeBrowserBookmark, run, dataSource],
  );
  // Auto goBack when no bookmark
  useEffect(() => {
    if (removeBookmarkFlagRef.current && result?.length === 0) {
      navigation.pop();
      removeBookmarkFlagRef.current = false;
    }
  }, [result?.length, navigation]);

  const onSortBookmarks = useCallback(
    (data: IBrowserBookmark[]) => {
      buildBookmarkData(data);
      setDataSource(data);
    },
    [buildBookmarkData],
  );

  const CELL_HEIGHT = 60;

  const headerRight = useCallback(
    () => (
      <Button
        variant="tertiary"
        onPress={() => {
          setIsEditing((prev) => !prev);
        }}
      >
        {isEditing
          ? intl.formatMessage({
              id: ETranslations.global_done,
            })
          : intl.formatMessage({
              id: ETranslations.global_edit,
            })}
      </Button>
    ),
    [isEditing, intl],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.explore_bookmarks,
        })}
        headerRight={headerRight}
      />
      <Page.Body>
        <SortableListView
          data={dataSource}
          enabled={isEditing}
          keyExtractor={(item) => `${item.url}`}
          getItemLayout={(_, index) => ({
            length: CELL_HEIGHT,
            offset: index * CELL_HEIGHT,
            index,
          })}
          onDragEnd={(ret) => onSortBookmarks(ret.data)}
          renderItem={({ item, getIndex, drag }) => (
            <ListItem
              h={CELL_HEIGHT}
              testID={`search-modal-${item.url.toLowerCase()}`}
              {...(!isEditing && {
                onPress: () =>
                  handleOpenWebSite({
                    navigation,
                    webSite: {
                      url: item.url,
                      title: item.title,
                    },
                  }),
              })}
            >
              {isEditing ? (
                <ListItem.IconButton
                  title={intl.formatMessage({
                    id: ETranslations.global_remove,
                  })}
                  key="remove"
                  animation="quick"
                  enterStyle={{
                    opacity: 0,
                    scale: 0,
                  }}
                  icon="MinusCircleSolid"
                  iconProps={{
                    color: '$iconCritical',
                  }}
                  onPress={() => {
                    void deleteCell(getIndex);
                    void removeBrowserBookmark(item.url);
                    Toast.success({
                      title: intl.formatMessage({
                        id: ETranslations.explore_removed_success,
                      }),
                    });
                    void run();
                  }}
                  testID="action-list-item-rename"
                />
              ) : null}
              <ListItem.Avatar
                src={item.logo}
                fallbackProps={{
                  children: <Skeleton w="$10" h="$10" />,
                }}
              />
              <ListItem.Text
                primary={item.title}
                primaryTextProps={{
                  numberOfLines: 1,
                }}
                secondary={item.url}
                secondaryTextProps={{
                  numberOfLines: 1,
                }}
                flex={1}
              />
              {isEditing ? (
                <XStack space="$6">
                  <ListItem.IconButton
                    title={intl.formatMessage({
                      id: ETranslations.explore_rename,
                    })}
                    key="rename"
                    animation="quick"
                    enterStyle={{
                      opacity: 0,
                      scale: 0,
                    }}
                    icon="PencilOutline"
                    onPress={() => onRename(item)}
                    testID="action-list-item-rename"
                  />
                  <ListItem.IconButton
                    key="darg"
                    animation="quick"
                    enterStyle={{
                      opacity: 0,
                      scale: 0,
                    }}
                    cursor="move"
                    icon="DragOutline"
                    onPressIn={drag}
                  />
                </XStack>
              ) : null}
            </ListItem>
          )}
        />
      </Page.Body>
    </Page>
  );
}

export default withBrowserProvider(BookmarkListModal);
