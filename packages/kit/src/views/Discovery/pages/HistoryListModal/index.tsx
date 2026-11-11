import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { NativeList } from '@onekeyfe/react-native-native-list';
import { isEqual } from 'lodash';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import {
  Button,
  Dialog,
  Divider,
  Empty,
  IconButton,
  Page,
  Toast,
  XStack,
  useTheme,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useBrowserHistoryAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EEnterMethod } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/dapp';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { formatRelativeDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { useHomeNativeListTheme } from '../../../Home/hooks/useHomeNativeListTheme';
import { buildBrowserSiteRow } from '../../components/browserSiteNativeRow';
import { useWebSiteHandler } from '../../hooks/useWebSiteHandler';
import { DiscoveryTestIDs } from '../../testIDs';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import type { IBrowserHistory } from '../../types';
import type {
  NativeListSnapshot,
  RowActionEvent,
  RowModel,
} from '@onekeyfe/react-native-native-list';

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

  const handleWebSite = useWebSiteHandler();

  const [page, setPage] = useState(1);
  const { result: dataSource = [], run } = usePromiseResult(async () => {
    const data =
      await backgroundApiProxy.serviceDiscovery.fetchHistoryData(page);

    return data;
  }, [page]);

  const previousDataRef = useRef<IBrowserHistory[] | undefined>(undefined);
  const cachedResultRef = useRef<{ title: string; data: IBrowserHistory[] }[]>(
    [],
  );

  const memoizedDataSource = useMemo(() => {
    // Only recalculate if data actually changed
    if (!dataSource || dataSource.length === 0) {
      previousDataRef.current = dataSource;
      cachedResultRef.current = [];
      return [];
    }

    // Use deep comparison to check if data really changed
    if (
      previousDataRef.current &&
      isEqual(dataSource, previousDataRef.current)
    ) {
      return cachedResultRef.current;
    }

    // Data changed, recalculate
    const newResult = groupDataByDate(dataSource);
    previousDataRef.current = dataSource;
    cachedResultRef.current = newResult;

    return newResult;
  }, [dataSource]);

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
              testID="history-clear-all-button"
              title={intl.formatMessage({
                id: ETranslations.explore_remove_all,
              })}
              onPress={() => {
                Dialog.show({
                  title: intl.formatMessage({
                    id: ETranslations.browser_clear_recently_closed,
                  }),
                  description: intl.formatMessage({
                    id: ETranslations.browser_clear_recently_closed_description,
                  }),
                  onConfirm: () => handleDeleteAll(),
                  onConfirmText: intl.formatMessage({
                    id: ETranslations.global_clear,
                  }),
                });
              }}
            />
            {platformEnv.isNativeIOS26Plus ? null : (
              <Divider vertical mx="$3" />
            )}
          </>
        ) : null}
        <Button
          testID="discovery-btn"
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

  const debouncedOnEndReached = useDebouncedCallback(() => {
    setPage((prev) => prev + 1);
  }, 500);

  const theme = useHomeNativeListTheme();
  const colors = useTheme();
  const generationRef = useRef(0);
  const historyById = useMemo(
    () => new Map((dataSource ?? []).map((item) => [item.id, item])),
    [dataSource],
  );
  const snapshot = useMemo<NativeListSnapshot>(() => {
    generationRef.current += 1;
    const rows: RowModel[] = [];
    memoizedDataSource.forEach((section) => {
      const sectionKey = `section:${section.title}`;
      rows.push({
        key: `header:${section.title}`,
        type: 'sectionHeader',
        sectionKey,
        title: section.title,
        height: 36,
        heightRounding: 'nearest',
        pressDisabled: true,
        style: {
          container: { contentVerticalAlignment: 'bottom' },
          horizontalPadding: 12,
          verticalPadding: 4,
          title: {
            fontSize: 14,
            lineHeight: 20,
            fontWeight: 'medium',
            color: theme.secondaryText,
            lines: 1,
            truncate: 'tail',
          },
        },
      });
      section.data.forEach((item) => {
        rows.push({
          ...buildBrowserSiteRow({
            key: item.id,
            title: item.title,
            url: item.url,
            logo: item.logo,
            theme,
            borderColor: colors.borderSubdued.val,
            editing: isEditing,
            testID: `search-modal-${item.url.toLowerCase()}`,
            trailing: [
              {
                kind: 'icon',
                name: 'DeleteOutline',
                actionKey: 'delete',
                accessibilityLabel: intl.formatMessage({
                  id: ETranslations.global_remove,
                }),
              },
            ],
          }),
          sectionKey,
        });
      });
    });
    return {
      schemaVersion: 1,
      generation: generationRef.current,
      layout: {
        kind: 'sectioned',
        stickyHeaders: false,
        contentPaddingHorizontal: 8,
      },
      capabilities: { loadMore: true, endReachedThreshold: 0.2 },
      theme,
      rows,
    };
  }, [memoizedDataSource, isEditing, theme, colors, intl]);

  const onRowAction = useCallback(
    (event: RowActionEvent) => {
      const item = event.rowKey ? historyById.get(event.rowKey) : undefined;
      if (!item) return;
      if (event.actionKey === 'press') {
        if (isEditing) return;
        handleWebSite({
          webSite: {
            url: item.url,
            title: item.title,
            logo: item.logo,
            sortIndex: undefined,
          },
          enterMethod: EEnterMethod.history,
        });
      } else if (event.actionKey === 'delete') {
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
      }
    },
    [historyById, isEditing, handleWebSite, removeBrowserHistory, run, intl],
  );

  return (
    <Page testID={DiscoveryTestIDs.historyListPage}>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.browser_recently_closed,
        })}
        headerRight={headerRight}
      />
      <Page.Body>
        {memoizedDataSource.length === 0 ? (
          <Empty
            py="$32"
            my="$4"
            icon="ClockTimeHistoryOutline"
            title={intl.formatMessage({
              id: ETranslations.browser_no_closed_tabs,
            })}
          />
        ) : (
          <NativeList
            testID="History-SectionList"
            style={{ flex: 1 }}
            snapshot={snapshot}
            onRowAction={onRowAction}
            onEndReached={debouncedOnEndReached}
          />
        )}
      </Page.Body>
    </Page>
  );
}

export default withBrowserProvider(HistoryListModal);
