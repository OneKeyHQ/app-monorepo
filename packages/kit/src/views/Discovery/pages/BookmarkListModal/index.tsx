import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IDragEndParamsWithItem } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Empty,
  Page,
  SortableListView,
  Toast,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { RenameInputWithNameSelector } from '@onekeyhq/kit/src/components/RenameDialog';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useBrowserBookmarkAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EEnterMethod } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/dapp';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';

import { DiscoveryIcon } from '../../components/DiscoveryIcon';
import { useWebSiteHandler } from '../../hooks/useWebSiteHandler';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import type { IBrowserBookmark } from '../../types';

function BookmarkListModal() {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const { sortBrowserBookmark, removeBrowserBookmark, modifyBrowserBookmark } =
    useBrowserBookmarkAction().current;
  const handleWebSite = useWebSiteHandler();

  const [dataSource, setDataSource] = useState<IBrowserBookmark[]>([]);
  const { run: refreshLocalData, result } = usePromiseResult(
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

  useEffect(() => {
    const refreshBookmarkHandler = () => {
      setTimeout(() => {
        void refreshLocalData();
      }, 200);
    };

    appEventBus.on(
      EAppEventBusNames.RefreshBookmarkList,
      refreshBookmarkHandler,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.RefreshBookmarkList,
        refreshBookmarkHandler,
      );
    };
  }, [refreshLocalData]);

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
                    id: ETranslations.explore_bookmark_at_least,
                  }),
                },
                validate: (value: string) => {
                  if (!value?.trim()) {
                    return intl.formatMessage({
                      id: ETranslations.explore_bookmark_at_least,
                    });
                  }
                  return true;
                },
              }}
            >
              <RenameInputWithNameSelector
                disabledMaxLengthLabel
                nameHistoryInfo={{
                  entityId: item.url,
                  entityType: EChangeHistoryEntityType.BrowserBookmark,
                  contentType: EChangeHistoryContentType.Name,
                }}
              />
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
              id: ETranslations.explore_bookmark_renamed,
            }),
          });
        },
      });
    },
    [modifyBrowserBookmark, intl],
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
    },
    [removeBrowserBookmark, dataSource],
  );
  // Auto goBack when no bookmark
  useEffect(() => {
    if (removeBookmarkFlagRef.current && result?.length === 0) {
      navigation.pop();
      removeBookmarkFlagRef.current = false;
    }
  }, [result?.length, navigation]);

  const onSortBookmarks = useCallback(
    async (params: IDragEndParamsWithItem<IBrowserBookmark>) => {
      const { data, dragItem, prevItem, nextItem } = params;

      setDataSource(data);
      await sortBrowserBookmark({
        target: dragItem,
        prev: prevItem,
        next: nextItem,
      });
    },
    [sortBrowserBookmark],
  );

  const handleItemPress = useCallback(
    (item: IBrowserBookmark) => {
      handleWebSite({
        webSite: {
          url: item.url,
          title: item.title,
          logo: item.logo,
          sortIndex: undefined,
        },
        enterMethod: EEnterMethod.bookmark,
        shouldPopNavigation: true,
      });
    },
    [handleWebSite],
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
    <Page lazyLoad>
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
          onDragEnd={onSortBookmarks}
          ListEmptyComponent={
            <Empty
              py="$32"
              my="$4"
              icon="BookmarkOutline"
              title={intl.formatMessage({
                id: ETranslations.explore_no_bookmark,
              })}
            />
          }
          renderItem={({ item, getIndex, drag, dragProps }) => (
            <ListItem
              h={CELL_HEIGHT}
              testID={`search-modal-${item.url.toLowerCase()}`}
              {...(!isEditing && {
                onPress: () => handleItemPress(item),
              })}
            >
              {isEditing ? (
                <ListItem.IconButton
                  title={intl.formatMessage({
                    id: ETranslations.global_remove,
                  })}
                  key="remove"
                  icon="MinusCircleSolid"
                  iconProps={{
                    color: '$iconCritical',
                  }}
                  onPress={() => {
                    void deleteCell(getIndex);
                    Toast.success({
                      title: intl.formatMessage({
                        id: ETranslations.explore_removed_success,
                      }),
                    });
                  }}
                  testID="action-list-item-rename"
                />
              ) : null}
              <ListItem.Avatar
                avatar={<DiscoveryIcon size="$10" uri={item.logo} />}
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
                <XStack gap="$6">
                  <ListItem.IconButton
                    title={intl.formatMessage({
                      id: ETranslations.explore_rename,
                    })}
                    key="rename"
                    icon="PencilOutline"
                    onPress={() => onRename(item)}
                    testID="action-list-item-rename"
                  />
                  <ListItem.IconButton
                    key="darg"
                    cursor="move"
                    icon="DragOutline"
                    onPressIn={drag}
                    dataSet={dragProps}
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
