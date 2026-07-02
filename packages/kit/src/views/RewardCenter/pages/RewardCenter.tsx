// cspell:ignore Actived
import { useCallback, useEffect, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
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
  useForm,
} from '@onekeyhq/components';
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
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';
import { RewardCenterTestIDs } from '../testIDs';

import type { RouteProp } from '@react-navigation/core';

const networkIdsMap = getNetworkIdsMap();

function RewardCenterDetails() {
  const route =
    useRoute<
      RouteProp<
        IModalRewardCenterParamList,
        EModalRewardCenterRoutes.RewardCenter
      >
    >();

  const {
    accountId,
    networkId,
    walletId,
    onClose,
    showAccountSelector = true,
  } = route?.params ?? {};

  const intl = useIntl();
  const form = useForm({
    defaultValues: {
      code: '',
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const { activeAccount } = useActiveAccount({ num: 0 });
  const { confirmAccountSelect } = useAccountSelectorActions().current;

  const navigation = useAppNavigation();

  const { result: rewardState } = usePromiseResult(
    async () => {
      const state: {
        isClaimResourceAvailable: boolean;
        isOthersAccount: boolean;
        account: INetworkAccount | undefined;
        network: IServerNetwork | undefined;
      } = {
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
    [activeAccount, accountId, networkId, showAccountSelector],
    {
      initResult: {
        isClaimResourceAvailable: true,
        isOthersAccount: false,
        account: undefined,
        network: undefined,
      },
    },
  );

  const [isLoadingResourceState, setIsLoadingResourceState] = useState(false);

  const { account, network, isClaimResourceAvailable } = rewardState;

  const [isResourceClaimed, setIsResourceClaimed] = useState(false);
  const [isResourceRedeemed, setIsResourceRedeemed] = useState(false);
  const [isCreatingTronAccount, setIsCreatingTronAccount] = useState(false);

  const [isClaiming, setIsClaiming] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isClaimed, setIsClaimed] = useState(false);
  const [remaining, setRemaining] = useState(0);

  const { createAddress } = useAccountSelectorCreateAddress();

  const claimSource = network?.isTestnet
    ? TRON_SOURCE_FLAG_TESTNET
    : TRON_SOURCE_FLAG_MAINNET;

  const { result } = usePromiseResult(async () => {
    if (!account || !network) {
      return;
    }

    setIsLoadingResourceState(true);
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
    setIsLoadingResourceState(false);

    setIsClaimed(resp.isReceived);
    setRemaining(resp.remaining);

    return resp;
  }, [account, claimSource, network]);

  // Detect whether the TRON account is activated on chain. An inactive account
  // cannot claim energy, so the claim button is disabled and a top-up alert is
  // shown. Poll (and revalidate on focus) so that if the user leaves to top up
  // TRX and comes back, the claim button re-enables automatically once the
  // account becomes activated.
  const {
    result: accountActivation,
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
              // The TRX resource proxy expects this GET payload in data.
              data: {
                fromAddress: account.address,
              },
              params: {},
            },
            returnRawData: true,
          });

        if (resp.code !== 0) {
          return { isActived: false };
        }

        return { isActived: resp.data?.isActived === true };
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

  const renderClaimButtonText = useCallback(() => {
    if (result?.remaining === 0 || result?.totalReceivedLimit === 0) {
      return intl.formatMessage({
        id: ETranslations.wallet_subsidy_all_used,
      });
    }

    if (isClaimed) {
      return intl.formatMessage({
        id: ETranslations.wallet_subsidy_claimed,
      });
    }

    return intl.formatMessage({
      id: ETranslations.wallet_subsidy_claim,
    });
  }, [result?.remaining, result?.totalReceivedLimit, isClaimed, intl]);

  const handleClaimResource = useCallback(async () => {
    if (!account || !network) {
      return;
    }

    setIsClaiming(true);

    const { timestamp, signed } =
      chainResourceUtils.buildTronClaimResourceParams({
        accountAddress: account.address,
        isTestnet: network.isTestnet,
      });

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

      defaultLogger.reward.tronReward.claimResource({
        networkId: network.id,
        address: account.address,
        sourceFlag: claimSource ?? '',
        isSuccess: true,
        resourceType: 'energy',
        isAutoClaimed: false,
      });

      setIsClaimed(true);
      setRemaining((v) => new BigNumber(v).minus(1).toNumber());
      setIsResourceClaimed(true);

      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.global_success,
        }),
      });
      setIsClaiming(false);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
      }, 1000);
      return resp;
    } catch (_error) {
      setIsClaiming(false);
    }
  }, [account, claimSource, intl, network]);

  const handleRedeemCode = useCallback(async () => {
    if (!account || !network) {
      return;
    }

    const code = form.getValues('code');

    if (!code) {
      return;
    }

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

      defaultLogger.reward.tronReward.redeemResource({
        networkId: network.id,
        address: account.address,
        code,
        sourceFlag: claimSource,
        isSuccess: true,
        resourceType: 'energy',
      });

      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.global_success,
        }),
      });

      setIsRedeeming(false);
      setIsResourceRedeemed(true);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
      }, 1000);
      return resp;
    } catch (_error) {
      setIsRedeeming(false);
    }
  }, [account, claimSource, form, intl, network]);

  useEffect(() => {
    const initActiveAccount = async () => {
      const [initAccount, initWallet] = await Promise.all([
        accountId && networkId
          ? backgroundApiProxy.serviceAccount.getAccount({
              accountId,
              networkId,
            })
          : undefined,
        walletId
          ? backgroundApiProxy.serviceAccount.getWallet({
              walletId,
            })
          : undefined,
      ]);

      const isOthersAccount = accountUtils.isOthersAccount({
        accountId,
      });
      if (isOthersAccount) {
        let autoChangeToAccountMatchedNetworkId = networkId;
        if (
          networkId &&
          networkUtils.isAllNetwork({
            networkId,
          })
        ) {
          autoChangeToAccountMatchedNetworkId = networkId;
        }
        await confirmAccountSelect({
          num: 0,
          indexedAccount: undefined,
          othersWalletAccount: initAccount,
          autoChangeToAccountMatchedNetworkId,
        });
      } else if (initWallet) {
        const indexedAccount =
          await backgroundApiProxy.serviceAccount.getIndexedAccountByAccount({
            account: initAccount,
          });
        await confirmAccountSelect({
          num: 0,
          indexedAccount,
          othersWalletAccount: undefined,
          autoChangeToAccountMatchedNetworkId: undefined,
        });
      }
    };

    void initActiveAccount();
  }, [accountId, confirmAccountSelect, networkId, walletId]);

  useEffect(
    () => () => void onClose?.({ isResourceClaimed, isResourceRedeemed }),
    [onClose, isResourceClaimed, isResourceRedeemed],
  );

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
    result?.totalReceivedLimit,
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

  const { result: nativeToken, isLoading: isNativeTokenLoading } =
    usePromiseResult(
      async () => {
        if (!account || !network) {
          return undefined;
        }
        return backgroundApiProxy.serviceToken.getNativeToken({
          accountId: account.id,
          networkId: network.id,
        });
      },
      [account, network],
      {
        watchLoading: true,
        undefinedResultIfError: true,
      },
    );

  // Same as the home Receive button: open the "choose receive mode" selector
  // (ReceiveSelector), scoped to this TRON account's native TRX, so the user can
  // top up TRX, which activates the account.
  const handleTopUp = useCallback(() => {
    if (!account || !network || !nativeToken) {
      return;
    }
    navigation.pushModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.ReceiveSelector,
      params: {
        accountId: account.id,
        networkId: network.id,
        walletId: accountUtils.getWalletIdFromAccountId({
          accountId: account.id,
        }),
        indexedAccountId: account.indexedAccountId,
        token: nativeToken,
      },
    });
  }, [account, network, nativeToken, navigation]);

  const renderClaimButton = useCallback(() => {
    if (!isClaimResourceAvailable) {
      return null;
    }

    if (!account && !isLoadingResourceState) {
      return (
        <Button
          testID={RewardCenterTestIDs.addAccountBtn}
          size="medium"
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
        size="medium"
        variant="primary"
        loading={isClaiming}
        // Inactive account cannot claim energy; keep the label and disable the
        // button. Activation is handled via the Top up action on the Alert.
        disabled={
          !isClaimResourceAvailable ||
          isLoadingResourceState ||
          isClaiming ||
          isClaimed ||
          isAccountNotActivated ||
          result?.remaining === 0 ||
          result?.totalReceivedLimit === 0 ||
          result?.monthIPRemain === 0 ||
          result?.monthRemain === 0
        }
        onPress={handleClaimResource}
      >
        {renderClaimButtonText()}
      </Button>
    );
  }, [
    isClaimResourceAvailable,
    account,
    isLoadingResourceState,
    isClaiming,
    isClaimed,
    result?.remaining,
    result?.totalReceivedLimit,
    result?.monthIPRemain,
    result?.monthRemain,
    handleClaimResource,
    renderClaimButtonText,
    isCreatingTronAccount,
    handleCreateTronAccount,
    isAccountNotActivated,
    intl,
  ]);

  const renderResourceDetails = useCallback(() => {
    return (
      <Form form={form}>
        <Divider />
        <YStack gap="$4">
          <YStack gap="$2">
            <SizableText size="$headingLg">
              {intl.formatMessage({
                id: ETranslations.wallet_subsidy_label,
              })}
            </SizableText>
            <XStack alignItems="center" justifyContent="space-between" gap="$2">
              {renderClaimResource()}
              {renderClaimButton()}
            </XStack>
          </YStack>
          <YStack gap="$2">
            <SizableText size="$headingLg">
              {intl.formatMessage({
                id: ETranslations.wallet_redeem_label,
              })}
            </SizableText>
            <XStack alignItems="center" justifyContent="space-between" gap="$9">
              <Stack flex={1}>
                <Form.Field name="code" rules={{ required: true }}>
                  <Input
                    testID={RewardCenterTestIDs.redeemCodeInput}
                    w="100%"
                    backgroundColor="$bgStrong"
                    placeholder={intl.formatMessage({
                      id: ETranslations.wallet_enter_redemption_code,
                    })}
                  />
                </Form.Field>
              </Stack>
              <Button
                testID={RewardCenterTestIDs.redeemBtn}
                size="medium"
                variant="primary"
                onPress={handleRedeemCode}
                loading={isRedeeming}
                disabled={
                  form.formState.isSubmitting ||
                  !form.formState.isValid ||
                  isRedeeming ||
                  !isClaimResourceAvailable ||
                  isAccountNotActivated
                }
              >
                {intl.formatMessage({
                  id: ETranslations.wallet_subsidy_claim,
                })}
              </Button>
            </XStack>
          </YStack>
        </YStack>
      </Form>
    );
  }, [
    form,
    intl,
    renderClaimResource,
    renderClaimButton,
    handleRedeemCode,
    isRedeeming,
    isClaimResourceAvailable,
    isAccountNotActivated,
  ]);

  // Top-of-page alert, by priority: unsupported account > inactive account
  // (with a Top up action) > IP monthly claim limit reached > account monthly
  // claim limit reached. The claim button stays labelled as-is and just
  // disabled; the reason is surfaced here.
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

    if (isAccountNotActivated && isClaimResourceAvailable) {
      return (
        <Alert
          type="warning"
          icon="InfoCircleOutline"
          title={intl.formatMessage({
            id: ETranslations.feedback_address_not_activated_message,
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
            isPrimaryDisabled: !nativeToken,
          }}
        />
      );
    }

    if (result?.monthIPRemain === 0) {
      return (
        <Alert
          type="warning"
          icon="InfoCircleOutline"
          title={intl.formatMessage({
            id: ETranslations.global_request_limit,
          })}
          closable={false}
          mb="$5"
        />
      );
    }

    if (result?.monthRemain === 0) {
      return (
        <Alert
          type="warning"
          icon="InfoCircleOutline"
          title={intl.formatMessage({
            id: ETranslations.wallet_subsidy_all_used,
          })}
          closable={false}
          mb="$5"
        />
      );
    }

    return null;
  }, [
    isWatchingAccountNotClaimable,
    isAccountNotActivated,
    isClaimResourceAvailable,
    result?.monthIPRemain,
    result?.monthRemain,
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
        }}
        enabledNum={[0]}
      >
        <AccountSelectorTriggerRewardCenter num={0} />
      </AccountSelectorProviderMirror>
    );
  }, [showAccountSelector]);

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
      <Page.Body px="$5">
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
        {renderResourceDetails()}
      </Page.Body>
    </Page>
  );
}

function RewardCenter() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.rewardCenter,
      }}
      enabledNum={[0]}
    >
      <RewardCenterDetails />
    </AccountSelectorProviderMirror>
  );
}

export default RewardCenter;
