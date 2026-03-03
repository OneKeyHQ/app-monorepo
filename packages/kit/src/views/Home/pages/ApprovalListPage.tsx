import { memo, useCallback, useEffect, useMemo } from 'react';

import { CanceledError } from 'axios';
import { useIntl } from 'react-intl';

import {
  Empty,
  IconButton,
  NavBackButton,
  Page,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { getNetworksSupportBulkRevokeApproval } from '@onekeyhq/shared/src/config/presetNetworks';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_APPROVAL,
} from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EModalApprovalManagementRoutes } from '@onekeyhq/shared/src/routes/approvalManagement';
import type {
  ETabHomeRoutes,
  ITabHomeParamList,
} from '@onekeyhq/shared/src/routes/tabHome';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IContractApproval } from '@onekeyhq/shared/types/approval';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import ApprovalListView from '../../../components/ApprovalListView';
import { ListItem } from '../../../components/ListItem';
import { TabPageHeader } from '../../../components/TabPageHeader';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAppRoute } from '../../../hooks/useAppRoute';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  ProviderJotaiContextApprovalList,
  useApprovalListActions,
  useApprovalListAtom,
  useApprovalListStateAtom,
  useContractMapAtom,
  useTokenMapAtom,
} from '../../../states/jotai/contexts/approvalList';

const networksSupportBulkRevokeApproval =
  getNetworksSupportBulkRevokeApproval();

function ApprovalListBar() {
  const navigation = useAppNavigation();
  const media = useMedia();

  const handleBackPress = useCallback(() => {
    navigation.pop();
  }, [navigation]);

  const customHeaderLeft = useMemo(
    () => (
      <XStack gap="$3" ai="center">
        <NavBackButton onPress={handleBackPress} />
      </XStack>
    ),
    [handleBackPress],
  );

  if (media.gtMd) {
    return (
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.SubPage}
        customHeaderLeftItems={customHeaderLeft}
      />
    );
  }

  return null;
}

function ApprovalListSkeletonItem({ tableLayout }: { tableLayout?: boolean }) {
  if (tableLayout) {
    return (
      <ListItem>
        <XStack alignItems="center" gap="$3" flexGrow={1} flexBasis={0}>
          <Skeleton w="$10" h="$10" radius="round" />
          <YStack flex={1} gap="$2">
            <Skeleton.BodyLg />
            <Skeleton.BodyMd />
          </YStack>
        </XStack>
        <Stack flexGrow={1} flexBasis={0}>
          <Skeleton.BodyMd />
        </Stack>
        <Stack flexGrow={1} flexBasis={0}>
          <Skeleton.BodyMd />
        </Stack>
        <Stack flexGrow={1} flexBasis={0} alignItems="flex-end">
          <Skeleton.BodyMd />
        </Stack>
      </ListItem>
    );
  }

  return (
    <ListItem>
      <XStack alignItems="center" gap="$3" flex={1}>
        <Skeleton w="$10" h="$10" radius="round" />
        <YStack flex={1} gap="$2">
          <Skeleton.BodyLg />
          <Skeleton.BodyMd />
        </YStack>
      </XStack>
      <Stack alignItems="flex-end">
        <Skeleton.BodyLg />
      </Stack>
    </ListItem>
  );
}

function ApprovalListSkeleton({ tableLayout }: { tableLayout?: boolean }) {
  return (
    <YStack>
      {tableLayout ? (
        <ListItem>
          <Stack flexGrow={1} flexBasis={0}>
            <Skeleton.BodyMd />
          </Stack>
          <Stack flexGrow={1} flexBasis={0}>
            <Skeleton.BodyMd />
          </Stack>
          <Stack flexGrow={1} flexBasis={0}>
            <Skeleton.BodyMd />
          </Stack>
          <Stack flexGrow={1} flexBasis={0} alignItems="flex-end">
            <Skeleton.BodyMd />
          </Stack>
        </ListItem>
      ) : null}
      {Array.from({ length: 5 }).map((_, i) => (
        <ApprovalListSkeletonItem key={i} tableLayout={tableLayout} />
      ))}
    </YStack>
  );
}

function ApprovalListPageContent() {
  const route = useAppRoute<
    ITabHomeParamList,
    ETabHomeRoutes.TabHomeApprovalList
  >();
  const {
    accountId: paramAccountId,
    networkId: paramNetworkId,
    walletId: paramWalletId,
    indexedAccountId: paramIndexedAccountId,
  } = route.params ?? {};

  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });

  const accountId = paramAccountId ?? account?.id;
  const networkId = paramNetworkId ?? network?.id;
  const walletId = paramWalletId ?? wallet?.id;
  const indexedAccountId = paramIndexedAccountId ?? account?.indexedAccountId;

  const intl = useIntl();
  const media = useMedia();
  const navigation = useAppNavigation();

  const approvalListActions = useApprovalListActions();
  const [{ approvals }] = useApprovalListAtom();
  const [{ tokenMap }] = useTokenMapAtom();
  const [{ contractMap }] = useContractMapAtom();
  const [approvalListState] = useApprovalListStateAtom();

  const { result: isBulkRevokeApprovalEnabled } = usePromiseResult(async () => {
    if (!networkId) return undefined;

    let supported = false;

    if (networkUtils.isAllNetwork({ networkId })) {
      if (accountUtils.isOthersAccount({ accountId })) {
        try {
          const dbAccount =
            await backgroundApiProxy.serviceAccount.getDBAccount({
              accountId: accountId ?? '',
            });
          supported = networkUtils.isEvmNetwork({
            networkId: dbAccount?.createAtNetwork ?? '',
          });
        } catch {
          supported = false;
        }
      } else {
        supported = true;
      }
    } else {
      supported = networksSupportBulkRevokeApproval[networkId] ?? false;
    }

    if (supported && accountId) {
      approvalListActions.current.updateApprovalListState({
        isRefreshing: true,
      });
    }

    return supported;
  }, [networkId, accountId, approvalListActions]);

  const { run } = usePromiseResult(
    async () => {
      if (!accountId || !networkId) return;
      if (isBulkRevokeApprovalEnabled !== true) return;

      approvalListActions.current.updateApprovalListState({
        isRefreshing: true,
      });

      await backgroundApiProxy.serviceApproval.abortFetchAccountApprovals();

      try {
        const resp =
          await backgroundApiProxy.serviceApproval.fetchAccountApprovals({
            accountId: accountId ?? '',
            networkId: networkId ?? '',
            indexedAccountId,
          });

        approvalListActions.current.updateApprovalList({
          data: resp.contractApprovals,
        });
        approvalListActions.current.updateTokenMap({ data: resp.tokenMap });
        approvalListActions.current.updateContractMap({
          data: resp.contractMap,
        });
      } catch (error) {
        if (error instanceof CanceledError) {
          console.log('fetchAccountApprovals canceled');
        } else {
          throw error;
        }
      } finally {
        approvalListActions.current.updateApprovalListState({
          isRefreshing: false,
          initialized: true,
        });
      }
    },
    [
      accountId,
      networkId,
      indexedAccountId,
      approvalListActions,
      isBulkRevokeApprovalEnabled,
    ],
    {
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_APPROVAL,
    },
  );

  useEffect(() => {
    const refreshAnyway = () => {
      void run({ alwaysSetState: true });
    };

    appEventBus.on(EAppEventBusNames.RefreshApprovalList, refreshAnyway);
    return () => {
      appEventBus.off(EAppEventBusNames.RefreshApprovalList, refreshAnyway);
    };
  }, [run]);

  const handleOnManage = useCallback(() => {
    navigation.pushModal(EModalRoutes.ApprovalManagementModal, {
      screen: EModalApprovalManagementRoutes.ApprovalList,
      params: {
        walletId: walletId ?? '',
        accountId: accountId ?? '',
        networkId: networkId ?? '',
        indexedAccountId,
        isBulkRevokeMode: true,
        approvals,
        tokenMap,
        contractMap,
      },
    });
  }, [
    navigation,
    walletId,
    accountId,
    networkId,
    indexedAccountId,
    approvals,
    tokenMap,
    contractMap,
  ]);

  const handleApprovalOnPress = useCallback(
    (approval: IContractApproval) => {
      navigation.pushModal(EModalRoutes.ApprovalManagementModal, {
        screen: EModalApprovalManagementRoutes.ApprovalDetails,
        params: {
          approval,
          tokenMap,
          contractMap,
        },
      });
    },
    [navigation, tokenMap, contractMap],
  );

  const pageTitle = intl.formatMessage({
    id: ETranslations.global_approval_list,
  });

  const isWatchingWallet = accountUtils.isWatchingWallet({
    walletId: walletId ?? '',
  });

  const renderManageButton = useCallback(() => {
    return (
      <IconButton
        title={intl.formatMessage({
          id: ETranslations.wallet_approval_manage_title,
        })}
        variant="tertiary"
        icon="SliderHorOutline"
        onPress={handleOnManage}
      />
    );
  }, [intl, handleOnManage]);

  return (
    <Page>
      {media.gtMd ? null : (
        <Page.Header title={pageTitle} headerRight={renderManageButton} />
      )}
      <ApprovalListBar />
      <Page.Body>
        <Page.Container padded={false} flex={1}>
          {media.gtMd ? (
            <XStack
              justifyContent="space-between"
              alignItems="center"
              px="$pagePadding"
              mt="$8"
              mb="$3"
            >
              <SizableText size="$heading2xl">{pageTitle}</SizableText>
              {renderManageButton()}
            </XStack>
          ) : null}
          {isBulkRevokeApprovalEnabled === false ? (
            <Empty
              testID="Wallet-Approval-Unsupported-Empty"
              title={intl.formatMessage({
                id: ETranslations.approval_not_supported,
              })}
            />
          ) : null}
          {isBulkRevokeApprovalEnabled !== false &&
          (isBulkRevokeApprovalEnabled !== true ||
            !approvalListState.initialized) ? (
            <ApprovalListSkeleton tableLayout={media.gtLg} />
          ) : null}
          {isBulkRevokeApprovalEnabled === true &&
          approvalListState.initialized ? (
            <ApprovalListView
              withHeader
              searchDisabled
              selectDisabled
              filterByNetworkDisabled
              hideRiskOverview={isWatchingWallet}
              accountId={accountId ?? ''}
              networkId={networkId ?? ''}
              indexedAccountId={indexedAccountId}
              onPress={handleApprovalOnPress}
              {...(media.gtLg && {
                tableLayout: true,
              })}
            />
          ) : null}
        </Page.Container>
      </Page.Body>
    </Page>
  );
}

function ApprovalListPage() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <ProviderJotaiContextApprovalList>
        <ApprovalListPageContent />
      </ProviderJotaiContextApprovalList>
    </AccountSelectorProviderMirror>
  );
}

export default memo(ApprovalListPage);
