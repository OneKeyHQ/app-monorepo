import type { PropsWithChildren, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { useDebouncedCallback } from 'use-debounce';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  Accordion,
  Alert,
  Dialog,
  Divider,
  Icon,
  IconButton,
  Image,
  NumberSizeableText,
  Page,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  PercentageStageOnKeyboard,
  calcPercentBalance,
} from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useEarnActions } from '@onekeyhq/kit/src/states/jotai/contexts/earn/actions';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import {
  formatApy,
  formatStakingDistanceToNowStrict,
} from '@onekeyhq/kit/src/views/Staking/components/utils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EApproveType } from '@onekeyhq/shared/types/staking';
import type {
  IApproveConfirmFnParams,
  IEarnEstimateFeeResp,
  IEarnTokenItem,
  IProtocolInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { useEarnEventActive } from '../../hooks/useEarnEventActive';
import { useEarnPermitApprove } from '../../hooks/useEarnPermitApprove';
import { useFalconEventEndedDialog } from '../../hooks/useFalconEventEndedDialog';
import { useTrackTokenAllowance } from '../../hooks/useUtilsHooks';
import { capitalizeString, countDecimalPlaces } from '../../utils/utils';
import { CalculationListItem } from '../CalculationList';
import {
  EstimateNetworkFee,
  useShowStakeEstimateGasAlert,
} from '../EstimateNetworkFee';
import { ProtocolApyRewards } from '../ProtocolDetails/ProtocolApyRewards';
import { EStakeProgressStep, StakeProgress } from '../StakeProgress';
import { StakingAmountInput } from '../StakingAmountInput';
import StakingFormWrapper from '../StakingFormWrapper';
import { TradeOrBuy } from '../TradeOrBuy';

type IApproveBaseStakeProps = {
  price: string;
  balance: string;
  token: IToken;
  approveTarget: {
    accountId: string;
    networkId: string;
    spenderAddress: string;
    token: IToken;
  };

  providerLabel?: string;

  currentAllowance?: string;
  apr?: string;
  minAmount?: string;
  decimals?: number;

  showEstReceive?: boolean;
  estReceiveToken?: string;
  estReceiveTokenRate?: string;

  providerName?: string;
  providerLogo?: string;
  eventEndTime?: number;
  approveType?: EApproveType;
  apys?: IProtocolInfo['apys'];
  activeBalance?: string;
  rewardAssets?: Record<string, IEarnTokenItem>;
  poolFee?: string;
  onConfirm?: (params: IApproveConfirmFnParams) => Promise<void>;
};

type ITokenAnnualReward = {
  amount: string;
  fiatValue?: string;
  token: IToken;
  suffix?: string;
};

export function ApproveBaseStake({
  price,
  balance,
  token,
  apr,
  decimals,
  minAmount = '0',
  currentAllowance = '0',
  providerName = '',
  providerLogo,
  onConfirm,
  approveTarget,
  eventEndTime,
  showEstReceive,
  estReceiveToken,
  estReceiveTokenRate = '1',
  approveType,
  activeBalance,
  apys,
  rewardAssets,
  poolFee,
}: PropsWithChildren<IApproveBaseStakeProps>) {
  const intl = useIntl();
  const showEstimateGasAlert = useShowStakeEstimateGasAlert();
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId: approveTarget.accountId,
    networkId: approveTarget.networkId,
  });
  const network = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getNetwork({
        networkId: approveTarget.networkId,
      }),
    [approveTarget.networkId],
  ).result;
  const { isEventActive } = useEarnEventActive(eventEndTime);
  const [approving, setApproving] = useState<boolean>(false);
  const {
    allowance,
    loading: loadingAllowance,
    trackAllowance,
    fetchAllowanceResponse,
  } = useTrackTokenAllowance({
    accountId: approveTarget.accountId,
    networkId: approveTarget.networkId,
    tokenAddress: approveTarget.token.address,
    spenderAddress: approveTarget.spenderAddress,
    initialValue: currentAllowance,
    approveType: approveType ?? EApproveType.Legacy,
  });
  const [amountValue, setAmountValue] = useState('');
  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();

  const [estimateFeeResp, setEstimateFeeResp] = useState<
    undefined | IEarnEstimateFeeResp
  >();

  const { getPermitSignature } = useEarnPermitApprove();
  const { getPermitCache, updatePermitCache } = useEarnActions().current;

  const isInsufficientBalance = useMemo<boolean>(
    () => new BigNumber(amountValue).gt(balance),
    [amountValue, balance],
  );

  const isLessThanMinAmount = useMemo<boolean>(() => {
    const minAmountBn = new BigNumber(minAmount);
    const amountValueBn = new BigNumber(amountValue);
    if (minAmountBn.isGreaterThan(0) && amountValueBn.isGreaterThan(0)) {
      return amountValueBn.isLessThan(minAmountBn);
    }
    return false;
  }, [minAmount, amountValue]);

  const isDisable = useMemo(() => {
    const amountValueBN = BigNumber(amountValue);
    return (
      amountValueBN.isNaN() ||
      amountValueBN.lte(0) ||
      isInsufficientBalance ||
      isLessThanMinAmount
    );
  }, [amountValue, isInsufficientBalance, isLessThanMinAmount]);

  const usePermit2Approve = approveType === EApproveType.Permit;
  const permitSignatureRef = useRef<string | undefined>(undefined);

  const isFocus = useIsFocused();

  const { showFalconEventEndedDialog } = useFalconEventEndedDialog({
    providerName,
    eventEndTime,
    weeklyNetApyWithoutFee: apys?.weeklyNetApyWithoutFee,
  });

  const shouldApprove = useMemo(() => {
    if (!isFocus) {
      return true;
    }
    const amountValueBN = BigNumber(amountValue);
    const allowanceBN = new BigNumber(allowance);

    if (usePermit2Approve) {
      // Check permit cache first
      const permitCache = getPermitCache({
        accountId: approveTarget.accountId,
        networkId: approveTarget.networkId,
        tokenAddress: token.address,
        amount: amountValue,
      });
      if (permitCache) {
        permitSignatureRef.current = permitCache.signature;
        return false;
      }
    }

    return !amountValueBN.isNaN() && allowanceBN.lt(amountValue);
  }, [
    isFocus,
    token,
    amountValue,
    allowance,
    usePermit2Approve,
    getPermitCache,
    approveTarget.accountId,
    approveTarget.networkId,
  ]);

  const fetchEstimateFeeResp = useCallback(
    async (amount?: string) => {
      if (!amount) {
        return undefined;
      }
      const amountNumber = BigNumber(amount);
      if (amountNumber.isZero() || amountNumber.isNaN()) {
        return;
      }

      const permitParams: {
        approveType?: 'permit';
        permitSignature?: string;
      } = {};

      if (usePermit2Approve) {
        if (shouldApprove) {
          return undefined;
        }

        permitParams.approveType = 'permit';

        if (permitSignatureRef.current) {
          const amountBN = BigNumber(amount);
          const allowanceBN = BigNumber(allowance);
          if (amountBN.gt(allowanceBN)) {
            permitParams.permitSignature = permitSignatureRef.current;
          }
        }
      }

      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId: approveTarget.accountId,
        networkId: approveTarget.networkId,
      });
      const resp = await backgroundApiProxy.serviceStaking.estimateFee({
        networkId: approveTarget.networkId,
        provider: providerName,
        symbol: token.symbol,
        action: shouldApprove ? 'approve' : 'stake',
        amount: amountNumber.toFixed(),
        protocolVault: earnUtils.useVaultProvider({ providerName })
          ? approveTarget.spenderAddress
          : undefined,
        accountAddress: account?.address,
        ...permitParams,
      });
      return resp;
    },
    [
      allowance,
      approveTarget.accountId,
      approveTarget.networkId,
      approveTarget.spenderAddress,
      providerName,
      shouldApprove,
      token.symbol,
      usePermit2Approve,
    ],
  );

  const debouncedFetchEstimateFeeResp = useDebouncedCallback(
    async (amount?: string) => {
      const resp = await fetchEstimateFeeResp(amount);
      setEstimateFeeResp(resp);
    },
    350,
  );

  const prevShouldApproveRef = useRef<boolean>(undefined);
  useEffect(() => {
    const amountValueBN = new BigNumber(amountValue);
    // Check if shouldApprove transitioned from true to false and amount is valid
    if (
      prevShouldApproveRef.current === true &&
      !shouldApprove &&
      !amountValueBN.isNaN() &&
      amountValueBN.gt(0)
    ) {
      void debouncedFetchEstimateFeeResp(amountValue);
    }
    prevShouldApproveRef.current = shouldApprove;
  }, [shouldApprove, amountValue, debouncedFetchEstimateFeeResp]);

  const onChangeAmountValue = useCallback(
    (value: string) => {
      if (!validateAmountInput(value, decimals)) {
        return;
      }
      const valueBN = new BigNumber(value);
      if (valueBN.isNaN()) {
        if (value === '') {
          setAmountValue('');
          void debouncedFetchEstimateFeeResp();
        }
        return;
      }
      const isOverflowDecimals = Boolean(
        decimals &&
          Number(decimals) > 0 &&
          countDecimalPlaces(value) > decimals,
      );
      if (isOverflowDecimals) {
        // setAmountValue((oldValue) => oldValue);
      } else {
        setAmountValue(value);
        void debouncedFetchEstimateFeeResp(value);
      }
    },
    [decimals, debouncedFetchEstimateFeeResp],
  );

  const currentValue = useMemo<string | undefined>(() => {
    const amountValueBn = new BigNumber(amountValue);
    if (amountValueBn.isNaN()) return undefined;
    return amountValueBn.multipliedBy(price).toFixed();
  }, [amountValue, price]);

  const onConfirmText = useMemo(() => {
    if (shouldApprove) {
      return intl.formatMessage(
        {
          id: usePermit2Approve
            ? ETranslations.earn_approve_deposit
            : ETranslations.global_approve,
        },
        { amount: amountValue, symbol: token.symbol },
      );
    }
    return intl.formatMessage({ id: ETranslations.earn_deposit });
  }, [shouldApprove, intl, usePermit2Approve, amountValue, token.symbol]);

  const onMax = useCallback(() => {
    onChangeAmountValue(balance);
  }, [onChangeAmountValue, balance]);

  const onSelectPercentageStage = useCallback(
    (percent: number) => {
      onChangeAmountValue(
        calcPercentBalance({
          balance,
          percent,
          decimals,
        }),
      );
    },
    [balance, decimals, onChangeAmountValue],
  );

  const estimatedAnnualRewards = useMemo<ITokenAnnualReward[]>(() => {
    const amountBN = new BigNumber(amountValue);
    if (amountBN.isNaN() || amountBN.lte(0)) return [];

    const rewards: ITokenAnnualReward[] = [];

    if (apys) {
      // handle base token reward
      const isFalconProvider = earnUtils.isFalconProvider({
        providerName,
      });
      const baseRateBN = new BigNumber(
        isFalconProvider ? apys?.weeklyNetApyWithoutFee ?? 0 : apys?.rate ?? 0,
      );
      if (baseRateBN.gt(0)) {
        let baseAmount = amountBN.multipliedBy(baseRateBN).dividedBy(100);
        if (isFalconProvider) {
          baseAmount = baseAmount.dividedBy(365);
        }

        let suffix: string | undefined;
        if (
          earnUtils.isFalconProvider({
            providerName,
          }) &&
          isEventActive
        ) {
          suffix = `+ ${intl.formatMessage({
            id: ETranslations.explore_badge_airdrop,
          })}`;
        }

        rewards.push({
          amount: baseAmount.toFixed(),
          fiatValue: new BigNumber(price).gt(0)
            ? baseAmount.multipliedBy(price).toFixed()
            : undefined,
          token,
          suffix,
        });
      }

      // handle extra token reward
      const { rewards: extraRewards } = apys;
      if (extraRewards && rewardAssets) {
        Object.entries(extraRewards).forEach(([tokenAddress, apy]) => {
          const rewardToken = rewardAssets?.[tokenAddress];
          const apyBN = new BigNumber(apy);
          if (rewardToken && apyBN.gt(0)) {
            const rewardAmount = amountBN
              .multipliedBy(price)
              .multipliedBy(apyBN)
              .dividedBy(100)
              .dividedBy(rewardToken.price);

            rewards.push({
              amount: rewardAmount.toFixed(),
              token: rewardToken.info,
              fiatValue: new BigNumber(rewardToken.price).gt(0)
                ? rewardAmount.multipliedBy(rewardToken.price).toFixed()
                : undefined,
            });
          }
        });
      }
    } else {
      // handle single token reward
      const aprBN = new BigNumber(apr ?? 0);
      if (aprBN.gt(0)) {
        const rewardAmount = amountBN.multipliedBy(aprBN).dividedBy(100);

        rewards.push({
          amount: rewardAmount.toFixed(),
          fiatValue: new BigNumber(price).gt(0)
            ? rewardAmount.multipliedBy(price).toFixed()
            : undefined,
          token,
        });
      }
    }

    return rewards;
  }, [
    amountValue,
    apys,
    providerName,
    rewardAssets,
    isEventActive,
    price,
    token,
    intl,
    apr,
  ]);

  const totalAnnualRewardsFiatValue = useMemo(() => {
    if (!estimatedAnnualRewards.length) return undefined;

    return estimatedAnnualRewards
      .reduce((total, reward) => {
        if (reward.fiatValue) {
          return total.plus(reward.fiatValue);
        }
        return total;
      }, new BigNumber(0))
      .toFixed();
  }, [estimatedAnnualRewards]);

  const daysSpent = useMemo(() => {
    if (estimateFeeResp?.coverFeeSeconds) {
      return formatStakingDistanceToNowStrict(estimateFeeResp.coverFeeSeconds);
    }
  }, [estimateFeeResp?.coverFeeSeconds]);

  const checkEstimateGasAlert = useCallback(
    async (onNext: () => Promise<void>) => {
      if (!totalAnnualRewardsFiatValue || usePermit2Approve) {
        return onNext();
      }

      setApproving(true);

      const response = await fetchEstimateFeeResp(amountValue);

      setApproving(false);
      if (!response) {
        return onNext();
      }
      const daySpent = Number(response?.coverFeeSeconds || 0) / 3600 / 24;

      if (!daySpent || daySpent <= 5) {
        return onNext();
      }

      showEstimateGasAlert({
        daysConsumed: formatStakingDistanceToNowStrict(
          response.coverFeeSeconds,
        ),
        estFiatValue: response.feeFiatValue,
        onConfirm: async (dialogInstance: IDialogInstance) => {
          await dialogInstance.close();
          await onNext();
        },
      });
    },
    [
      totalAnnualRewardsFiatValue,
      usePermit2Approve,
      fetchEstimateFeeResp,
      amountValue,
      showEstimateGasAlert,
    ],
  );

  const onSubmit = useCallback(async () => {
    const handleConfirm = async () => {
      try {
        await onConfirm?.({
          amount: amountValue,
          approveType,
          permitSignature: permitSignatureRef.current,
        });
      } catch (error) {
        console.error('Transaction error:', error);
      }
    };

    // Wait for the dialog confirmation if it's shown
    await showFalconEventEndedDialog();

    if (!usePermit2Approve || (usePermit2Approve && !shouldApprove)) {
      await checkEstimateGasAlert(handleConfirm);
      return;
    }

    void handleConfirm();
  }, [
    showFalconEventEndedDialog,
    usePermit2Approve,
    shouldApprove,
    onConfirm,
    amountValue,
    approveType,
    checkEstimateGasAlert,
  ]);

  const showStakeProgressRef = useRef<Record<string, boolean>>({});

  const resetUSDTApproveValue = useCallback(async () => {
    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId: approveTarget.accountId,
      networkId: approveTarget.networkId,
    });
    const approveResetInfo: IApproveInfo = {
      owner: account.address,
      spender: approveTarget.spenderAddress,
      amount: '0',
      isMax: false,
      tokenInfo: {
        ...token,
        isNative: !!token.isNative,
        name: token.name ?? token.symbol,
      },
    };
    const approvesInfo = [approveResetInfo];
    await navigationToTxConfirm({
      approvesInfo,
      onSuccess() {
        // Poll for allowance updates until it becomes 0
        const pollAllowanceUntilZero = async () => {
          try {
            let attempts = 0;
            const maxAttempts = 10; // Prevent infinite polling
            const pollInterval = 3000; // 3 seconds between polls

            const checkAllowance = async () => {
              // Fetch latest allowance
              const allowanceInfo = await fetchAllowanceResponse();

              if (allowanceInfo) {
                // If allowance is now 0, stop polling
                if (BigNumber(allowanceInfo.allowanceParsed).isZero()) {
                  setApproving(false);
                  return;
                }
              }

              attempts += 1;

              if (attempts < maxAttempts) {
                setTimeout(checkAllowance, pollInterval);
              } else {
                setApproving(false);
              }
            };

            // Start the recursive polling
            setTimeout(checkAllowance, pollInterval);
          } catch (error) {
            console.error('Error polling for allowance:', error);
            setApproving(false);
          }
        };

        // Start polling for USDT reset
        void pollAllowanceUntilZero();
      },
      onFail() {
        setApproving(false);
      },
      onCancel() {
        setApproving(false);
      },
    });
  }, [
    approveTarget.accountId,
    approveTarget.networkId,
    approveTarget.spenderAddress,
    fetchAllowanceResponse,
    navigationToTxConfirm,
    token,
  ]);

  const showResetUSDTApproveValueDialog = useCallback(() => {
    Dialog.show({
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_continue,
      }),
      showExitButton: false,
      dismissOnOverlayPress: false,
      onCancel: () => {
        setApproving(false);
      },
      onConfirm: () => {
        void resetUSDTApproveValue();
      },
      title: intl.formatMessage({
        id: ETranslations.swap_page_provider_approve_usdt_dialog_title,
      }),
      description: intl.formatMessage({
        id: ETranslations.swap_page_provider_approve_usdt_dialog_content,
      }),
      icon: 'ErrorOutline',
    });
  }, [intl, resetUSDTApproveValue]);

  const onApprove = useCallback(async () => {
    setApproving(true);
    let approveAllowance = allowance;
    try {
      const allowanceInfo = await fetchAllowanceResponse();
      approveAllowance = allowanceInfo.allowanceParsed;
    } catch (e) {
      console.error(e);
    }
    permitSignatureRef.current = undefined;
    showStakeProgressRef.current[amountValue] = true;

    const allowanceBN = BigNumber(approveAllowance);
    const amountBN = BigNumber(amountValue);

    if (earnUtils.isUSDTonETHNetwork(token)) {
      if (allowanceBN.gt(0) && amountBN.gt(allowanceBN)) {
        showResetUSDTApproveValueDialog();
        return;
      }
    }

    if (usePermit2Approve) {
      const handlePermit2Approve = async () => {
        try {
          // Check permit cache first
          const permitCache = getPermitCache({
            accountId: approveTarget.accountId,
            networkId: approveTarget.networkId,
            tokenAddress: token.address,
            amount: amountValue,
          });

          if (permitCache) {
            permitSignatureRef.current = permitCache.signature;
            void onSubmit();
            setApproving(false);
            return;
          }

          const permitBundlerAction = await getPermitSignature({
            networkId: approveTarget.networkId,
            accountId: approveTarget.accountId,
            token,
            amountValue,
            providerName,
            vaultAddress: approveTarget.spenderAddress,
          });
          permitSignatureRef.current = permitBundlerAction;

          // Update permit cache
          updatePermitCache({
            accountId: approveTarget.accountId,
            networkId: approveTarget.networkId,
            tokenAddress: token.address,
            amount: amountValue,
            signature: permitBundlerAction,
            expiredAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
          });

          setTimeout(() => {
            void debouncedFetchEstimateFeeResp(amountValue);
          }, 200);

          void onSubmit();
          setApproving(false);
        } catch (error: unknown) {
          console.error('Permit sign error:', error);
          defaultLogger.staking.page.permitSignError({
            error: error instanceof Error ? error.message : String(error),
          });
          setApproving(false);
        }
      };

      void checkEstimateGasAlert(handlePermit2Approve);
      return;
    }

    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId: approveTarget.accountId,
      networkId: approveTarget.networkId,
    });

    await navigationToTxConfirm({
      approvesInfo: [
        {
          owner: account.address,
          spender: approveTarget.spenderAddress,
          amount: amountValue,
          tokenInfo: approveTarget.token,
        },
      ],
      onSuccess(data) {
        trackAllowance(data[0].decodedTx.txid);
        setApproving(false);
        setTimeout(() => {
          void debouncedFetchEstimateFeeResp(amountValue);
        }, 200);
      },
      onFail() {
        setApproving(false);
      },
      onCancel() {
        setApproving(false);
      },
    });
  }, [
    allowance,
    amountValue,
    token,
    usePermit2Approve,
    approveTarget.accountId,
    approveTarget.networkId,
    approveTarget.spenderAddress,
    approveTarget.token,
    navigationToTxConfirm,
    fetchAllowanceResponse,
    showResetUSDTApproveValueDialog,
    checkEstimateGasAlert,
    getPermitCache,
    getPermitSignature,
    providerName,
    updatePermitCache,
    onSubmit,
    debouncedFetchEstimateFeeResp,
    trackAllowance,
  ]);

  const placeholderTokens = useMemo(
    () => (
      <>
        {token ? (
          <NumberSizeableText
            color="$textPlaceholder"
            size="$bodyLgMedium"
            formatter="balance"
            formatterOptions={{ tokenSymbol: token.symbol }}
          >
            0
          </NumberSizeableText>
        ) : null}
        {apys?.rewards
          ? Object.entries(apys.rewards).map(([tokenAddress, apy]) =>
              rewardAssets?.[tokenAddress] ? (
                <NumberSizeableText
                  key={tokenAddress}
                  color="$textPlaceholder"
                  size="$bodyLgMedium"
                  formatter="balance"
                  formatterOptions={{
                    tokenSymbol: rewardAssets?.[tokenAddress].info.symbol,
                  }}
                >
                  0
                </NumberSizeableText>
              ) : null,
            )
          : null}
      </>
    ),
    [apys?.rewards, rewardAssets, token],
  );

  const isShowStakeProgress =
    !!amountValue &&
    (shouldApprove || showStakeProgressRef.current[amountValue]);

  const accordionContent = useMemo(() => {
    const items: ReactElement[] = [];
    if (Number(amountValue) <= 0) {
      return items;
    }
    if (showEstReceive && estReceiveToken) {
      items.push(
        <CalculationListItem>
          <CalculationListItem.Label
            size="$bodyMd"
            tooltip={intl.formatMessage({
              id: ETranslations.earn_est_receive_tooltip,
            })}
          >
            {intl.formatMessage({
              id: ETranslations.earn_est_receive,
            })}
          </CalculationListItem.Label>
          <NumberSizeableText
            formatter="balance"
            size="$bodyMdMedium"
            formatterOptions={{ tokenSymbol: estReceiveToken }}
          >
            {BigNumber(amountValue).multipliedBy(estReceiveTokenRate).toFixed()}
          </NumberSizeableText>
        </CalculationListItem>,
      );
    }
    if (estimateFeeResp && !usePermit2Approve) {
      items.push(
        <EstimateNetworkFee
          labelTextProps={{
            size: '$bodyMd',
          }}
          valueTextProps={{
            size: '$bodyMdMedium',
          }}
          estimateFeeResp={estimateFeeResp}
          isVisible={!!totalAnnualRewardsFiatValue}
          onPress={() => {
            showEstimateGasAlert({
              daysConsumed: daysSpent,
              estFiatValue: estimateFeeResp.feeFiatValue,
            });
          }}
        />,
      );
    }
    return items;
  }, [
    amountValue,
    showEstReceive,
    estReceiveToken,
    estimateFeeResp,
    usePermit2Approve,
    intl,
    estReceiveTokenRate,
    totalAnnualRewardsFiatValue,
    showEstimateGasAlert,
    daysSpent,
  ]);
  const isAccordionTriggerDisabled = accordionContent.length === 0;
  return (
    <StakingFormWrapper>
      <StakingAmountInput
        title={intl.formatMessage({ id: ETranslations.earn_deposit })}
        hasError={isInsufficientBalance || isLessThanMinAmount}
        value={amountValue}
        onChange={onChangeAmountValue}
        tokenSelectorTriggerProps={{
          selectedTokenImageUri: token.logoURI,
          selectedTokenSymbol: token.symbol,
          selectedNetworkImageUri: network?.logoURI,
        }}
        balanceProps={{
          value: balance,
          onPress: onMax,
        }}
        inputProps={{
          placeholder: '0',
        }}
        valueProps={{
          value: currentValue,
          currency: currentValue ? symbol : undefined,
        }}
        enableMaxAmount
        onSelectPercentageStage={onSelectPercentageStage}
      />
      {platformEnv.isDev ? (
        <SizableText>{`allowance: ${allowance}, shouldApprove: ${
          shouldApprove ? 'true' : 'false'
        }`}</SizableText>
      ) : null}
      {isLessThanMinAmount ? (
        <Alert
          icon="InfoCircleOutline"
          type="critical"
          title={intl.formatMessage(
            { id: ETranslations.earn_minimum_amount },
            { number: `${minAmount} ${token.symbol}` },
          )}
        />
      ) : null}
      {isInsufficientBalance ? (
        <Alert
          icon="InfoCircleOutline"
          type="critical"
          title={intl.formatMessage({
            id: ETranslations.earn_insufficient_balance,
          })}
        />
      ) : null}
      <YStack
        p="$3.5"
        pt="$5"
        borderRadius="$3"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
      >
        {apr && Number(apr) > 0 ? (
          <XStack gap="$1" ai="center">
            <SizableText color="$textSuccess" size="$headingLg">
              {`${formatApy(apr)}% APY`}
            </SizableText>
            {apys ? (
              <Popover
                floatingPanelProps={{
                  w: 320,
                }}
                title={intl.formatMessage({
                  id: ETranslations.earn_rewards,
                })}
                renderTrigger={
                  <IconButton
                    icon="CoinsAddOutline"
                    size="small"
                    variant="tertiary"
                  />
                }
                renderContent={
                  <ProtocolApyRewards
                    providerName={providerName}
                    apys={apys}
                    eventEndTime={eventEndTime}
                    poolFee={poolFee}
                    rewardAssets={rewardAssets}
                  />
                }
                placement="top"
              />
            ) : null}
          </XStack>
        ) : null}
        <YStack pt="$3.5" gap="$2">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: earnUtils.isFalconProvider({
                providerName,
              })
                ? ETranslations.earn_est_daily_rewards
                : ETranslations.earn_est_annual_rewards,
            })}
          </SizableText>
          {estimatedAnnualRewards.length
            ? estimatedAnnualRewards.map((reward) => (
                <SizableText key={reward.token.address}>
                  <NumberSizeableText
                    size="$bodyLgMedium"
                    formatter="balance"
                    formatterOptions={{ tokenSymbol: reward.token.symbol }}
                  >
                    {reward.amount}
                  </NumberSizeableText>
                  {reward.fiatValue ? (
                    <SizableText color="$textSubdued">
                      <SizableText color="$textSubdued">{' ('}</SizableText>
                      <NumberSizeableText
                        size="$bodyLgMedium"
                        formatter="value"
                        color="$textSubdued"
                        formatterOptions={{ currency: symbol }}
                      >
                        {reward.fiatValue}
                      </NumberSizeableText>
                      <SizableText color="$textSubdued">)</SizableText>
                    </SizableText>
                  ) : null}
                  {reward.suffix ? (
                    <SizableText pl="$1" color="$textSubdued">
                      {reward.suffix}
                    </SizableText>
                  ) : null}
                </SizableText>
              ))
            : placeholderTokens}
        </YStack>
        <Divider my="$5" />

        <Accordion
          overflow="hidden"
          width="100%"
          type="single"
          collapsible
          defaultValue=""
        >
          <Accordion.Item value="staking-accordion-content">
            <Accordion.Trigger
              unstyled
              flexDirection="row"
              alignItems="center"
              alignSelf="flex-start"
              px="$1"
              mx="$-1"
              width="100%"
              justifyContent="space-between"
              borderWidth={0}
              bg="$transparent"
              userSelect="none"
              borderRadius="$1"
              cursor={isAccordionTriggerDisabled ? 'not-allowed' : 'pointer'}
              disabled={isAccordionTriggerDisabled}
            >
              {({ open }: { open: boolean }) => (
                <>
                  <XStack gap="$1.5" alignItems="center">
                    <Image
                      width="$5"
                      height="$5"
                      src={providerLogo}
                      borderRadius="$2"
                    />
                    <SizableText size="$bodyMd">
                      {capitalizeString(providerName || '')}
                    </SizableText>
                  </XStack>
                  <XStack>
                    {isAccordionTriggerDisabled ? undefined : (
                      <SizableText color="$textSubdued" size="$bodyMd">
                        {intl.formatMessage({
                          id: ETranslations.global_details,
                        })}
                      </SizableText>
                    )}
                    <YStack
                      animation="quick"
                      rotate={
                        open && !isAccordionTriggerDisabled ? '180deg' : '0deg'
                      }
                      left="$2"
                    >
                      <Icon
                        name="ChevronDownSmallOutline"
                        color={
                          isAccordionTriggerDisabled
                            ? '$iconDisabled'
                            : '$iconSubdued'
                        }
                        size="$5"
                      />
                    </YStack>
                  </XStack>
                </>
              )}
            </Accordion.Trigger>
            <Accordion.HeightAnimator animation="quick">
              <Accordion.Content
                animation="quick"
                exitStyle={{ opacity: 0 }}
                px={0}
                pb={0}
                pt="$3.5"
                gap="$2.5"
              >
                {accordionContent}
              </Accordion.Content>
            </Accordion.HeightAnimator>
          </Accordion.Item>
        </Accordion>
        <TradeOrBuy
          token={token}
          accountId={approveTarget.accountId}
          networkId={approveTarget.networkId}
        />
      </YStack>
      <Page.Footer>
        <Stack
          bg="$bgApp"
          flexDirection="column"
          $gtMd={{
            flexDirection: 'row',
            alignItems: 'center',
            jc: 'space-between',
          }}
        >
          <Stack pl="$5" $md={{ pt: '$5' }}>
            {isShowStakeProgress ? (
              <StakeProgress
                approveType={approveType ?? EApproveType.Legacy}
                currentStep={
                  isDisable || shouldApprove
                    ? EStakeProgressStep.approve
                    : EStakeProgressStep.deposit
                }
              />
            ) : null}
          </Stack>

          <Page.FooterActions
            onConfirmText={onConfirmText}
            confirmButtonProps={{
              onPress: shouldApprove ? onApprove : onSubmit,
              loading: loadingAllowance || approving,
              disabled: isDisable,
            }}
          />
        </Stack>
        <PercentageStageOnKeyboard
          onSelectPercentageStage={onSelectPercentageStage}
        />
      </Page.Footer>
    </StakingFormWrapper>
  );
}
