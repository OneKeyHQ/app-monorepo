// cspell:ignore Actived
import {
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Alert,
  Button,
  Divider,
  Form,
  Input,
  NavCloseButton,
  Page,
  SizableText,
  Skeleton,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useForm } from '@onekeyhq/components/src/hooks/useForm';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  TRON_SOURCE_FLAG_MAINNET,
  TRON_SOURCE_FLAG_TESTNET,
} from '@onekeyhq/shared/src/consts/chainConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import type {
  EModalRewardCenterRoutes,
  IModalRewardCenterParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import chainResourceUtils from '@onekeyhq/shared/src/utils/chainResourceUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerRewardCenter,
} from '../../../components/AccountSelector';
import { useAccountSelectorCreateAddress } from '../../../components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector/actions';
import { RewardCenterTestIDs } from '../testIDs';
import { getTronClaimLabel } from '../tronClaimLabel';
import { tronRewardActionSize } from '../tronRewardActionSize';

import type { RouteProp } from '@react-navigation/core';

const networkIdsMap = getNetworkIdsMap();

type IRewardCenterParams =
  IModalRewardCenterParamList[EModalRewardCenterRoutes.RewardCenter];

export type ITronRewardCardState = {
  accountName?: string;
  claimed: boolean;
  validUntil?: number;
  exhausted: boolean;
  claimDetails: {
    remaining?: number;
    total?: number;
    monthlyRemaining?: number;
    monthlyLimit?: number;
    inventoryFallback: ReactNode;
    accountSelector: ReactNode;
    claimButton: ReactNode;
    redeemField: ReactNode;
    redeemButton: ReactNode;
  };
};

type IInlineRewardView = (state: ITronRewardCardState) => ReactNode;

function RewardCenterDetails({
  selectorSceneUrl,
  params: { accountId, networkId, onClose, showAccountSelector = true },
  renderInline,
}: {
  selectorSceneUrl: string;
  params: IRewardCenterParams;
  renderInline?: IInlineRewardView;
}) {
  const intl = useIntl();
  const form = useForm({
    defaultValues: {
      code: '',
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const { activeAccount } = useActiveAccount({ num: 0 });

  const navigation = useAppNavigation();

  const selectionKey = [
    activeAccount.wallet?.id,
    activeAccount.indexedAccount?.id,
    activeAccount.account?.id,
    activeAccount.network?.id,
  ].join('/');
  const { result: rewardState } = usePromiseResult(
    async () => {
      const state: {
        selectionKey: string;
        isClaimResourceAvailable: boolean;
        isOthersAccount: boolean;
        account: INetworkAccount | undefined;
        network: IServerNetwork | undefined;
      } = {
        selectionKey,
        isClaimResourceAvailable: true,
        isOthersAccount: false,
        account: undefined,
        network: undefined,
      };

      if (showAccountSelector) {
        if (
          accountUtils.isOthersAccount({
            accountId: activeAccount?.account?.id ?? '',
          }) ||
          accountUtils.isQrAccount({
            accountId: activeAccount?.account?.id ?? '',
          })
        ) {
          state.isOthersAccount = true;
          if (
            networkUtils.isTronNetworkByNetworkId(activeAccount?.network?.id)
          ) {
            state.account = activeAccount.account;
            state.network = activeAccount.network;
            state.isClaimResourceAvailable = !accountUtils.isWatchingAccount({
              accountId: activeAccount?.account?.id ?? '',
            });
          } else {
            state.isClaimResourceAvailable = false;
          }
          return state;
        }

        if (networkUtils.isTronNetworkByNetworkId(activeAccount?.network?.id)) {
          state.account = activeAccount.account;
          state.network = activeAccount.network;
          state.isClaimResourceAvailable = true;
          return state;
        }

        try {
          const { accounts } =
            await backgroundApiProxy.serviceAccount.getAccountsByIndexedAccounts(
              {
                indexedAccountIds: [
                  activeAccount?.indexedAccount?.id ??
                    accountUtils.buildIndexedAccountId({
                      walletId: activeAccount?.wallet?.id ?? '',
                      index: 0,
                    }),
                ],
                networkId: networkIdsMap.trx,
                deriveType:
                  await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                    {
                      networkId: networkIdsMap.trx,
                    },
                  ),
              },
            );

          if (accounts && accounts.length > 0 && accounts[0]) {
            state.account = accounts[0];
            state.network = await backgroundApiProxy.serviceNetwork.getNetwork({
              networkId: networkIdsMap.trx,
            });
            state.isClaimResourceAvailable = true;
          }
        } catch (_e) {
          // fail to get account
        }

        return state;
      }

      const [account, network] = await Promise.all([
        backgroundApiProxy.serviceAccount.getAccount({
          accountId,
          networkId,
        }),
        backgroundApiProxy.serviceNetwork.getNetwork({
          networkId,
        }),
      ]);

      state.account = account;
      state.network = network;
      return state;
    },
    [activeAccount, accountId, networkId, showAccountSelector, selectionKey],
    {
      initResult: {
        selectionKey: '',
        isClaimResourceAvailable: true,
        isOthersAccount: false,
        account: undefined,
        network: undefined,
      },
    },
  );

  const currentRewardState =
    rewardState.selectionKey === selectionKey ? rewardState : undefined;
  const account = currentRewardState?.account;
  const network = currentRewardState?.network;
  const isClaimResourceAvailable = currentRewardState?.isClaimResourceAvailable;

  let accountSelectorLinkNetworkId: string | undefined;
  if (networkUtils.isTronNetworkByNetworkId(network?.id)) {
    accountSelectorLinkNetworkId = network?.id;
  } else if (networkUtils.isTronNetworkByNetworkId(networkId)) {
    accountSelectorLinkNetworkId = networkId;
  } else if (showAccountSelector) {
    // Reward Center is TRON-only. When neither the resolved reward network nor
    // the route network is TRON — e.g. an imported/external (non-indexed)
    // account entered from another chain, where rewardState.network never
    // resolves to TRON — fall back to TRON mainnet so the selector still opens
    // the TRON-scoped account list instead of an unbound one.
    accountSelectorLinkNetworkId = networkIdsMap.trx;
  }

  const closeResult = useRef({
    isResourceClaimed: false,
    isResourceRedeemed: false,
  });
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const [isCreatingTronAccount, setIsCreatingTronAccount] = useState(false);

  const claimPending = useRef(false);
  const redeemPending = useRef(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemedSelection, setRedeemedSelection] = useState<string>();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [lastClaim, setLastClaim] = useState<{
    accountId: string;
    networkId: string;
    validUntil: number;
  }>();

  const { createAddress } = useAccountSelectorCreateAddress();

  const { resetField } = form;
  useEffect(() => {
    resetField('code');
    setRedeemedSelection(undefined);
  }, [selectionKey, resetField]);

  const claimSource = network?.isTestnet
    ? TRON_SOURCE_FLAG_TESTNET
    : TRON_SOURCE_FLAG_MAINNET;

  const {
    result: inventory,
    setResult: setInventory,
    isLoading: isLoadingResourceState,
    run: refreshInventory,
  } = usePromiseResult(
    async () => {
      if (!account || !network) {
        return;
      }

      const start = Date.now();

      const resp =
        await backgroundApiProxy.serviceAccountProfile.sendProxyRequestWithTrxRes<{
          totalReceivedLimit: number;
          remaining: number;
          isReceived: boolean;
          monthIPLimit: number;
          monthIPRemain: number;
          monthLimit: number;
          monthRemain: number;
          error?: string;
          success: boolean;
        }>({
          networkId: network.id,
          body: {
            method: 'post',
            url: '/api/tronRent/isReceived',
            data: {
              fromAddress: account.address,
              sourceFlag: claimSource,
            },
            params: {},
          },
        });

      const end = Date.now();
      if (end - start < 800) {
        await timerUtils.wait(800 - (end - start));
      }
      if (!resp || resp.success === false) return undefined;
      return { ...resp, accountId: account.id, networkId: network.id };
    },
    [account, claimSource, network],
    {
      watchLoading: true,
      revalidateOnFocus: true,
      undefinedResultIfError: true,
    },
  );
  const result =
    inventory &&
    inventory.accountId === account?.id &&
    inventory.networkId === network?.id
      ? inventory
      : undefined;
  const isClaimed = Boolean(result?.isReceived);
  const remaining = result?.remaining;
  const exhausted = remaining === 0 || result?.totalReceivedLimit === 0;
  const validUntil =
    lastClaim &&
    lastClaim.accountId === account?.id &&
    lastClaim.networkId === network?.id
      ? lastClaim.validUntil
      : undefined;

  useEffect(() => {
    if (!validUntil) return;
    const timer = setTimeout(
      () => setLastClaim(undefined),
      Math.max(0, validUntil - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [validUntil]);

  useEffect(() => {
    if (!renderInline || !result) return;
    const day = timerUtils.getTimeDurationMs({ day: 1 });
    const offset = timerUtils.getTimeDurationMs({ hour: 8 });
    const timer = setTimeout(
      () => void refreshInventory(),
      day - ((Date.now() + offset) % day),
    );
    return () => clearTimeout(timer);
  }, [renderInline, result, refreshInventory]);

  // Detect whether the TRON account is activated on chain. An inactive account
  // cannot claim energy, so the claim button is disabled and a top-up alert is
  // shown. Poll (and revalidate on focus) so that if the user leaves to top up
  // TRX and comes back, the claim button re-enables automatically once the
  // account becomes activated.
  const {
    result: accountActivationResult,
    setStopPolling: setStopActivationPolling,
  } = usePromiseResult(
    async () => {
      if (!account || !network) {
        return;
      }

      try {
        const resp =
          await backgroundApiProxy.serviceAccountProfile.sendProxyRequestWithTrxRes<{
            code: number;
            message?: string;
            data?: {
              isActived?: boolean;
            };
            success?: boolean;
            error?: string;
          }>({
            networkId: network.id,
            body: {
              method: 'get',
              url: '/api/account',
              data: {
                fromAddress: account.address,
              },
              params: {},
            },
            returnRawData: true,
          });

        if (resp.code !== 0) {
          return undefined;
        }

        if (typeof resp.data?.isActived !== 'boolean') {
          return undefined;
        }

        return {
          accountId: account.id,
          networkId: network.id,
          isActived: resp.data.isActived,
        };
      } catch (_error) {
        return undefined;
      }
    },
    [account, network],
    {
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 15 }),
      revalidateOnFocus: true,
      undefinedResultIfError: true,
    },
  );

  // Ignore stale results from a previous account/network without clearing the
  // same-account polling result while a refresh is in flight.
  const accountActivation =
    accountActivationResult &&
    accountActivationResult.accountId === account?.id &&
    accountActivationResult.networkId === network?.id
      ? accountActivationResult
      : undefined;

  // Only treat the account as inactive once the check has definitively
  // resolved to false, so we never flash the Receive state while loading.
  const isAccountNotActivated = accountActivation?.isActived === false;
  const isWatchingAccountNotClaimable =
    !isClaimResourceAvailable &&
    Boolean(
      account &&
      accountUtils.isWatchingAccount({
        accountId: account.id,
      }),
    );

  // Stop hammering the backend once activation is confirmed. Polling
  // auto-resumes when deps (account/network) change to another inactive one.
  useEffect(() => {
    if (accountActivation?.isActived === true) {
      setStopActivationPolling(true);
    }
  }, [accountActivation?.isActived, setStopActivationPolling]);

  const isInline = Boolean(renderInline);
  const notifyRewardSuccess = useCallback(() => {
    if (!isInline) {
      Toast.success({
        title: intl.formatMessage({ id: ETranslations.global_success }),
      });
    }
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
    }, 1000);
  }, [intl, isInline]);

  const handleClaimResource = useCallback(async () => {
    if (!account || !network || !result || isClaimed || claimPending.current)
      return;
    claimPending.current = true;
    setIsClaiming(true);
    const startedAt = Date.now();
    try {
      const { timestamp, signed } =
        chainResourceUtils.buildTronClaimResourceParams({
          accountAddress: account.address,
          isTestnet: network.isTestnet,
        });
      const resp =
        await backgroundApiProxy.serviceAccountProfile.sendProxyRequestWithTrxRes<{
          resCode: number;
          resMsg: string;
          success: boolean;
          error?: string;
        }>({
          networkId: network.id,
          body: {
            method: 'post',
            url: '/api/tronRent/addFreeTronRentRecord',
            data: {
              fromAddress: account.address,
              sourceFlag: claimSource,
              timestamp,
              signed,
            },
            params: {},
          },
        });

      if (!resp?.success) {
        Toast.error({
          title:
            resp?.resMsg ||
            intl.formatMessage({ id: ETranslations.global_failed }),
        });
        return;
      }

      defaultLogger.reward.tronReward.claimResource({
        networkId: network.id,
        address: account.address,
        sourceFlag: claimSource ?? '',
        isSuccess: true,
        resourceType: 'energy',
        isAutoClaimed: false,
      });

      setInventory((current) =>
        current &&
        current.accountId === account.id &&
        current.networkId === network.id
          ? {
              ...current,
              isReceived: true,
              remaining: Math.max(0, current.remaining - 1),
              monthRemain: Math.max(0, current.monthRemain - 1),
              monthIPRemain: Math.max(0, current.monthIPRemain - 1),
            }
          : current,
      );
      setLastClaim({
        accountId: account.id,
        networkId: network.id,
        validUntil: startedAt + timerUtils.getTimeDurationMs({ minute: 10 }),
      });
      closeResult.current.isResourceClaimed = true;

      notifyRewardSuccess();
      return resp;
    } catch (_error) {
      // The proxy reports request errors. Keep the claim available for retry.
    } finally {
      claimPending.current = false;
      setIsClaiming(false);
    }
  }, [
    account,
    claimSource,
    intl,
    network,
    setInventory,
    result,
    isClaimed,
    notifyRewardSuccess,
  ]);

  const handleRedeemCode = useCallback(async () => {
    if (!account || !network) {
      return;
    }

    const code = form.getValues('code');

    if (!code || redeemPending.current) {
      return;
    }

    redeemPending.current = true;
    setIsRedeeming(true);
    try {
      const resp =
        await backgroundApiProxy.serviceAccountProfile.sendProxyRequestWithTrxRes<{
          resCode: number;
          resMsg: string;
          success: boolean;
          error?: string;
        }>({
          networkId: network.id,
          body: {
            method: 'post',
            url: '/api/v1/coupon/redeem',
            data: {
              fromAddress: account.address,
              code,
              sourceFlag: claimSource,
            },
            params: {},
          },
        });

      if (!resp?.success) {
        Toast.error({
          title:
            resp?.resMsg ||
            intl.formatMessage({ id: ETranslations.global_failed }),
        });
        return;
      }

      defaultLogger.reward.tronReward.redeemResource({
        networkId: network.id,
        address: account.address,
        sourceFlag: claimSource,
        isSuccess: true,
        resourceType: 'energy',
      });

      form.reset({ code: '' });
      if (isInline) setRedeemedSelection(selectionKey);
      closeResult.current.isResourceRedeemed = true;
      notifyRewardSuccess();
      return resp;
    } catch (_error) {
      // Keep the code so the user can retry.
    } finally {
      redeemPending.current = false;
      setIsRedeeming(false);
    }
  }, [
    account,
    claimSource,
    form,
    intl,
    network,
    notifyRewardSuccess,
    selectionKey,
    isInline,
  ]);

  useEffect(() => () => onCloseRef.current?.({ ...closeResult.current }), []);

  const renderClaimResource = useCallback(() => {
    if (isLoadingResourceState) {
      return <Skeleton.BodyLg />;
    }

    if (!account) {
      return (
        <SizableText size="$bodyLg" color="$textSubdued" flex={1}>
          {intl.formatMessage({
            id: ETranslations.wallet_no_tron_account,
          })}
        </SizableText>
      );
    }

    if (!result) {
      return (
        <Button
          testID={RewardCenterTestIDs.retryInventoryBtn}
          size="small"
          onPress={() => refreshInventory()}
        >
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Button>
      );
    }
    return (
      <SizableText size="$bodyLgMedium" color="$textSubdued">
        {intl.formatMessage(
          {
            id: ETranslations.wallet_subsidy_remaining,
          },
          {
            remaining,
            total: result?.totalReceivedLimit,
          },
        )}
      </SizableText>
    );
  }, [
    isLoadingResourceState,
    account,
    intl,
    remaining,
    result,
    refreshInventory,
  ]);

  const handleCreateTronAccount = useCallback(async () => {
    setIsCreatingTronAccount(true);
    const tronNetworkId =
      network?.id && networkUtils.isTronNetworkByNetworkId(network?.id)
        ? network.id
        : networkIdsMap.trx;

    try {
      await createAddress({
        num: 0,
        selectAfterCreate: true,
        account: {
          walletId: activeAccount?.wallet?.id,
          networkId: tronNetworkId,
          deriveType:
            await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
              {
                networkId: tronNetworkId,
              },
            ),
          indexedAccountId:
            activeAccount?.indexedAccount?.id ??
            accountUtils.buildIndexedAccountId({
              walletId: activeAccount?.wallet?.id ?? '',
              index: 0,
            }),
        },
      });
    } finally {
      setIsCreatingTronAccount(false);
    }
  }, [activeAccount, createAddress, network]);

  const { result: nativeTokenResult, isLoading: isNativeTokenLoading } =
    usePromiseResult(
      async () => {
        if (!account || !network) {
          return undefined;
        }
        const token = await backgroundApiProxy.serviceToken.getNativeToken({
          accountId: account.id,
          networkId: network.id,
        });

        if (!token) {
          return undefined;
        }

        return {
          accountId: account.id,
          networkId: network.id,
          token,
        };
      },
      [account, network],
      {
        watchLoading: true,
        undefinedResultIfError: true,
      },
    );

  const nativeToken =
    nativeTokenResult &&
    nativeTokenResult.accountId === account?.id &&
    nativeTokenResult.networkId === network?.id
      ? nativeTokenResult.token
      : undefined;

  // Same as the home Receive button: open the "choose receive mode" selector
  // (ReceiveSelector), scoped to this TRON account's native TRX, so the user can
  // top up TRX, which activates the account.
  const handleTopUp = useCallback(() => {
    if (!account || !network) {
      return;
    }
    const accountWalletId = accountUtils.getWalletIdFromAccountId({
      accountId: account.id,
    });
    if (!nativeToken) {
      // Receiving only needs the address; do not block top-up on token metadata
      navigation.pushModal(EModalRoutes.ReceiveModal, {
        screen: EModalReceiveRoutes.ReceiveToken,
        params: {
          accountId: account.id,
          networkId: network.id,
          walletId: accountWalletId,
          indexedAccountId: account.indexedAccountId,
          source: 'rewardCenter',
        },
      });
      return;
    }
    navigation.pushModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.ReceiveSelector,
      params: {
        accountId: account.id,
        networkId: network.id,
        walletId: accountWalletId,
        indexedAccountId: account.indexedAccountId,
        token: nativeToken,
      },
    });
  }, [account, network, nativeToken, navigation]);

  let claimLimitNotice: ETranslations | undefined;
  if (result?.monthIPRemain === 0) {
    claimLimitNotice = ETranslations.tron_energy_claim_limit_ip_reached_notice;
  } else if (result?.monthRemain === 0) {
    claimLimitNotice = ETranslations.tron_energy_claim_limit_reached_notice;
  }

  const actionSize = renderInline ? tronRewardActionSize : undefined;
  const renderClaimButton = useCallback(() => {
    if (!isClaimResourceAvailable) {
      return null;
    }

    if (!account && !isLoadingResourceState) {
      return (
        <Button
          testID={RewardCenterTestIDs.addAccountBtn}
          {...actionSize}
          variant="primary"
          loading={isCreatingTronAccount}
          disabled={isCreatingTronAccount}
          onPress={handleCreateTronAccount}
        >
          {intl.formatMessage({
            id: ETranslations.global_add_account,
          })}
        </Button>
      );
    }

    return (
      <Button
        testID={RewardCenterTestIDs.claimBtn}
        {...actionSize}
        variant="primary"
        loading={isClaiming}
        // Inactive account cannot claim energy; keep the label and disable the
        // button. Activation is handled via the Top up action on the Alert.
        disabled={
          !result ||
          isLoadingResourceState ||
          isClaiming ||
          isClaimed ||
          isAccountNotActivated ||
          exhausted ||
          Boolean(claimLimitNotice)
        }
        onPress={handleClaimResource}
      >
        {intl.formatMessage({
          id:
            renderInline && claimLimitNotice && !isClaimed && !exhausted
              ? claimLimitNotice
              : getTronClaimLabel(isClaimed, exhausted),
        })}
      </Button>
    );
  }, [
    isClaimResourceAvailable,
    result,
    account,
    isLoadingResourceState,
    isClaiming,
    isClaimed,
    handleClaimResource,
    actionSize,
    claimLimitNotice,
    exhausted,
    renderInline,
    isCreatingTronAccount,
    handleCreateTronAccount,
    isAccountNotActivated,
    intl,
  ]);

  const redeemDisabled =
    !account ||
    !network ||
    form.formState.isSubmitting ||
    !form.formState.isValid ||
    isRedeeming ||
    !isClaimResourceAvailable ||
    isAccountNotActivated;
  let redeemLabel = renderInline
    ? ETranslations.global_redeem
    : ETranslations.wallet_subsidy_claim;
  if (
    isInline &&
    redeemedSelection === selectionKey &&
    !form.formState.isValid
  ) {
    redeemLabel = ETranslations.redemption_success_title;
  }
  const redeemButton = (
    <Button
      testID={RewardCenterTestIDs.redeemBtn}
      {...actionSize}
      variant="primary"
      mx="$0"
      my="$0"
      onPress={handleRedeemCode}
      loading={isRedeeming}
      disabled={redeemDisabled}
    >
      {intl.formatMessage({ id: redeemLabel })}
    </Button>
  );
  const redeemField = (
    <Form form={form}>
      <XStack alignItems="center" gap={renderInline ? '$0' : '$9'}>
        <Stack flex={1} minWidth={0}>
          <Form.Field name="code" rules={{ required: true }}>
            <Input
              testID={RewardCenterTestIDs.redeemCodeInput}
              onChangeText={
                redeemedSelection
                  ? () => setRedeemedSelection(undefined)
                  : undefined
              }
              w={renderInline ? undefined : '100%'}
              backgroundColor={renderInline ? undefined : '$bgStrong'}
              size={renderInline ? 'large' : 'medium'}
              containerProps={
                renderInline
                  ? { borderWidth: 0, borderBottomWidth: 1, borderRadius: 0 }
                  : undefined
              }
              InputComponentStyle={renderInline ? { pl: '$0' } : undefined}
              accessibilityLabel={intl.formatMessage({
                id: ETranslations.wallet_enter_redemption_code,
              })}
              placeholder={intl.formatMessage({
                id: ETranslations.wallet_enter_redemption_code,
              })}
            />
          </Form.Field>
        </Stack>
        {renderInline ? null : redeemButton}
      </XStack>
    </Form>
  );

  // Top-of-page alert, by priority: unsupported account > hard claim limits >
  // inactive account (with a Top up action). The claim button stays labelled
  // as-is and just disabled; the reason is surfaced here.
  const renderTopAlert = useCallback(() => {
    if (isWatchingAccountNotClaimable) {
      return (
        <Alert
          type="warning"
          icon="InfoCircleOutline"
          title={intl.formatMessage({
            id: ETranslations.wallet_bulk_send_error_watching_account,
          })}
          closable={false}
          mb="$5"
        />
      );
    }

    if (claimLimitNotice) {
      return (
        <Alert
          type="warning"
          icon="InfoCircleOutline"
          title={intl.formatMessage({ id: claimLimitNotice })}
          closable={false}
          mb="$5"
        />
      );
    }

    if (isAccountNotActivated && isClaimResourceAvailable) {
      return (
        <Alert
          type="warning"
          icon="InfoCircleOutline"
          title={intl.formatMessage({
            id: ETranslations.tron_energy_account_inactive_deposit_notice,
          })}
          closable={false}
          mb="$5"
          action={{
            primary: intl.formatMessage({
              id: ETranslations.global_top_up,
            }),
            primaryTestID: RewardCenterTestIDs.topUpBtn,
            onPrimaryPress: handleTopUp,
            isPrimaryLoading: isNativeTokenLoading && !nativeToken,
          }}
        />
      );
    }

    return null;
  }, [
    isWatchingAccountNotClaimable,
    isAccountNotActivated,
    isClaimResourceAvailable,
    claimLimitNotice,
    intl,
    handleTopUp,
    isNativeTokenLoading,
    nativeToken,
  ]);

  const renderHeaderRight = useCallback(() => {
    if (!showAccountSelector) {
      return null;
    }

    return (
      <AccountSelectorProviderMirror
        config={{
          sceneName: EAccountSelectorSceneName.rewardCenter,
          sceneUrl: selectorSceneUrl,
        }}
        enabledNum={[0]}
      >
        <AccountSelectorTriggerRewardCenter
          num={0}
          compact={Boolean(renderInline)}
          linkNetworkId={accountSelectorLinkNetworkId}
        />
      </AccountSelectorProviderMirror>
    );
  }, [
    accountSelectorLinkNetworkId,
    selectorSceneUrl,
    showAccountSelector,
    renderInline,
  ]);

  const renderHeaderLeft = useCallback(() => {
    if (showAccountSelector) {
      return (
        <XStack
          alignItems="center"
          gap="$2"
          $md={{
            maxWidth: 180,
          }}
        >
          <NavCloseButton onPress={() => navigation.pop()} />
          <SizableText size="$headingLg" numberOfLines={1}>
            {intl.formatMessage({
              id: ETranslations.wallet_subsidy_redeem_title,
            })}
          </SizableText>
        </XStack>
      );
    }
  }, [showAccountSelector, intl, navigation]);

  if (renderInline) {
    let claimButton = renderClaimButton();
    let accountAction: ReactElement | null = null;
    if (isClaimResourceAvailable === false) {
      accountAction = (
        <Button
          testID={RewardCenterTestIDs.unsupportedAccountBtn}
          variant="primary"
          {...actionSize}
          disabled
        >
          {intl.formatMessage({
            id: isWatchingAccountNotClaimable
              ? ETranslations.wallet_bulk_send_error_watching_account
              : ETranslations.wallet_no_tron_account,
          })}
        </Button>
      );
    } else if (!account) {
      accountAction = claimButton;
    } else if (isAccountNotActivated) {
      accountAction = (
        <Button
          testID={RewardCenterTestIDs.topUpBtn}
          variant="primary"
          {...actionSize}
          loading={isNativeTokenLoading && !nativeToken}
          onPress={handleTopUp}
        >
          {intl.formatMessage({ id: ETranslations.global_top_up })} ≥ 0.1 TRX
        </Button>
      );
    }
    if (
      accountAction &&
      (!claimButton || (!isClaimed && !exhausted && !claimLimitNotice))
    ) {
      claimButton = accountAction;
    } else if (
      account &&
      !result &&
      !isLoadingResourceState &&
      isClaimResourceAvailable
    ) {
      claimButton = (
        <Button
          testID={RewardCenterTestIDs.retryInventoryBtn}
          variant="primary"
          {...actionSize}
          onPress={() => refreshInventory()}
        >
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Button>
      );
    }
    return renderInline({
      accountName: account?.name || account?.address,
      claimed: isClaimed,
      validUntil: isClaimed ? validUntil : undefined,
      exhausted,
      claimDetails: {
        remaining: result?.remaining,
        total: result?.totalReceivedLimit,
        monthlyRemaining: result?.monthRemain,
        monthlyLimit: result?.monthLimit,
        inventoryFallback: isLoadingResourceState ? (
          <Skeleton.BodyLg />
        ) : (
          <SizableText size="$heading3xl">—</SizableText>
        ),
        accountSelector: renderHeaderRight(),
        claimButton,
        redeemField,
        redeemButton: accountAction ?? redeemButton,
      },
    });
  }

  const content = (
    <>
      {renderTopAlert()}
      <Alert
        type="info"
        icon="InfoCircleOutline"
        title={intl.formatMessage({
          id: ETranslations.wallet_subsidy_description,
        })}
        closable={false}
        mb="$5"
      />
      <Divider />
      <YStack gap="$4">
        <YStack gap="$2">
          <SizableText size="$headingLg">
            {intl.formatMessage({ id: ETranslations.wallet_subsidy_label })}
          </SizableText>
          <XStack alignItems="center" justifyContent="space-between" gap="$2">
            {renderClaimResource()}
            {renderClaimButton()}
          </XStack>
        </YStack>
        <YStack gap="$2">
          <SizableText size="$headingLg">
            {intl.formatMessage({ id: ETranslations.wallet_redeem_label })}
          </SizableText>
          {redeemField}
        </YStack>
      </YStack>
    </>
  );
  return (
    <Page>
      <Page.Header
        title={
          showAccountSelector
            ? ''
            : intl.formatMessage({
                id: ETranslations.wallet_subsidy_redeem_title,
              })
        }
        headerRight={renderHeaderRight}
        headerRightNoGlass
        headerLeft={showAccountSelector ? renderHeaderLeft : undefined}
        headerLeftNoGlass
      />
      <Page.Body px="$5">{content}</Page.Body>
    </Page>
  );
}

function RewardCenterAccountSelectorSync({
  children,
  renderLoading,
  params: { accountId, networkId, walletId, showAccountSelector = true },
}: {
  children: ReactNode;
  renderLoading?: () => ReactNode;
  params: IRewardCenterParams;
}) {
  const actions = useAccountSelectorActions();
  const [isReady, setIsReady] = useState(!showAccountSelector);
  const targetWalletId =
    walletId ||
    (accountId
      ? accountUtils.getWalletIdFromAccountId({
          accountId,
        })
      : undefined);

  useEffect(() => {
    let cancelled = false;

    const syncAccountSelector = async () => {
      if (!showAccountSelector || !accountId || !networkId) {
        setIsReady(true);
        return;
      }

      setIsReady(false);
      try {
        const [initAccount, initWallet] = await Promise.all([
          backgroundApiProxy.serviceAccount.getAccount({
            accountId,
            networkId,
          }),
          targetWalletId
            ? backgroundApiProxy.serviceAccount.getWallet({
                walletId: targetWalletId,
              })
            : undefined,
        ]);

        if (cancelled) {
          return;
        }

        await actions.current.waitForAutoSelectUnlock();
        if (cancelled) {
          return;
        }

        let confirmed = true;
        if (
          accountUtils.isOthersAccount({
            accountId,
          })
        ) {
          confirmed = await actions.current.confirmAccountSelect({
            num: 0,
            indexedAccount: undefined,
            othersWalletAccount: initAccount,
            entry: 'rewardCenter:othersWallet',
            forceSelectToNetworkId: networkId,
          });
        } else if (initWallet) {
          const indexedAccount =
            await backgroundApiProxy.serviceAccount.getIndexedAccountByAccount({
              account: initAccount,
            });
          if (cancelled) {
            return;
          }
          confirmed = await actions.current.confirmAccountSelect({
            num: 0,
            indexedAccount,
            othersWalletAccount: undefined,
            forceSelectToNetworkId: networkId,
          });
        }

        if (cancelled || !confirmed) {
          return;
        }

        if (targetWalletId) {
          await actions.current.updateSelectedAccountFocusedWallet({
            num: 0,
            focusedWallet: targetWalletId,
          });
        }

        if (cancelled) {
          return;
        }

        const selectedAccount = actions.current.getSelectedAccount({
          num: 0,
        });
        await actions.current.reloadActiveAccountInfo({
          num: 0,
          selectedAccount,
        });
      } catch (_error) {
        // ignore account selector sync errors and let the page render fallback states
      } finally {
        if (!cancelled) {
          setIsReady(true);
        }
      }
    };

    void syncAccountSelector();

    return () => {
      cancelled = true;
    };
  }, [accountId, actions, networkId, showAccountSelector, targetWalletId]);

  if (!isReady) {
    return renderLoading?.() ?? null;
  }

  return children;
}

export function TronRewardCenterContent({
  params,
  renderInline,
  renderLoading,
}: {
  params: IRewardCenterParams;
  renderInline?: IInlineRewardView;
  renderLoading?: () => ReactNode;
}) {
  const selectorSceneUrlRef = useRef<string | undefined>(undefined);
  selectorSceneUrlRef.current ??= `reward-center-${Date.now()}-${Math.random()}`;
  const selectorSceneUrl = selectorSceneUrlRef.current;

  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.rewardCenter,
        sceneUrl: selectorSceneUrl,
      }}
      enabledNum={[0]}
    >
      <RewardCenterAccountSelectorSync
        params={params}
        renderLoading={renderLoading}
      >
        <RewardCenterDetails
          selectorSceneUrl={selectorSceneUrl}
          params={params}
          renderInline={renderInline}
        />
      </RewardCenterAccountSelectorSync>
    </AccountSelectorProviderMirror>
  );
}

export default function RewardCenter() {
  const { params } =
    useRoute<
      RouteProp<
        IModalRewardCenterParamList,
        EModalRewardCenterRoutes.RewardCenter
      >
    >();
  return (
    <TronRewardCenterContent
      params={params ?? { accountId: '', networkId: '' }}
    />
  );
}
