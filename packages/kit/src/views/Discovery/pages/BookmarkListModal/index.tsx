import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Input,
  Page,
  SortableListView,
  Toast,
  XStack,
  useMedia,
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
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EEnterMethod } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/dapp';

import { DiscoveryIcon } from '../../components/DiscoveryIcon';
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
                    id: ETranslations.global_name,
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
              id: ETranslations.explore_bookmark_renamed,
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
      buildBookmarkData({ data });
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
  const { gtMd } = useMedia();
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
          renderItem={({ item, getIndex, drag, dragProps }) => (
            <ListItem
              h={CELL_HEIGHT}
              testID={`search-modal-${item.url.toLowerCase()}`}
              {...(!isEditing && {
                onPress: () => {
                  handleOpenWebSite({
                    navigation,
                    switchToMultiTabBrowser: gtMd,
                    webSite: {
                      url: item.url,
                      title: item.title,
                    },
                  });
                  defaultLogger.discovery.dapp.enterDapp({
                    dappDomain: item.url,
                    dappName: item.title,
                    enterMethod: EEnterMethod.bookmark,
                  });
                },
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
