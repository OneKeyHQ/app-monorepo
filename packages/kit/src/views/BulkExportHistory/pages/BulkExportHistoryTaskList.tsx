import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IBadgeType } from '@onekeyhq/components';
import {
  Badge,
  Empty,
  ListView,
  Page,
  Skeleton,
  Stack,
  Toast,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { AccountSelectorTriggerBase } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerBase';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import csvExporterUtils from '@onekeyhq/shared/src/utils/csvExporterUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IExportTransactionHistoryTask } from '@onekeyhq/shared/types/history';

import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../Staking/components/PageFrame';
import BulkExportHistoryNetworkAvatars from '../components/BulkExportHistoryNetworkAvatars';

const TASK_POLLING_INTERVAL_MS = timerUtils.getTimeDurationMs({ seconds: 5 });

function TaskListSkeleton() {
  return (
    <Stack>
      {Array.from({ length: 3 }).map((_, index) => (
        <ListItem key={index}>
          <Skeleton h="$8" w="$8" radius="round" />
          <Stack gap="$1">
            <Skeleton.BodyLg />
            <Skeleton.BodyMd />
          </Stack>
        </ListItem>
      ))}
    </Stack>
  );
}

// Resolve the addresses an indexed account owns on the given network so tasks
// (which only store addresses, with xpubs already expanded by the server) can
// be matched back to accounts.
async function resolveAccountAddressesOnNetwork({
  networkId,
  indexedAccountId,
}: {
  networkId: string;
  indexedAccountId: string;
}): Promise<string[]> {
  const vaultSettings =
    await backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId,
    });

  if (vaultSettings.mergeDeriveAssetsEnabled) {
    const { networkAccounts } =
      await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
        {
          networkId,
          indexedAccountId,
          excludeEmptyAccount: true,
        },
      );
    return networkAccounts.map((item) => item.account?.address).filter(Boolean);
  }

  const deriveType =
    await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
      networkId,
    });
  const { accounts } =
    await backgroundApiProxy.serviceAccount.getAccountsByIndexedAccounts({
      indexedAccountIds: [indexedAccountId],
      networkId,
      deriveType,
    });
  const address = accounts[0]?.address;
  return address ? [address] : [];
}

function ExportTaskListItem({ task }: { task: IExportTransactionHistoryTask }) {
  const intl = useIntl();

  const networkIds = useMemo(
    () => Object.keys(task.query?.networkIdToAddressArray ?? {}),
    [task.query?.networkIdToAddressArray],
  );

  const dateRangeText = useMemo(() => {
    const formatDay = (timestampMs: number) =>
      formatDate(new Date(timestampMs), { hideTimeForever: true });
    return `${formatDay(task.query.minTimestampMs)} - ${formatDay(
      task.query.maxTimestampMs,
    )}`;
  }, [task.query.maxTimestampMs, task.query.minTimestampMs]);

  const subtitle = useMemo(() => {
    if (task.status === 'success') {
      // a non-null `next` means the export hit the limit and is partial
      const partialSuffix =
        task.next === null || task.next === undefined ? '' : ' · Partial';
      return `${task.count} transactions${partialSuffix}`;
    }
    if (task.status === 'failed' && task.message && task.message !== 'ok') {
      return task.message;
    }
    return formatDate(new Date(task.createdAt), { hideSeconds: true });
  }, [task.count, task.createdAt, task.message, task.next, task.status]);

  const { badgeType, statusLabel } = useMemo((): {
    badgeType: IBadgeType;
    statusLabel: string;
  } => {
    switch (task.status) {
      case 'pending':
        return {
          badgeType: 'info',
          statusLabel: intl.formatMessage({ id: ETranslations.global_pending }),
        };
      case 'processing':
        return {
          badgeType: 'info',
          statusLabel: intl.formatMessage({
            id: ETranslations.global_processing,
          }),
        };
      case 'success':
        return {
          badgeType: 'success',
          statusLabel: intl.formatMessage({ id: ETranslations.global_success }),
        };
      case 'failed':
        return {
          badgeType: 'critical',
          statusLabel: intl.formatMessage({ id: ETranslations.global_failed }),
        };
      case 'deprecated':
        return {
          badgeType: 'default',
          statusLabel: intl.formatMessage({
            id: ETranslations.limit_order_expired,
          }),
        };
      default:
        return {
          badgeType: 'default',
          statusLabel: task.status,
        };
    }
  }, [intl, task.status]);

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (isDownloading) {
      return;
    }
    setIsDownloading(true);
    try {
      const csvData =
        await backgroundApiProxy.serviceHistory.downloadExportTransactionHistoryTaskCsv(
          { id: task.id },
        );

      const formatFilenameDay = (timestampMs: number) =>
        formatDate(new Date(timestampMs), { formatTemplate: 'ddMMyy' });
      const filename = `transaction_history_${formatFilenameDay(
        task.query.minTimestampMs,
      )}_${formatFilenameDay(task.query.maxTimestampMs)}.csv`;

      const saved = await csvExporterUtils.exportCSV(csvData, filename, true);
      if (saved) {
        Toast.success({
          title: intl.formatMessage({ id: ETranslations.global_success }),
        });
      } else {
        Toast.error({
          title: 'Download failed, please try again.',
        });
      }
    } catch (error) {
      // HTTP errors are auto-toasted by the api client bridge; surface local
      // errors too instead of failing silently. showToastOfError dedupes
      // already-toasted errors.
      errorToastUtils.toastIfError(error);
      errorToastUtils.showToastOfError(error);
      console.error(error);
    } finally {
      setIsDownloading(false);
    }
  }, [
    intl,
    isDownloading,
    task.id,
    task.query.maxTimestampMs,
    task.query.minTimestampMs,
  ]);

  return (
    <ListItem
      renderAvatar={<BulkExportHistoryNetworkAvatars networkIds={networkIds} />}
      title={dateRangeText}
      subtitle={subtitle}
      subtitleProps={{ numberOfLines: 1 }}
    >
      <XStack alignItems="center" gap="$3">
        <Badge badgeType={badgeType} badgeSize="sm">
          <Badge.Text>{statusLabel}</Badge.Text>
        </Badge>
        {task.status === 'success' ? (
          <ListItem.IconButton
            testID={`bulk-export-history-task-download-${task.id}`}
            icon="DownloadOutline"
            loading={isDownloading}
            onPress={handleDownload}
          />
        ) : null}
      </XStack>
    </ListItem>
  );
}

function BulkExportHistoryTaskListContent({
  selectorSceneUrl,
}: {
  selectorSceneUrl: string;
}) {
  const intl = useIntl();
  const media = useMedia();
  const actions = useAccountSelectorActions();

  // Default the account filter to the account selected on the export form
  // page (which itself defaults to the wallet home account). Gate rendering
  // on the sync so a stale persisted selection never flashes or filters.
  const [isAccountSyncReady, setIsAccountSyncReady] = useState(false);
  useEffect(() => {
    void (async () => {
      try {
        await actions.current.syncFromScene({
          from: {
            sceneName: EAccountSelectorSceneName.bulkExportHistory,
            sceneUrl: '',
            sceneNum: 0,
          },
          num: 0,
        });
      } finally {
        setIsAccountSyncReady(true);
      }
    })();
  }, [actions]);

  const {
    activeAccount: { account, indexedAccount },
  } = useActiveAccount({ num: 0 });

  const { result, isLoading, run } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceHistory.fetchExportTransactionHistoryTasks(),
    [],
    { watchLoading: true },
  );

  const tasks = useMemo(
    () =>
      [...(result?.list ?? [])].toSorted((a, b) => b.createdAt - a.createdAt),
    [result],
  );

  // Tasks only store per-network addresses, so filter by intersecting them
  // with the addresses owned by the selected account.
  const { result: filteredTaskIds } = usePromiseResult(
    async () => {
      if (!tasks.length) {
        return [];
      }

      const indexedAccountId = indexedAccount?.id;
      const othersAccountAddress = indexedAccountId
        ? undefined
        : account?.address;

      // No account selected: show all tasks.
      if (!indexedAccountId && !othersAccountAddress) {
        return tasks.map((task) => task.id);
      }

      const networkIds = Array.from(
        new Set(
          tasks.flatMap((task) =>
            Object.keys(task.query?.networkIdToAddressArray ?? {}),
          ),
        ),
      );

      // Lowercased matching keeps hex (EVM-like) addresses case-insensitive;
      // base58 case collisions are practically impossible here.
      const accountAddressSetMap: Record<string, Set<string>> = {};
      await Promise.all(
        networkIds.map(async (networkId) => {
          let addresses: string[] = [];
          if (indexedAccountId) {
            try {
              addresses = await resolveAccountAddressesOnNetwork({
                networkId,
                indexedAccountId,
              });
            } catch {
              addresses = [];
            }
          } else if (othersAccountAddress) {
            addresses = [othersAccountAddress];
          }
          accountAddressSetMap[networkId] = new Set(
            addresses.map((address) => address.toLowerCase()),
          );
        }),
      );

      return tasks
        .filter((task) =>
          Object.entries(task.query?.networkIdToAddressArray ?? {}).some(
            ([networkId, taskAddresses]) =>
              (taskAddresses ?? []).some((address) =>
                accountAddressSetMap[networkId]?.has(address.toLowerCase()),
              ),
          ),
        )
        .map((task) => task.id);
    },
    [tasks, indexedAccount?.id, account?.address],
    { checkIsFocused: false },
  );

  const displayTasks = useMemo(() => {
    if (!filteredTaskIds) {
      return tasks;
    }
    const filteredTaskIdSet = new Set(filteredTaskIds);
    return tasks.filter((task) => filteredTaskIdSet.has(task.id));
  }, [tasks, filteredTaskIds]);

  const hasInProgressTask = useMemo(
    () =>
      tasks.some(
        (task) => task.status === 'pending' || task.status === 'processing',
      ),
    [tasks],
  );

  useEffect(() => {
    if (!hasInProgressTask) {
      return undefined;
    }
    const timer = setInterval(() => {
      // ignore transient polling errors; the current list stays visible
      void run().catch(() => undefined);
    }, TASK_POLLING_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasInProgressTask, run]);

  const renderHeaderRight = useCallback(() => {
    if (!isAccountSyncReady) {
      return null;
    }
    return (
      <AccountSelectorProviderMirror
        config={{
          sceneName: EAccountSelectorSceneName.bulkExportHistory,
          sceneUrl: selectorSceneUrl,
        }}
        enabledNum={[0]}
      >
        <AccountSelectorTriggerBase
          horizontalLayout
          autoWidthForHome
          num={0}
          showWalletName={media.gtMd}
        />
      </AccountSelectorProviderMirror>
    );
  }, [isAccountSyncReady, media.gtMd, selectorSceneUrl]);

  return (
    <Page>
      <Page.Header
        title="Export history"
        headerRight={renderHeaderRight}
        headerRightNoGlass
      />
      <Page.Body>
        <PageFrame
          LoadingSkeleton={TaskListSkeleton}
          loading={!isAccountSyncReady || isLoadingState({ result, isLoading })}
          error={isErrorState({ result, isLoading })}
          onRefresh={run}
        >
          <ListView
            data={displayTasks}
            estimatedItemSize="$16"
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <ExportTaskListItem task={item} />}
            ListEmptyComponent={
              <Empty
                icon="ClockTimeHistoryOutline"
                title={intl.formatMessage({ id: ETranslations.global_no_data })}
              />
            }
          />
        </PageFrame>
      </Page.Body>
    </Page>
  );
}

// A dedicated (but stable) scene url isolates this page's selector state from
// the export form page (which uses sceneUrl ''). It must NOT be unique per
// mount: the bulkExportHistory scene persists to simpleDb accountSelector, so
// per-mount urls would accumulate storage entries unboundedly, and the
// mount-time syncFromScene below re-seeds the selection anyway.
const TASK_LIST_SELECTOR_SCENE_URL = 'bulk-export-history-task-list';

function BulkExportHistoryTaskList() {
  const selectorSceneUrl = TASK_LIST_SELECTOR_SCENE_URL;

  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.bulkExportHistory,
        sceneUrl: selectorSceneUrl,
      }}
      enabledNum={[0]}
    >
      <BulkExportHistoryTaskListContent selectorSceneUrl={selectorSceneUrl} />
    </AccountSelectorProviderMirror>
  );
}

export default BulkExportHistoryTaskList;
