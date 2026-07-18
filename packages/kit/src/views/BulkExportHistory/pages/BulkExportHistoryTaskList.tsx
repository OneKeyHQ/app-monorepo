import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Empty,
  ListView,
  Page,
  Skeleton,
  Stack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { AccountSelectorTriggerBase } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerBase';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import { useNetworkOptions } from '@onekeyhq/kit/src/views/ChainSelector/hooks/useNetworkOptions';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalBulkExportHistoryParamList } from '@onekeyhq/shared/src/routes/bulkExportHistory';
import { EModalBulkExportHistoryRoutes } from '@onekeyhq/shared/src/routes/bulkExportHistory';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IExportTransactionHistoryTask } from '@onekeyhq/shared/types/history';

import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../Staking/components/PageFrame';
import { BulkExportHistoryDownloadIconButton } from '../components/BulkExportHistoryDownloadButton';
import BulkExportHistoryNetworkAvatars, {
  type IBulkExportHistoryNetworkOptions,
} from '../components/BulkExportHistoryNetworkAvatars';
import {
  useBulkExportHistoryTaskPolling,
  useBulkExportHistoryTasks,
} from '../hooks/useBulkExportHistoryTasks';
import {
  buildBulkExportHistoryAccountIdentifierMap,
  getBulkExportHistoryAccountNetworkCompatibility,
  resolveBulkExportHistoryAccountIdentity,
} from '../utils/bulkExportHistoryAccountUtils';
import { isBulkExportHistoryMockTaskId } from '../utils/bulkExportHistoryTaskMocks';

import BulkExportHistoryTaskStatus from './BulkExportHistoryTaskStatus';
import {
  formatExportHistoryTaskDateRange,
  getExportHistoryTaskNetworkIds,
  getExportHistoryTaskStatusMeta,
} from './bulkExportHistoryTaskUtils';

const DESKTOP_TASK_LIST_CONTENT_STYLE = {
  width: '100%',
  maxWidth: 960,
  alignSelf: 'center',
  paddingHorizontal: '$2',
  marginTop: '$2',
  marginBottom: '$5',
} as const;
const MAX_NAMED_NETWORKS_IN_TASK_LIST = 3;

function normalizeAddressForTaskFilter({
  networkId,
  address,
}: {
  networkId: string;
  address: string;
}) {
  return networkUtils.isEvmNetwork({ networkId })
    ? address.toLowerCase()
    : address;
}

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

function ExportTaskListItem({
  task,
  isDesktopLayout,
  networkOptions,
  onPress,
}: {
  task: IExportTransactionHistoryTask;
  isDesktopLayout: boolean;
  networkOptions: IBulkExportHistoryNetworkOptions;
  onPress: (taskId: number, networkIds: string[]) => void;
}) {
  const intl = useIntl();

  const networkIds = useMemo(
    () => getExportHistoryTaskNetworkIds(task),
    [task],
  );
  const taskNetworkOptions = useMemo(() => {
    const networkMap = new Map(
      networkOptions.networks.map((network) => [network.id, network]),
    );
    return {
      isLoading: networkOptions.isLoading,
      networks: networkIds
        .map((networkId) => networkMap.get(networkId))
        .filter((network): network is IServerNetwork => network !== undefined),
    };
  }, [networkIds, networkOptions.isLoading, networkOptions.networks]);
  const networkTitle = useMemo(() => {
    if (networkIds.length > MAX_NAMED_NETWORKS_IN_TASK_LIST) {
      return intl.formatMessage(
        { id: ETranslations.global_count_networks },
        { count: networkIds.length },
      );
    }
    const visibleNames = taskNetworkOptions.networks
      .slice(0, MAX_NAMED_NETWORKS_IN_TASK_LIST)
      .map((network) => network.name);
    if (!visibleNames.length) {
      return intl.formatMessage(
        { id: ETranslations.global_count_networks },
        { count: networkIds.length },
      );
    }
    const remainingCount = Math.max(networkIds.length - visibleNames.length, 0);
    return `${visibleNames.join(', ')}${
      remainingCount > 0 ? ` +${remainingCount}` : ''
    }`;
  }, [intl, networkIds.length, taskNetworkOptions.networks]);
  const dateRangeText = formatExportHistoryTaskDateRange(task);
  const statusMeta = getExportHistoryTaskStatusMeta(task);
  const statusLabel = intl.formatMessage({ id: statusMeta.labelId });
  const transactionCountText = statusMeta.isDownloadable
    ? intl.formatMessage(
        {
          id: ETranslations.export_history_transactions_count__desc,
        },
        { count: task.count },
      )
    : undefined;
  const subtitleText = [networkTitle, transactionCountText]
    .filter(Boolean)
    .join(' · ');

  const handlePress = useCallback(
    () => onPress(task.id, networkIds),
    [networkIds, onPress, task.id],
  );

  const statusIndicator = (
    <BulkExportHistoryTaskStatus
      label={statusLabel}
      statusMeta={statusMeta}
      justifyContent={isDesktopLayout ? 'flex-end' : undefined}
      minWidth={isDesktopLayout ? '$24' : undefined}
    />
  );

  if (!isDesktopLayout) {
    return (
      <ListItem
        py="$3"
        testID={`bulk-export-history-task-${task.id}`}
        renderAvatar={
          <BulkExportHistoryNetworkAvatars
            networkIds={networkIds}
            networkOptions={taskNetworkOptions}
            maxVisible={1}
            remainingCountMode="overlay"
          />
        }
        title={dateRangeText}
        titleProps={{ numberOfLines: 1 }}
        subtitle={subtitleText}
        subtitleProps={{ numberOfLines: 1 }}
        drillIn
        onPress={handlePress}
      >
        {statusIndicator}
      </ListItem>
    );
  }

  return (
    <ListItem
      testID={`bulk-export-history-task-${task.id}`}
      renderAvatar={
        <BulkExportHistoryNetworkAvatars
          networkIds={networkIds}
          networkOptions={taskNetworkOptions}
          maxVisible={1}
          remainingCountMode="overlay"
        />
      }
      title={dateRangeText}
      titleProps={{ numberOfLines: 1 }}
      subtitle={subtitleText}
      subtitleProps={{ numberOfLines: 1 }}
      drillIn
      onPress={handlePress}
    >
      {statusIndicator}
      <Stack width="$8" alignItems="center" flexShrink={0}>
        {statusMeta.isDownloadable ? (
          <BulkExportHistoryDownloadIconButton
            task={task}
            size="small"
            testID={`bulk-export-history-task-download-${task.id}`}
          />
        ) : null}
      </Stack>
    </ListItem>
  );
}

function TaskListAccountSelector({
  selectorSceneUrl,
  showWalletName,
}: {
  selectorSceneUrl: string;
  showWalletName: boolean;
}) {
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
        showWalletName={showWalletName}
      />
    </AccountSelectorProviderMirror>
  );
}

function BulkExportHistoryTaskListContent({
  selectorSceneUrl,
  onOpenTaskDetail,
}: {
  selectorSceneUrl: string;
  onOpenTaskDetail: (taskId: number, networkIds: string[]) => void;
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
    activeAccount: {
      account,
      dbAccount,
      indexedAccount,
      ready: isAccountReady,
    },
  } = useActiveAccount({ num: 0 });
  const indexedAccountId = indexedAccount?.id;
  const indexedAccountWalletId = indexedAccount?.walletId;
  const activeAccountId = dbAccount?.id ?? account?.id;
  const exportAccountIdentity = useMemo(
    () =>
      resolveBulkExportHistoryAccountIdentity({
        accountId: activeAccountId,
        indexedAccountId,
      }),
    [activeAccountId, indexedAccountId],
  );
  const singletonAccountId =
    exportAccountIdentity?.type === 'singleton'
      ? exportAccountIdentity.accountId
      : undefined;
  const accountNetworkCompatibility = useMemo(
    () =>
      getBulkExportHistoryAccountNetworkCompatibility({
        accountIdentity: exportAccountIdentity,
        indexedAccountWalletId,
      }),
    [exportAccountIdentity, indexedAccountWalletId],
  );
  const hasSelectedAccount = Boolean(indexedAccountId || activeAccountId);
  let accountFilterScope = 'account:all';
  if (indexedAccountId) {
    accountFilterScope = `indexed:${indexedAccountId}`;
  } else if (singletonAccountId) {
    accountFilterScope = `account:${singletonAccountId}`;
  } else if (activeAccountId) {
    accountFilterScope = `unsupported:${activeAccountId}`;
  }

  const { result, isLoading, run, tasks } = useBulkExportHistoryTasks();

  const taskNetworkIds = useMemo(
    () =>
      Array.from(
        new Set(
          tasks.flatMap((task) =>
            Object.keys(task.query?.networkIdToAddressArray ?? {}),
          ),
        ),
      ).toSorted(),
    [tasks],
  );
  const networkOptions = useNetworkOptions(taskNetworkIds);
  const accountFilterNetworkIdsKey = JSON.stringify(
    Array.from(
      new Set(
        tasks
          .filter((task) => !isBulkExportHistoryMockTaskId(task.id))
          .flatMap((task) =>
            Object.keys(task.query?.networkIdToAddressArray ?? {}),
          ),
      ),
    ).toSorted(),
  );
  const accountFilterRequestScope = `${accountFilterScope}:${accountFilterNetworkIdsKey}`;

  // Tasks store public identifiers per network, so filter by intersecting them
  // with the addresses and xpubs owned by the selected account.
  const {
    result: accountAddressResult,
    isLoading: isAccountAddressLoading,
    run: runAccountAddressLookup,
  } = usePromiseResult(
    async () => {
      // No account selected: show all tasks.
      if (!hasSelectedAccount) {
        return {
          scope: accountFilterRequestScope,
          accountAddressSetMap: undefined,
        };
      }

      const accountAddressSetMap: Record<string, Set<string>> = {};
      if (!exportAccountIdentity) {
        return {
          scope: accountFilterRequestScope,
          accountAddressSetMap,
        };
      }

      const accountFilterNetworkIds = JSON.parse(
        accountFilterNetworkIdsKey,
      ) as string[];
      if (!accountFilterNetworkIds.length) {
        return {
          scope: accountFilterRequestScope,
          accountAddressSetMap,
        };
      }

      let compatibleNetworkIdSet: Set<string> | undefined;
      if (accountNetworkCompatibility) {
        const { mainnetItems, testnetItems } =
          await backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
            {
              ...accountNetworkCompatibility,
              networkIds: accountFilterNetworkIds,
              excludeTestNetwork: false,
            },
          );
        compatibleNetworkIdSet = new Set(
          [...mainnetItems, ...testnetItems].map((network) => network.id),
        );
      }
      const singletonCompatibleNetworkIds =
        singletonAccountId && compatibleNetworkIdSet
          ? accountFilterNetworkIds.filter((networkId) =>
              compatibleNetworkIdSet.has(networkId),
            )
          : [];
      const singletonAccountMetaMap =
        singletonAccountId && singletonCompatibleNetworkIds.length
          ? await backgroundApiProxy.serviceAccount.getAccountMetaForNetworksBatch(
              {
                pairs: singletonCompatibleNetworkIds.map((networkId) => ({
                  accountId: singletonAccountId,
                  networkId,
                })),
              },
            )
          : undefined;
      const {
        networkIdToAddressArray: singletonAccountIdentifierMap,
        missingNetworkIds: singletonMissingNetworkIds,
      } = buildBulkExportHistoryAccountIdentifierMap({
        networkIds: singletonCompatibleNetworkIds,
        accountMetaMap: singletonAccountMetaMap,
      });
      if (singletonMissingNetworkIds.length) {
        throw new OneKeyLocalError(
          `Failed to resolve bulk export account on network: ${singletonMissingNetworkIds[0]}`,
        );
      }
      // Keep account filtering atomic. A partially resolved address map would
      // make missing tasks look authoritative; a failure instead shows the
      // page retry state so the user never sees a silently incomplete history.
      await Promise.all(
        accountFilterNetworkIds.map(async (networkId) => {
          let addresses: string[] = [];
          if (indexedAccountId && compatibleNetworkIdSet?.has(networkId)) {
            addresses = await resolveAccountAddressesOnNetwork({
              networkId,
              indexedAccountId,
            });
          } else if (
            singletonAccountId &&
            compatibleNetworkIdSet?.has(networkId)
          ) {
            addresses = singletonAccountIdentifierMap[networkId] ?? [];
          }
          accountAddressSetMap[networkId] = new Set(
            addresses.map((address) =>
              normalizeAddressForTaskFilter({ networkId, address }),
            ),
          );
        }),
      );

      return {
        scope: accountFilterRequestScope,
        accountAddressSetMap,
      };
    },
    [
      accountFilterRequestScope,
      accountFilterNetworkIdsKey,
      accountNetworkCompatibility,
      exportAccountIdentity,
      hasSelectedAccount,
      indexedAccountId,
      singletonAccountId,
    ],
    {
      checkIsFocused: false,
      watchLoading: true,
      undefinedResultIfError: true,
      undefinedResultIfReRun: true,
    },
  );

  const isTaskFilterReady =
    accountAddressResult?.scope === accountFilterRequestScope;
  const displayTasks = useMemo(() => {
    if (!isTaskFilterReady || !accountAddressResult) {
      return [];
    }
    const { accountAddressSetMap } = accountAddressResult;
    if (!accountAddressSetMap) {
      return tasks;
    }
    return tasks.filter((task) =>
      isBulkExportHistoryMockTaskId(task.id)
        ? true
        : Object.entries(task.query?.networkIdToAddressArray ?? {}).some(
            ([networkId, taskAddresses]) =>
              (taskAddresses ?? []).some((address) =>
                accountAddressSetMap[networkId]?.has(
                  normalizeAddressForTaskFilter({ networkId, address }),
                ),
              ),
          ),
    );
  }, [accountAddressResult, isTaskFilterReady, tasks]);

  const hasInProgressTask = useMemo(
    () =>
      displayTasks.some(
        (task) =>
          !isBulkExportHistoryMockTaskId(task.id) &&
          getExportHistoryTaskStatusMeta(task).isInProgress,
      ),
    [displayTasks],
  );

  useBulkExportHistoryTaskPolling({
    enabled: hasInProgressTask,
    isLoading,
    run,
  });

  const isTaskListError = isErrorState({ result, isLoading });
  const isAccountFilterError = isErrorState({
    result: accountAddressResult,
    isLoading: isAccountAddressLoading,
  });

  const renderHeaderRight = useCallback(() => {
    if (!isAccountSyncReady || !isAccountReady) {
      return null;
    }
    return (
      <TaskListAccountSelector
        selectorSceneUrl={selectorSceneUrl}
        showWalletName={media.gtMd}
      />
    );
  }, [isAccountReady, isAccountSyncReady, media.gtMd, selectorSceneUrl]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.export_history__title,
        })}
        headerRight={renderHeaderRight}
        headerRightNoGlass
      />
      <Page.Body>
        <PageFrame
          LoadingSkeleton={TaskListSkeleton}
          loading={
            !isAccountSyncReady ||
            !isAccountReady ||
            isLoadingState({ result, isLoading }) ||
            (!isTaskFilterReady && !isAccountFilterError) ||
            isLoadingState({
              result: accountAddressResult,
              isLoading: isAccountAddressLoading,
            })
          }
          error={isTaskListError || isAccountFilterError}
          onRefresh={isAccountFilterError ? runAccountAddressLookup : run}
        >
          <ListView
            data={displayTasks}
            estimatedItemSize={media.gtMd ? 64 : 72}
            contentContainerStyle={
              media.gtMd && displayTasks.length
                ? DESKTOP_TASK_LIST_CONTENT_STYLE
                : undefined
            }
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <ExportTaskListItem
                task={item}
                isDesktopLayout={media.gtMd}
                networkOptions={networkOptions}
                onPress={onOpenTaskDetail}
              />
            )}
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

function BulkExportHistoryTaskList({
  navigation,
}: IPageScreenProps<
  IModalBulkExportHistoryParamList,
  EModalBulkExportHistoryRoutes.BulkExportHistoryTaskList
>) {
  const selectorSceneUrl = TASK_LIST_SELECTOR_SCENE_URL;
  const handleOpenTaskDetail = useCallback(
    (taskId: number, selectedNetworkIds: string[]) => {
      navigation.push(
        EModalBulkExportHistoryRoutes.BulkExportHistoryTaskDetail,
        {
          taskId,
          selectedNetworkIds,
          accountSelectorSceneUrl: selectorSceneUrl,
        },
      );
    },
    [navigation, selectorSceneUrl],
  );

  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.bulkExportHistory,
        sceneUrl: selectorSceneUrl,
      }}
      enabledNum={[0]}
    >
      <BulkExportHistoryTaskListContent
        selectorSceneUrl={selectorSceneUrl}
        onOpenTaskDetail={handleOpenTaskDetail}
      />
    </AccountSelectorProviderMirror>
  );
}

export default BulkExportHistoryTaskList;
