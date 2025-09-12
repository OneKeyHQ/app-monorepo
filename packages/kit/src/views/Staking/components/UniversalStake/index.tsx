import type { PropsWithChildren, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isNaN } from 'lodash';
import { useIntl } from 'react-intl';
import { Keyboard, StyleSheet } from 'react-native';
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
  Page,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  PercentageStageOnKeyboard,
  calcPercentBalance,
} from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { useEarnActions } from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import { validateAmountInputForStaking } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import type { IFeeUTXO } from '@onekeyhq/shared/types/fee';
import type {
  IApproveConfirmFnParams,
  ICheckAmountAlert,
  IEarnEstimateFeeResp,
  IEarnTextTooltip,
  IEarnTokenInfo,
  IProtocolInfo,
  IStakeTransactionConfirmation,
} from '@onekeyhq/shared/types/staking';
import {
  EApproveType,
  ECheckAmountActionType,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { useEarnPermitApprove } from '../../hooks/useEarnPermitApprove';
import { useTrackTokenAllowance } from '../../hooks/useUtilsHooks';
import { capitalizeString, countDecimalPlaces } from '../../utils/utils';
import { BtcFeeRateInput } from '../BtcFeeRateInput';
import { CalculationListItem } from '../CalculationList';
import {
  EstimateNetworkFee,
  useShowStakeEstimateGasAlert,
} from '../EstimateNetworkFee';
import { EarnActionIcon } from '../ProtocolDetails/EarnActionIcon';
import { EarnText } from '../ProtocolDetails/EarnText';
import { EStakeProgressStep, StakeProgress } from '../StakeProgress';
import {
  StakingAmountInput,
  useOnBlurAmountValue,
} from '../StakingAmountInput';
import StakingFormWrapper from '../StakingFormWrapper';
import { TradeOrBuy } from '../TradeOrBuy';
import { formatStakingDistanceToNowStrict } from '../utils';

import type { FontSizeTokens } from 'tamagui';

type IUniversalStakeProps = {
  accountId: string;
  networkId: string;
  balance: string;

  tokenImageUri?: string;
  tokenSymbol?: string;

  decimals?: number;

  providerName?: string;
  providerLogo?: string;

  minTransactionFee?: string;
  apr?: string;

  isDisabled?: boolean;

  estimateFeeUTXO?: Required<Pick<IFeeUTXO, 'feeRate'>>[];

  currentAllowance?: string;

  approveType?: EApproveType;
  onConfirm?: (params: IApproveConfirmFnParams) => Promise<void>;
  onFeeRateChange?: (rate: string) => void;

  tokenInfo?: IEarnTokenInfo;
  protocolInfo?: IProtocolInfo;
  approveTarget: {
    accountId: string;
    networkId: string;
    spenderAddress: string;
    token?: IToken;
  };
};

export function UniversalStake({
  accountId,
  networkId,
  balance,
  decimals,
  minTransactionFee = '0',
  tokenImageUri,
  tokenSymbol,
  providerName = '',
  providerLogo,
  estimateFeeUTXO,
  isDisabled,
  onConfirm,
  onFeeRateChange,
  protocolInfo,
  tokenInfo,
  approveType,
  approveTarget,
  currentAllowance,
}: PropsWithChildren<IUniversalStakeProps>) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const { handleOpenWebSite } = useBrowserAction().current;
  const showEstimateGasAlert = useShowStakeEstimateGasAlert();
  const [amountValue, setAmountValue] = useState('');
  const [approving, setApproving] = useState<boolean>(false);
  const useVaultProvider = useMemo(
    () => earnUtils.useVaultProvider({ providerName }),
    [providerName],
  );
  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();

  const network = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getNetwork({
        networkId,
      }),
    [networkId],
  ).result;

  const [estimateFeeResp, setEstimateFeeResp] = useState<
    undefined | IEarnEstimateFeeResp
  >();

  const { getPermitSignature } = useEarnPermitApprove();
  const { getPermitCache, updatePermitCache } = useEarnActions().current;

  const useApprove = useMemo(() => !!approveType, [approveType]);
  const usePermit2Approve = approveType === EApproveType.Permit;
  const permitSignatureRef = useRef<string | undefined>(undefined);
  const isFocus = useIsFocused();

  const {
    allowance,
    loading: loadingAllowance,
    trackAllowance,
    fetchAllowanceResponse,
  } = useTrackTokenAllowance({
    accountId: approveTarget.accountId,
    networkId: approveTarget.networkId,
    tokenAddress: approveTarget.token?.address || '',
    spenderAddress: approveTarget.spenderAddress,
    initialValue: currentAllowance ?? '0',
    approveType,
  });
  const shouldApprove = useMemo(() => {
    if (!useApprove) {
      return false;
    }

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
        tokenAddress: approveTarget.token?.address || '',
        amount: amountValue,
      });
      if (permitCache) {
        permitSignatureRef.current = permitCache.signature;
        return false;
      }
    }

    return !amountValueBN.isNaN() && allowanceBN.lt(amountValue);
  }, [
    useApprove,
    isFocus,
    amountValue,
    allowance,
    usePermit2Approve,
    getPermitCache,
    approveTarget.accountId,
    approveTarget.networkId,
    approveTarget.token?.address,
  ]);

  const [transactionConfirmation, setTransactionConfirmation] = useState<
    IStakeTransactionConfirmation | undefined
  >();
  const fetchTransactionConfirmation = useCallback(
    async (amount: string) => {
      const resp =
        await backgroundApiProxy.serviceStaking.getTransactionConfirmation({
          networkId,
          provider: providerName,
          symbol: tokenInfo?.token.symbol || '',
          vault: useVaultProvider
            ? protocolInfo?.approve?.approveTarget || protocolInfo?.vault || ''
            : '',
          accountAddress: protocolInfo?.earnAccount?.accountAddress || '',
          action: ECheckAmountActionType.STAKING,
          amount,
        });
      return resp;
    },
    [
      networkId,
      providerName,
      tokenInfo?.token.symbol,
      useVaultProvider,
      protocolInfo?.approve?.approveTarget,
      protocolInfo?.vault,
      protocolInfo?.earnAccount?.accountAddress,
    ],
  );

  const debouncedFetchTransactionConfirmation = useDebouncedCallback(
    async (amount?: string) => {
      const resp = await fetchTransactionConfirmation(amount || '0');
      setTransactionConfirmation(resp);
    },
    350,
  );

  const protocolVault = useVaultProvider
    ? protocolInfo?.approve?.approveTarget || protocolInfo?.vault
    : undefined;

  const fetchEstimateFeeResp = useCallback(
    async (amount?: string) => {
      if (shouldApprove && usePermit2Approve) {
        return undefined;
      }
      if (!amount) {
        return undefined;
      }
      const amountNumber = BigNumber(amount);
      if (amountNumber.isZero() || amountNumber.isNaN()) {
        return undefined;
      }

      const permitParams: {
        approveType?: 'permit';
        permitSignature?: string;
      } = {};

      if (usePermit2Approve && !shouldApprove) {
        permitParams.approveType = EApproveType.Permit;
        if (permitSignatureRef.current) {
          const amountBN = BigNumber(amount);
          const allowanceBN = BigNumber(allowance);
          if (amountBN.gt(allowanceBN)) {
            permitParams.permitSignature = permitSignatureRef.current;
          }
        }
      }

      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId,
        networkId,
      });
      const resp = await backgroundApiProxy.serviceStaking.estimateFee({
        networkId,
        provider: providerName,
        symbol: tokenInfo?.token.symbol || '',
        action: shouldApprove ? 'approve' : 'stake',
        amount: amountNumber.toFixed(),
        protocolVault,
        accountAddress: account?.address,
        ...permitParams,
      });
      return resp;
    },
    [
      accountId,
      allowance,
      networkId,
      protocolVault,
      providerName,
      shouldApprove,
      tokenInfo?.token.symbol,
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

  const checkEstimateGasAlert = useCallback(
    async (onNext: () => Promise<void> | undefined) => {
      if (usePermit2Approve) {
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
      usePermit2Approve,
      fetchEstimateFeeResp,
      amountValue,
      showEstimateGasAlert,
    ],
  );

  const prevShouldApproveRef = useRef<boolean | undefined>(undefined);

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

    void debouncedFetchTransactionConfirmation(amountValue);
  }, [
    shouldApprove,
    amountValue,
    debouncedFetchEstimateFeeResp,
    debouncedFetchTransactionConfirmation,
  ]);

  // const { showFalconEventEndedDialog } = useFalconEventEndedDialog({
  //   providerName,
  //   eventEndTime: protocolInfo?.eventEndTime,
  //   // weeklyNetApyWithoutFee: protocolInfo?.apys?.weeklyNetApyWithoutFee,
  // });

  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId: approveTarget.accountId,
    networkId: approveTarget.networkId,
  });

  const [checkAmountMessage, setCheckoutAmountMessage] = useState('');
  const [checkAmountAlerts, setCheckAmountAlerts] = useState<
    ICheckAmountAlert[]
  >([]);
  const [checkAmountLoading, setCheckAmountLoading] = useState(false);

  const checkAmount = useDebouncedCallback(async (amount: string) => {
    if (isNaN(amount)) {
      return;
    }
    setCheckAmountLoading(true);
    try {
      const response = await backgroundApiProxy.serviceStaking.checkAmount({
        accountId,
        networkId,
        symbol: tokenSymbol,
        provider: providerName,
        action: ECheckAmountActionType.STAKING,
        amount,
        protocolVault,
        withdrawAll: false,
      });

      if (Number(response.code) === 0) {
        setCheckoutAmountMessage('');
        setCheckAmountAlerts(response.data?.alerts || []);
      } else {
        setCheckoutAmountMessage(response.message);
        setCheckAmountAlerts([]);
      }
    } finally {
      setCheckAmountLoading(false);
    }
  }, 300);

  // Initialize checkAmount on component mount
  useEffect(() => {
    void checkAmount('0');
  }, [checkAmount]);

  const onChangeAmountValue = useCallback(
    (value: string) => {
      if (!validateAmountInputForStaking(value, decimals)) {
        return;
      }
      const valueBN = new BigNumber(value);
      if (valueBN.isNaN()) {
        if (value === '') {
          setAmountValue('');
          setCheckoutAmountMessage('');
          setCheckAmountAlerts([]);
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
        void checkAmount(value);
      }
    },
    [decimals, debouncedFetchEstimateFeeResp, checkAmount],
  );

  const onBlurAmountValue = useOnBlurAmountValue(amountValue, setAmountValue);

  const onMax = useCallback(() => {
    const balanceBN = new BigNumber(balance);
    const remainBN = balanceBN.minus(minTransactionFee);
    if (remainBN.gt(0)) {
      onChangeAmountValue(remainBN.toFixed());
    } else {
      onChangeAmountValue(balance);
    }
  }, [onChangeAmountValue, balance, minTransactionFee]);

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

  const currentValue = useMemo<string | undefined>(() => {
    if (Number(amountValue) > 0 && Number(tokenInfo?.price) > 0) {
      const amountValueBn = new BigNumber(amountValue);
      return amountValueBn.multipliedBy(tokenInfo?.price ?? '0').toFixed();
    }
    return undefined;
  }, [amountValue, tokenInfo?.price]);

  const isInsufficientBalance = useMemo<boolean>(
    () => new BigNumber(amountValue).gt(balance),
    [amountValue, balance],
  );

  const isStakingCapFull = useMemo(() => {
    if (!protocolInfo?.remainingCap) {
      return false;
    }
    const remainingCapBN = new BigNumber(protocolInfo.remainingCap);
    return !remainingCapBN.isNaN() && remainingCapBN.isEqualTo(0);
  }, [protocolInfo?.remainingCap]);

  // const isLessThanMinAmount = useMemo<boolean>(() => {
  //   const minAmountBn = new BigNumber(minAmount);
  //   const amountValueBn = new BigNumber(amountValue);
  //   if (minAmountBn.isGreaterThan(0) && amountValueBn.isGreaterThan(0)) {
  //     return amountValueBn.isLessThan(minAmountBn);
  //   }
  //   return false;
  // }, [minAmount, amountValue]);

  // const isGreaterThanMaxAmount = useMemo(() => {
  //   if (maxAmount && Number(maxAmount) > 0 && Number(amountValue) > 0) {
  //     return new BigNumber(amountValue).isGreaterThan(maxAmount);
  //   }
  //   return false;
  // }, [maxAmount, amountValue]);

  const isCheckAmountMessageError =
    amountValue?.length > 0 && !!checkAmountMessage;

  const amountInputDisabled = useMemo(() => {
    return isDisabled || isStakingCapFull;
  }, [isDisabled, isStakingCapFull]);

  const isDisable = useMemo(() => {
    const amountValueBN = BigNumber(amountValue);
    return (
      amountValueBN.isNaN() ||
      amountValueBN.isLessThanOrEqualTo(0) ||
      isInsufficientBalance ||
      isCheckAmountMessageError ||
      checkAmountAlerts.length > 0 ||
      isStakingCapFull ||
      checkAmountLoading
    );
    // return (
    //   amountValueBN.isNaN() ||
    //   amountValueBN.isLessThanOrEqualTo(0) ||
    //   isInsufficientBalance ||
    //   isLessThanMinAmount ||
    //   isGreaterThanMaxAmount ||
    //   isReachBabylonCap
    // );
  }, [
    amountValue,
    isCheckAmountMessageError,
    checkAmountAlerts.length,
    isInsufficientBalance,
    isStakingCapFull,
    checkAmountLoading,
  ]);

  // const estAnnualRewardsState = useMemo(() => {
  //   if (Number(amountValue) > 0 && Number(apr) > 0) {
  //     const amountBN = BigNumber(amountValue)
  //       .multipliedBy(apr ?? 0)
  //       .dividedBy(100);
  //     return {
  //       amount: amountBN.toFixed(),
  //       fiatValue:
  //         Number(price) > 0
  //           ? amountBN.multipliedBy(price).toFixed()
  //           : undefined,
  //     };
  //   }
  // }, [amountValue, apr, price]);

  // const btcStakeTerm = useMemo(() => {
  //   if (minStakeTerm && Number(minStakeTerm) > 0 && minStakeBlocks) {
  //     const days = Math.ceil(minStakeTerm / (1000 * 60 * 60 * 24));
  //     return (
  //       <SizableText size="$bodyLgMedium">
  //         {intl.formatMessage(
  //           { id: ETranslations.earn_term_number_days },
  //           { number_days: days },
  //         )}
  //         <SizableText size="$bodyLgMedium" color="$textSubdued">
  //           {intl.formatMessage(
  //             { id: ETranslations.earn_term_number_block },
  //             { number: minStakeBlocks },
  //           )}
  //         </SizableText>
  //       </SizableText>
  //     );
  //   }
  //   return null;
  // }, [minStakeTerm, minStakeBlocks, intl]);

  // const btcUnlockTime = useMemo(() => {
  //   if (minStakeTerm) {
  //     const currentDate = new Date();
  //     const endDate = new Date(currentDate.getTime() + minStakeTerm);
  //     return formatDate(endDate, { hideTimeForever: true });
  //   }
  //   return null;
  // }, [minStakeTerm]);

  const daysSpent = useMemo(() => {
    if (estimateFeeResp?.coverFeeSeconds) {
      return formatStakingDistanceToNowStrict(estimateFeeResp.coverFeeSeconds);
    }
  }, [estimateFeeResp?.coverFeeSeconds]);

  const onSubmit = useCallback(async () => {
    Keyboard.dismiss();
    const permitSignatureParams = usePermit2Approve
      ? {
          approveType,
          permitSignature: permitSignatureRef.current,
        }
      : undefined;
    const handleConfirm = () =>
      onConfirm?.({ amount: amountValue, ...permitSignatureParams });

    // Wait for the dialog confirmation if it's shown
    // await showFalconEventEndedDialog();

    if (estimateFeeResp) {
      const daySpent =
        Number(estimateFeeResp?.coverFeeSeconds || 0) / 3600 / 24;

      if (daySpent && daySpent > 5) {
        showEstimateGasAlert({
          daysConsumed: formatStakingDistanceToNowStrict(
            estimateFeeResp.coverFeeSeconds,
          ),
          estFiatValue: estimateFeeResp.feeFiatValue,
          onConfirm: handleConfirm,
        });
        return;
      }
    }

    if (!usePermit2Approve || (usePermit2Approve && !shouldApprove)) {
      await checkEstimateGasAlert(handleConfirm);
      return;
    }

    await handleConfirm();
  }, [
    usePermit2Approve,
    approveType,
    estimateFeeResp,
    shouldApprove,
    onConfirm,
    amountValue,
    showEstimateGasAlert,
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
        ...tokenInfo?.token,
        address: tokenInfo?.token.address ?? '',
        symbol: tokenInfo?.token.symbol ?? '',
        decimals: tokenInfo?.token.decimals ?? 0,
        isNative: !!tokenInfo?.token.isNative,
        name: tokenInfo?.token.name ?? (tokenInfo?.token.symbol || ''),
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
    tokenInfo?.token,
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

    if (tokenInfo?.token && earnUtils.isUSDTonETHNetwork(tokenInfo?.token)) {
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
            tokenAddress: tokenInfo?.token?.address ?? '',
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
            token: tokenInfo?.token as IToken,
            amountValue,
            providerName,
            vaultAddress: approveTarget.spenderAddress,
          });
          permitSignatureRef.current = permitBundlerAction;

          // Update permit cache
          updatePermitCache({
            accountId: approveTarget.accountId,
            networkId: approveTarget.networkId,
            tokenAddress: tokenInfo?.token?.address ?? '',
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
    tokenInfo?.token,
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

  const accordionContent = useMemo(() => {
    const items: ReactElement[] = [];
    if (Number(amountValue) <= 0) {
      return items;
    }

    if (transactionConfirmation?.receive) {
      items.push(
        <CalculationListItem>
          <CalculationListItem.Label
            size={transactionConfirmation.receive.title.size || '$bodyMd'}
            color={transactionConfirmation.receive.title.color}
            tooltip={
              transactionConfirmation.receive.tooltip.type === 'text'
                ? transactionConfirmation.receive.tooltip.data.title.text
                : undefined
            }
          >
            {transactionConfirmation.receive.title.text}
          </CalculationListItem.Label>
          <EarnText
            text={transactionConfirmation.receive.description}
            size="$bodyMdMedium"
          />
        </CalculationListItem>,
      );
    }
    if (estimateFeeResp) {
      items.push(
        <EstimateNetworkFee
          isVisible
          estimateFeeResp={estimateFeeResp}
          onPress={() => {
            showEstimateGasAlert({
              daysConsumed: daysSpent,
              estFiatValue: estimateFeeResp.feeFiatValue,
            });
          }}
        />,
      );
    }

    if (
      providerName?.toLowerCase() === EEarnProviderEnum.Babylon.toLowerCase() &&
      estimateFeeUTXO
    ) {
      items.push(
        <BtcFeeRateInput
          estimateFeeUTXO={estimateFeeUTXO}
          onFeeRateChange={onFeeRateChange}
        />,
      );
    }
    return items;
  }, [
    amountValue,
    daysSpent,
    estimateFeeResp,
    estimateFeeUTXO,
    onFeeRateChange,
    providerName,
    showEstimateGasAlert,
    transactionConfirmation?.receive,
  ]);
  const isAccordionTriggerDisabled = !amountValue;
  const isShowStakeProgress =
    useApprove &&
    !!amountValue &&
    (shouldApprove || showStakeProgressRef.current[amountValue]);

  const onConfirmText = useMemo(() => {
    if (!useApprove) {
      return intl.formatMessage({ id: ETranslations.global_continue });
    }
    if (shouldApprove) {
      return intl.formatMessage(
        {
          id: usePermit2Approve
            ? ETranslations.earn_approve_deposit
            : ETranslations.global_approve,
        },
        { amount: amountValue, symbol: tokenInfo?.token.symbol || '' },
      );
    }
    return intl.formatMessage({ id: ETranslations.earn_deposit });
  }, [
    useApprove,
    shouldApprove,
    intl,
    usePermit2Approve,
    amountValue,
    tokenInfo?.token.symbol,
  ]);

  return (
    <StakingFormWrapper>
      <Stack position="relative" opacity={amountInputDisabled ? 0.7 : 1}>
        <StakingAmountInput
          title={intl.formatMessage({ id: ETranslations.earn_deposit })}
          disabled={amountInputDisabled}
          hasError={isInsufficientBalance || isCheckAmountMessageError}
          value={amountValue}
          onChange={onChangeAmountValue}
          onBlur={onBlurAmountValue}
          tokenSelectorTriggerProps={{
            selectedTokenImageUri: tokenImageUri,
            selectedTokenSymbol: tokenSymbol?.toUpperCase(),
            selectedNetworkImageUri: network?.logoURI,
          }}
          balanceProps={{
            value: balance,
            onPress: onMax,
          }}
          inputProps={{
            placeholder: '0',
            autoFocus: !amountInputDisabled,
          }}
          valueProps={{
            value: currentValue,
            currency: currentValue ? symbol : undefined,
          }}
          enableMaxAmount
          onSelectPercentageStage={onSelectPercentageStage}
        />
        {amountInputDisabled ? (
          <Stack position="absolute" w="100%" h="100%" zIndex={1} />
        ) : null}
      </Stack>
      {isCheckAmountMessageError ? (
        <Alert
          icon="InfoCircleOutline"
          type="critical"
          title={checkAmountMessage}
        />
      ) : null}
      {checkAmountAlerts.length > 0 ? (
        <>
          {checkAmountAlerts.map((alert, index) => (
            <Alert
              key={index}
              type="warning"
              renderTitle={() => {
                return <EarnText text={alert.text} size="$bodyMdMedium" />;
              }}
              action={
                alert.button
                  ? {
                      primary: alert.button.text.text,
                      onPrimaryPress: () => {
                        if (alert.button?.data?.link) {
                          handleOpenWebSite({
                            switchToMultiTabBrowser: gtMd,
                            navigation,
                            useCurrentWindow: false,
                            webSite: {
                              url: alert.button.data.link,
                              title: alert.button.data.link,
                              logo: undefined,
                              sortIndex: undefined,
                            },
                          });
                        }
                      },
                    }
                  : undefined
              }
            />
          ))}
        </>
      ) : null}

      {/* {isLessThanMinAmount ? (
        <Alert
          icon="InfoCircleOutline"
          type="critical"
          title={intl.formatMessage(
            { id: ETranslations.earn_minimum_amount },
            { number: minAmount, symbol: tokenSymbol },
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
      {isGreaterThanMaxAmount ? (
        <Alert
          icon="InfoCircleOutline"
          type="critical"
          title={intl.formatMessage(
            {
              id: ETranslations.earn_maximum_staking_alert,
            },
            { number: maxAmount ?? '', symbol: tokenSymbol },
          )}
        />
      ) : null}
      {isReachBabylonCap ? (
        <Alert
          icon="InfoCircleOutline"
          type="critical"
          title={intl.formatMessage({
            id: ETranslations.earn_reaching_staking_cap,
          })}
        />
      ) : null} */}

      <YStack
        p="$3.5"
        pt="$5"
        borderRadius="$3"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
      >
        {protocolInfo?.apyDetail ? (
          <XStack gap="$1" ai="center">
            <EarnText
              text={protocolInfo.apyDetail.description}
              size="$headingLg"
              color="$textSuccess"
            />
            <EarnActionIcon
              title={protocolInfo.apyDetail.title.text}
              actionIcon={protocolInfo.apyDetail.button}
            />
          </XStack>
        ) : null}
        <YStack pt="$3.5" gap="$2">
          <XStack ai="center" gap="$1">
            <EarnText
              text={transactionConfirmation?.title}
              color="$textSubdued"
              size="$bodyMd"
              boldTextProps={{
                size: '$bodyMdMedium',
              }}
            />
            {transactionConfirmation?.tooltip ? (
              <Popover
                placement="top"
                title={transactionConfirmation?.title?.text}
                renderTrigger={
                  <IconButton
                    iconColor="$iconSubdued"
                    size="small"
                    icon="InfoCircleOutline"
                    variant="tertiary"
                  />
                }
                renderContent={
                  <Stack p="$5">
                    <EarnText
                      text={
                        transactionConfirmation?.tooltip?.type === 'text'
                          ? transactionConfirmation.tooltip.data
                          : undefined
                      }
                      size="$bodyMd"
                    />
                  </Stack>
                }
              />
            ) : null}
          </XStack>
          {transactionConfirmation?.rewards.map((reward) => {
            const hasTooltip = reward.tooltip?.type === 'text';
            let descriptionTextSize = (
              hasTooltip ? '$bodyMd' : '$bodyLgMedium'
            ) as FontSizeTokens;
            if (reward.description.size) {
              descriptionTextSize = reward.description.size;
            }

            return (
              <XStack
                key={reward.title.text}
                gap="$1"
                ai="flex-start"
                mt="$1.5"
                flexWrap="wrap"
              >
                <XStack gap="$1" flex={1} flexWrap="wrap" ai="center">
                  <EarnText
                    text={reward.title}
                    color={reward.title.color}
                    size={reward.title.size}
                  />
                  <XStack gap="$1" flex={1} flexWrap="wrap" ai="center">
                    <EarnText
                      text={reward.description}
                      size={descriptionTextSize}
                      color={reward.description.color ?? '$textSubdued'}
                      flexShrink={1}
                    />
                    {hasTooltip ? (
                      <Popover.Tooltip
                        iconSize="$5"
                        title={reward.title.text}
                        tooltip={
                          (reward.tooltip as IEarnTextTooltip)?.data.text
                        }
                        placement="top"
                      />
                    ) : null}
                  </XStack>
                </XStack>
              </XStack>
            );
          })}
        </YStack>
        {/* {btcStakeTerm ? (
          <YStack gap="$2">
            <XStack gap="$1">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.earn_term,
                })}
              </SizableText>
              <Popover.Tooltip
                iconSize="$5"
                title={intl.formatMessage({
                  id: ETranslations.earn_term,
                })}
                tooltip={intl.formatMessage({
                  id: ETranslations.earn_term_tooltip,
                })}
                placement="top"
              />
            </XStack>
            {btcStakeTerm}
          </YStack>
        ) : null} */}
        {/* {stakingTime ? (
          <XStack pt="$3.5" gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.earn_earnings_start })}
            </SizableText>
            <SizableText size="$bodyMdMedium">
              {intl.formatMessage(
                { id: ETranslations.earn_in_number },
                {
                  number: formatStakingDistanceToNowStrict(stakingTime),
                },
              )}
            </SizableText>
          </XStack>
        ) : null} */}
        {/* {nextLaunchLeft && rewardToken ? (
          <XStack pt="$3.5" gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.earn_until_next_launch,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium">
              {intl.formatMessage(
                { id: ETranslations.earn_number_symbol_left },
                {
                  number: Number(nextLaunchLeft).toFixed(2),
                  symbol: rewardToken,
                },
              )}
            </SizableText>
            <Popover.Tooltip
              iconSize="$5"
              title={intl.formatMessage({
                id: ETranslations.earn_until_next_launch,
              })}
              tooltip={intl.formatMessage({
                id: ETranslations.earn_until_next_launch_tooltip,
              })}
              placement="top"
            />
          </XStack>
        ) : null} */}
        {/* {btcUnlockTime ? (
          <XStack pt="$3.5" gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.earn_unlock_time,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium">{btcUnlockTime}</SizableText>
          </XStack>
        ) : null} */}
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
          token={tokenInfo?.token as IToken}
          accountId={accountId}
          networkId={networkId}
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
                approveType={approveType}
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
              loading: loadingAllowance || approving || checkAmountLoading,
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
