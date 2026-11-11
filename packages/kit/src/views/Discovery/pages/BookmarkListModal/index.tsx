import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { NativeList } from '@onekeyfe/react-native-native-list';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Empty,
  Page,
  Toast,
  useTheme,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
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

import { useHomeNativeListTheme } from '../../../Home/hooks/useHomeNativeListTheme';
import { buildBrowserSiteRow } from '../../components/browserSiteNativeRow';
import { useWebSiteHandler } from '../../hooks/useWebSiteHandler';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import type { IBrowserBookmark } from '../../types';
import type {
  NativeListSnapshot,
  ReorderEvent,
  RowActionEvent,
  RowModel,
} from '@onekeyfe/react-native-native-list';

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
  const deleteBookmark = useCallback(
    async (item: IBrowserBookmark) => {
      await removeBrowserBookmark(item.url);
      removeBookmarkFlagRef.current = true;
    },
    [removeBrowserBookmark],
  );
  // Auto goBack when no bookmark
  useEffect(() => {
    if (removeBookmarkFlagRef.current && result?.length === 0) {
      navigation.pop();
      removeBookmarkFlagRef.current = false;
    }
  }, [result?.length, navigation]);

  const onReorder = useCallback(
    async (event: ReorderEvent) => {
      const fromIndex = dataSource.findIndex((item) => item.url === event.key);
      if (fromIndex < 0) return;
      const data = [...dataSource];
      const [dragItem] = data.splice(fromIndex, 1);
      const toIndex = Math.max(0, Math.min(event.toIndex, data.length));
      data.splice(toIndex, 0, dragItem);
      setDataSource(data);
      await sortBrowserBookmark({
        target: dragItem,
        prev: data[toIndex - 1],
        next: data[toIndex + 1],
      });
    },
    [dataSource, sortBrowserBookmark],
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
      });
    },
    [handleWebSite],
  );

  const headerRight = useCallback(
    () => (
      <Button
        testID="discovery-header-right-btn"
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

  const theme = useHomeNativeListTheme();
  const colors = useTheme();
  const generationRef = useRef(0);
  const snapshot = useMemo<NativeListSnapshot>(() => {
    generationRef.current += 1;
    const rows: RowModel[] = dataSource.map((item) =>
      buildBrowserSiteRow({
        key: item.url,
        title: item.title,
        url: item.url,
        logo: item.logo,
        theme,
        borderColor: colors.borderSubdued.val,
        editing: isEditing,
        testID: `search-modal-${item.url.toLowerCase()}`,
        leadingAction: {
          kind: 'icon',
          name: 'MinusCircleSolid',
          tintColor: colors.iconCritical.val,
          actionKey: 'remove',
          accessibilityLabel: intl.formatMessage({
            id: ETranslations.global_remove,
          }),
        },
        trailing: [
          {
            kind: 'icon',
            name: 'PencilOutline',
            actionKey: 'rename',
            testID: 'action-list-item-rename',
            accessibilityLabel: intl.formatMessage({
              id: ETranslations.explore_rename,
            }),
          },
          { kind: 'drag' },
        ],
      }),
    );
    return {
      schemaVersion: 1,
      generation: generationRef.current,
      layout: { kind: 'linear', contentPaddingHorizontal: 8 },
      capabilities: {
        // cspell:ignore reorderable
        reorderable: isEditing,
        reorderActivation: 'handle',
      },
      theme,
      rows,
    };
  }, [dataSource, isEditing, theme, colors, intl]);

  const onRowAction = useCallback(
    (event: RowActionEvent) => {
      const item = dataSource.find((bookmark) => bookmark.url === event.rowKey);
      if (!item) return;
      if (event.actionKey === 'press') {
        if (!isEditing) handleItemPress(item);
      } else if (event.actionKey === 'rename') {
        onRename(item);
      } else if (event.actionKey === 'remove') {
        void deleteBookmark(item);
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.explore_removed_success,
          }),
        });
      }
    },
    [dataSource, isEditing, handleItemPress, onRename, deleteBookmark, intl],
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
        {result && dataSource.length === 0 ? (
          <Empty
            py="$32"
            my="$4"
            icon="BookmarkOutline"
            title={intl.formatMessage({
              id: ETranslations.explore_no_bookmark,
            })}
          />
        ) : (
          <NativeList
            style={{ flex: 1 }}
            snapshot={snapshot}
            onRowAction={onRowAction}
            onReorder={(event) => {
              void onReorder(event);
            }}
          />
        )}
      </Page.Body>
    </Page>
  );
}

export default withBrowserProvider(BookmarkListModal);
