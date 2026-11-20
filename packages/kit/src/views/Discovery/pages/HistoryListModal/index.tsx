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
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EEnterMethod } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/dapp';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { formatRelativeDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { useHomeNativeListTheme } from '../../../Home/hooks/useHomeNativeListTheme';
import {
  BROWSER_SITE_AUTO_ROW_HEIGHT,
  buildBrowserSectionHeaderRow,
  buildBrowserSectionSeparatorRow,
  buildBrowserSiteRow,
} from '../../components/browserSiteNativeRow';
import { useWebSiteHandler } from '../../hooks/useWebSiteHandler';
import { DiscoveryTestIDs } from '../../testIDs';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import type { IBrowserHistory } from '../../types';
import type {
  EndReachedEvent,
  NativeListSnapshot,
  RowActionEvent,
  RowModel,
} from '@onekeyfe/react-native-native-list';

type IHistoryPage = {
  page: number;
  data: IBrowserHistory[];
  hasMore: boolean;
};

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
  const lastSuccessfulPage = useRef<IHistoryPage | undefined>(undefined);
  const { result, run, setResult, isLoading } = usePromiseResult(
    async (): Promise<IHistoryPage | null> => {
      try {
        const history =
          await backgroundApiProxy.serviceDiscovery.fetchHistoryData(page);
        return { ...history, page };
      } catch {
        return null;
      }
    },
    [page],
    { watchLoading: true, checkIsFocused: false },
  );
  useEffect(() => {
    if (result) lastSuccessfulPage.current = result;
  }, [result]);
  const visiblePage = result ?? lastSuccessfulPage.current;
  const dataSource = visiblePage?.data;
  const canLoadMore = !isLoading && result?.page === page && result.hasMore;
  const needsRetry = result === null;

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
  const deleteHistory = useCallback(
    async (id?: string) => {
      let saved: boolean;
      try {
        saved =
          id === undefined
            ? await removeAllBrowserHistory()
            : await removeBrowserHistory(id);
      } catch (error) {
        errorToastUtils.showToastOfError(error);
        return;
      }
      if (!saved) return;

      const removeDeletedRows = (loadedPage: IHistoryPage): IHistoryPage =>
        id === undefined
          ? { ...loadedPage, data: [], hasMore: false }
          : {
              ...loadedPage,
              data: loadedPage.data.filter((entry) => entry.id !== id),
            };
      // Replace both the displayed page and the fallback before refreshing.
      const cachedPage = lastSuccessfulPage.current;
      const updatedCache = cachedPage && removeDeletedRows(cachedPage);
      lastSuccessfulPage.current = updatedCache;
      removeHistoryFlagRef.current = true;
      setResult((current) =>
        current ? removeDeletedRows(current) : (updatedCache ?? current),
      );
      void run();

      if (id !== undefined) {
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.explore_removed_success,
          }),
        });
      }
    },
    [intl, removeAllBrowserHistory, removeBrowserHistory, run, setResult],
  );

  useEffect(() => {
    if (
      removeHistoryFlagRef.current &&
      dataSource?.length === 0 &&
      !visiblePage?.hasMore
    ) {
      removeHistoryFlagRef.current = false;
      navigation.pop();
    }
  }, [navigation, dataSource?.length, visiblePage?.hasMore]);

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
                  onConfirm: () => deleteHistory(),
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
    [deleteHistory, isEditing, intl],
  );

  const theme = useHomeNativeListTheme();
  const borderColor = useTheme().borderSubdued.val;
  const generationRef = useRef(0);
  const historyById = useMemo(
    () => new Map((dataSource ?? []).map((item) => [item.id, item])),
    [dataSource],
  );
  const snapshot = useMemo<NativeListSnapshot>(() => {
    generationRef.current += 1;
    const rows: RowModel[] = [];
    memoizedDataSource.forEach((section, sectionIndex) => {
      const sectionKey = `section:${section.title}`;
      if (sectionIndex > 0) {
        rows.push(
          buildBrowserSectionSeparatorRow(`separator:${section.title}`),
        );
      }
      rows.push(
        buildBrowserSectionHeaderRow({
          key: `header:${section.title}`,
          sectionKey,
          title: section.title,
          theme,
        }),
      );
      section.data.forEach((item) => {
        rows.push({
          ...buildBrowserSiteRow({
            key: item.id,
            title: item.title,
            url: item.url,
            logo: item.logo,
            theme,
            borderColor,
            editing: isEditing,
            testID: `search-modal-${item.url.toLowerCase()}`,
            height: BROWSER_SITE_AUTO_ROW_HEIGHT,
            trailing: [
              {
                kind: 'icon',
                name: 'DeleteOutline',
                buttonStyle: 'tertiary',
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
      // A zero ratio makes NativeList wait until the last row is visible.
      capabilities: { loadMore: canLoadMore, endReachedThreshold: 0 },
      theme,
      rows,
    };
  }, [memoizedDataSource, isEditing, theme, borderColor, intl, canLoadMore]);

  const debouncedOnEndReached = useDebouncedCallback(
    (event: EndReachedEvent) => {
      if (canLoadMore && event.generation === snapshot.generation) {
        setPage((current) => (current === page ? current + 1 : current));
      }
    },
    500,
  );

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
        void deleteHistory(item.id);
      }
    },
    [historyById, isEditing, handleWebSite, deleteHistory],
  );

  const hasRows = memoizedDataSource.length > 0;

  return (
    <Page testID={DiscoveryTestIDs.historyListPage}>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.browser_recently_closed,
        })}
        headerRight={headerRight}
      />
      <Page.Body>
        {hasRows ? (
          <NativeList
            testID="History-SectionList"
            style={{ flex: 1 }}
            snapshot={snapshot}
            onRowAction={onRowAction}
            onEndReached={debouncedOnEndReached}
          />
        ) : null}
        {!hasRows && !needsRetry ? (
          <Empty
            py="$32"
            my="$4"
            icon="ClockTimeHistoryOutline"
            title={intl.formatMessage({
              id: ETranslations.browser_no_closed_tabs,
            })}
          />
        ) : null}
        {needsRetry ? (
          <XStack justifyContent="center" py="$2">
            <Button
              testID="history-load-retry"
              variant="tertiary"
              loading={isLoading}
              onPress={() => void run()}
            >
              {intl.formatMessage({ id: ETranslations.global_retry })}
            </Button>
          </XStack>
        ) : null}
      </Page.Body>
    </Page>
  );
}

export default withBrowserProvider(HistoryListModal);
