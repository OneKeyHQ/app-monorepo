import type { PropsWithChildren, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
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
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAmountInputFormItemProps } from '@onekeyhq/kit/src/components/AmountInput';
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
  IEarnPermit2ApproveSignData,
  IEarnSelectField,
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
import { useEarnSignMessageWithoutVerify } from '../../hooks/useEarnSignMessageWithoutVerify';
import { usePendleLayoutState } from '../../hooks/usePendleLayoutState';
import { useQuoteRefresh } from '../../hooks/useQuoteRefresh';
import { useTrackTokenAllowance } from '../../hooks/useUtilsHooks';
import {
  capitalizeString,
  countDecimalPlaces,
  isInvalidAmount,
  shouldShowStakingSummaryCard,
} from '../../utils/utils';
import { BtcFeeRateInput } from '../BtcFeeRateInput';
import { CalculationListItem } from '../CalculationList';
import {
  EstimateNetworkFee,
  useShowStakeEstimateGasAlert,
} from '../EstimateNetworkFee';
import {
  type IManagePageV2ReceiveInputConfig,
  ManagePageV2ReceiveInput,
} from '../ManagePageV2ReceiveInput';
import { EarnActionIcon } from '../ProtocolDetails/EarnActionIcon';
import { EarnText } from '../ProtocolDetails/EarnText';
import { EarnTooltip } from '../ProtocolDetails/EarnTooltip';
import { EarnValidatorSelect } from '../ProtocolDetails/EarnValidatorSelect';
import {
  PendleAccordionTriggerContent,
  PendleSummarySection,
} from '../ProtocolDetails/PendleSharedComponents';
import {
  calcPriceImpactInfo,
  showHighPriceImpactDialog,
} from '../showHighPriceImpactDialog';
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
  beforeFooter?: ReactElement | null;
  showApyDetail?: boolean;
  isInModalContext?: boolean;
  ongoingValidator?: IEarnSelectField;
  receiveInputConfig?: IManagePageV2ReceiveInputConfig;
  transactionInputTokenAddress?: string;
  transactionOutputTokenAddress?: string;
  requestSymbol?: string;
  inputTitle?: string;
  tokenSelectorTriggerProps?: Partial<
    NonNullable<IAmountInputFormItemProps['tokenSelectorTriggerProps']>
  >;
  isQuoteExpired?: boolean;
  onQuoteReset?: () => void;
  refreshKey?: number;
  onQuoteRefreshingChange?: (loading: boolean) => void;
  pendleSlippage?: number;
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
  beforeFooter,
  showApyDetail = false,
  isInModalContext = false,
  ongoingValidator,
  receiveInputConfig,
  transactionInputTokenAddress,
  transactionOutputTokenAddress,
  requestSymbol,
  inputTitle,
  tokenSelectorTriggerProps,
  isQuoteExpired,
  onQuoteReset,
  refreshKey,
  onQuoteRefreshingChange,
  pendleSlippage,
}: PropsWithChildren<IUniversalStakeProps>) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { handleOpenWebSite } = useBrowserAction().current;
  const showEstimateGasAlert = useShowStakeEstimateGasAlert();
  const [amountValue, setAmountValue] = useState('');
  const [approving, setApproving] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [selectedValidator, setSelectedValidator] = useState<
    string | undefined
  >(ongoingValidator?.select?.defaultValue);

  // Reset selectedValidator when accountId/networkId changes (manage-page re-fetches)
  useEffect(() => {
    setSelectedValidator(ongoingValidator?.select?.defaultValue);
  }, [ongoingValidator?.select?.defaultValue]);

  const useVaultProvider = useMemo(
    () => earnUtils.isVaultBasedProvider({ providerName }),
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
  const signPersonalMessage = useEarnSignMessageWithoutVerify();
  const { getPermitCache, updatePermitCache } = useEarnActions().current;

  const isStakefishProvider = useMemo(
    () => earnUtils.isStakefishProvider({ providerName }),
    [providerName],
  );
  const isPendleProvider = useMemo(
    () => earnUtils.isPendleProvider({ providerName }),
    [providerName],
  );
  const actionSymbol = useMemo(
    () => requestSymbol || tokenInfo?.token.symbol || tokenSymbol || '',
    [requestSymbol, tokenInfo?.token.symbol, tokenSymbol],
  );
  // Only Stakefish ETH needs signature for create new validator
  const isStakefishEthStake = useMemo(
    () => isStakefishProvider && tokenSymbol?.toUpperCase() === 'ETH',
    [isStakefishProvider, tokenSymbol],
  );
  const isStakefishCreateNewValidator = useMemo(() => {
    if (!isStakefishEthStake || !selectedValidator) {
      return false;
    }
    const selectedOption = ongoingValidator?.select?.options?.find(
      (option) => option.value === selectedValidator,
    );
    return selectedOption?.extra?.isCreateNewValidator === true;
  }, [
    isStakefishEthStake,
    selectedValidator,
    ongoingValidator?.select?.options,
  ]);
  const stakefishPermitSignatureRef = useRef<string | undefined>(undefined);
  const stakefishPermitMessageRef = useRef<string | undefined>(undefined);

  const useApprove = useMemo(() => !!approveType, [approveType]);
  const usePermit2Approve = approveType === EApproveType.Permit;
  const permitSignatureRef = useRef<string | undefined>(undefined);
  const permit2DataRef = useRef<IEarnPermit2ApproveSignData | undefined>(
    undefined,
  );
  const allowanceAbortRef = useRef<AbortController | undefined>(undefined);
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
        permit2DataRef.current = permitCache.permit2Data;
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
  // Stakefish: identity for existing validator
  const stakefishIdentity =
    isStakefishProvider && !isStakefishCreateNewValidator
      ? selectedValidator
      : undefined;

  const fetchTransactionConfirmation = useCallback(
    async (amount: string) => {
      if (isDisabled) {
        return undefined;
      }
      const resp =
        await backgroundApiProxy.serviceStaking.getTransactionConfirmation({
          networkId,
          provider: providerName,
          symbol: actionSymbol,
          vault: useVaultProvider ? protocolInfo?.vault || '' : '',
          accountAddress: protocolInfo?.earnAccount?.accountAddress || '',
          action: ECheckAmountActionType.STAKING,
          amount,
          identity: stakefishIdentity,
          inputTokenAddress: transactionInputTokenAddress,
          outputTokenAddress: transactionOutputTokenAddress,
          slippage: pendleSlippage,
        });
      return resp;
    },
    [
      isDisabled,
      networkId,
      providerName,
      actionSymbol,
      useVaultProvider,
      protocolInfo?.vault,
      protocolInfo?.earnAccount?.accountAddress,
      stakefishIdentity,
      transactionInputTokenAddress,
      transactionOutputTokenAddress,
      pendleSlippage,
    ],
  );

  const [transactionConfirmationLoading, setTransactionConfirmationLoading] =
    useState(false);

  const debouncedFetchTransactionConfirmation = useDebouncedCallback(
    async (amount?: string) => {
      setTransactionConfirmationLoading(true);
      try {
        const resp = await fetchTransactionConfirmation(amount || '0');
        setTransactionConfirmation(resp);
        if (resp && amount && Number(amount) > 0) {
          onQuoteReset?.();
        }
      } catch {
        // keep stale state
      } finally {
        setTransactionConfirmationLoading(false);
      }
    },
    350,
  );

  const protocolVault = useVaultProvider
    ? protocolInfo?.vault || ''
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
        symbol: actionSymbol,
        action: shouldApprove ? 'approve' : 'stake',
        amount: amountNumber.toFixed(),
        protocolVault,
        accountAddress: account?.address,
        inputTokenAddress: transactionInputTokenAddress,
        outputTokenAddress: transactionOutputTokenAddress,
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
      actionSymbol,
      transactionInputTokenAddress,
      transactionOutputTokenAddress,
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
    stakefishIdentity,
  ]);

  const { quoteRefreshing, handleLocalRefreshQuote } = useQuoteRefresh({
    enabled: isPendleProvider,
    refreshKey,
    amountValue,
    fetchTransactionConfirmation,
    setTransactionConfirmation,
    onQuoteReset,
    onQuoteRefreshingChange,
  });

  useEffect(
    () => () => {
      allowanceAbortRef.current?.abort();
    },
    [],
  );

  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId: approveTarget.accountId,
    networkId: approveTarget.networkId,
  });

  const [checkAmountMessage, setCheckoutAmountMessage] = useState('');
  const [checkAmountAlerts, setCheckAmountAlerts] = useState<
    ICheckAmountAlert[]
  >([]);
  const [checkAmountLoading, setCheckAmountLoading] = useState(false);

  const quoteLoading = checkAmountLoading || transactionConfirmationLoading;

  const checkAmount = useDebouncedCallback(
    async ({ amount, identity }: { amount: string; identity?: string }) => {
      if (isInvalidAmount(amount)) {
        return;
      }
      setCheckAmountLoading(true);
      try {
        const response = await backgroundApiProxy.serviceStaking.checkAmount({
          accountId,
          networkId,
          symbol: actionSymbol,
          provider: providerName,
          action: identity
            ? ECheckAmountActionType.RESTAKE
            : ECheckAmountActionType.STAKING,
          amount,
          protocolVault,
          withdrawAll: false,
          identity,
          inputTokenAddress: transactionInputTokenAddress,
          outputTokenAddress: transactionOutputTokenAddress,
          slippage: pendleSlippage,
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
    },
    300,
  );

  useEffect(() => {
    void checkAmount({
      amount: amountValue || '0',
      identity: stakefishIdentity,
    });
  }, [checkAmount, stakefishIdentity, amountValue]);

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
      if (!isOverflowDecimals) {
        setAmountValue(value);
        void debouncedFetchEstimateFeeResp(value);
        void checkAmount({ amount: value, identity: stakefishIdentity });
      }
    },
    [decimals, debouncedFetchEstimateFeeResp, checkAmount, stakefishIdentity],
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
  }, [
    amountValue,
    isCheckAmountMessageError,
    checkAmountAlerts.length,
    isInsufficientBalance,
    isStakingCapFull,
    checkAmountLoading,
  ]);

  const daysSpent = useMemo(() => {
    if (estimateFeeResp?.coverFeeSeconds) {
      return formatStakingDistanceToNowStrict(estimateFeeResp.coverFeeSeconds);
    }
  }, [estimateFeeResp?.coverFeeSeconds]);

  const onSubmit = useCallback(async () => {
    Keyboard.dismiss();

    // Stakefish: get permit signature for create new validator
    if (isStakefishCreateNewValidator && !stakefishPermitSignatureRef.current) {
      setApproving(true);
      try {
        const { signature, message } = await signPersonalMessage({
          networkId,
          accountId,
          provider: providerName,
          symbol: tokenSymbol || '',
          amount: new BigNumber(amountValue).toFixed(),
          action: 'stake',
        });
        stakefishPermitSignatureRef.current = signature;
        stakefishPermitMessageRef.current = message;
      } catch (error) {
        console.error('Stakefish permit sign error:', error);
        setApproving(false);
        return;
      }
      setApproving(false);
    }

    // Determine permitSignature source: Morpho uses permitSignatureRef, Stakefish uses stakefishPermitSignatureRef
    let finalPermitSignature: string | undefined;
    let finalMessage: string | undefined;
    let finalUnsignedMessage: IEarnPermit2ApproveSignData | undefined;
    if (usePermit2Approve) {
      finalPermitSignature = permitSignatureRef.current;
      finalUnsignedMessage = permit2DataRef.current;
    } else if (isStakefishCreateNewValidator) {
      finalPermitSignature = stakefishPermitSignatureRef.current;
      finalMessage = stakefishPermitMessageRef.current;
    }

    const permitSignatureParams = finalPermitSignature
      ? {
          approveType: usePermit2Approve ? approveType : undefined,
          permitSignature: finalPermitSignature,
          unsignedMessage: finalUnsignedMessage,
          message: finalMessage,
        }
      : undefined;

    // Stakefish specific params: validatorPubkey only for existing validator
    const stakefishParams =
      isStakefishProvider && !isStakefishCreateNewValidator
        ? { validatorPubkey: selectedValidator }
        : undefined;

    const resetAmount = () => {
      setAmountValue('');
      setCheckoutAmountMessage('');
      setCheckAmountAlerts([]);
      // Reset stakefish permit signature and message
      stakefishPermitSignatureRef.current = undefined;
      stakefishPermitMessageRef.current = undefined;
    };
    const handleConfirm = async () => {
      setSubmitting(true);
      try {
        await onConfirm?.({
          amount: amountValue,
          effectiveApy: transactionConfirmation?.effectiveApy,
          ...permitSignatureParams,
          ...stakefishParams,
        });
        resetAmount();
        // Auto-refresh quote countdown after swap completes
        onQuoteReset?.();
      } finally {
        setSubmitting(false);
      }
    };

    // Check high price impact (Pendle only)
    if (isPendleProvider) {
      const payFiatValue =
        Number(amountValue) > 0 && Number(tokenInfo?.price) > 0
          ? new BigNumber(amountValue)
              .multipliedBy(tokenInfo?.price ?? '0')
              .toFixed()
          : undefined;
      const impactInfo = calcPriceImpactInfo({
        payFiatValue,
        receiveConfig: receiveInputConfig,
        receiveDescription: transactionConfirmation?.receive,
      });
      if (impactInfo) {
        const userConfirmed = await showHighPriceImpactDialog(intl, {
          percent: impactInfo.percent,
          lossAmount: `${symbol}${impactInfo.lossAmount}`,
        });
        if (!userConfirmed) return;
      }
    }

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
    isStakefishProvider,
    isPendleProvider,
    selectedValidator,
    isStakefishCreateNewValidator,
    signPersonalMessage,
    networkId,
    accountId,
    tokenSymbol,
    providerName,
    onQuoteReset,
    intl,
    symbol,
    tokenInfo?.price,
    receiveInputConfig,
    transactionConfirmation?.effectiveApy,
    transactionConfirmation?.receive,
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

  const waitForAllowanceAfterApprove = useCallback(
    async ({
      requiredAmount,
      maxAttempts = 15,
      intervalMs = 2000,
      signal,
    }: {
      requiredAmount: string;
      maxAttempts?: number;
      intervalMs?: number;
      signal?: AbortSignal;
    }) => {
      if (
        !useApprove ||
        usePermit2Approve ||
        tokenInfo?.token?.isNative ||
        !requiredAmount
      ) {
        return true;
      }

      const requiredAmountBN = new BigNumber(requiredAmount);
      if (requiredAmountBN.isNaN() || requiredAmountBN.lte(0)) {
        return true;
      }

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (signal?.aborted) {
          return false;
        }
        try {
          const allowanceInfo = await fetchAllowanceResponse();
          const allowanceBN = new BigNumber(
            allowanceInfo.allowanceParsed || '0',
          );
          if (!allowanceBN.isNaN() && allowanceBN.gte(requiredAmountBN)) {
            return true;
          }
        } catch (error) {
          defaultLogger.staking.page.permitSignError({
            error: error instanceof Error ? error.message : String(error),
          });
        }

        if (attempt < maxAttempts - 1) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, intervalMs);
          });
        }
      }

      return false;
    },
    [
      useApprove,
      usePermit2Approve,
      tokenInfo?.token?.isNative,
      fetchAllowanceResponse,
    ],
  );

  const onApprove = useCallback(async () => {
    Keyboard.dismiss();
    setApproving(true);
    let approveAllowance = allowance;
    try {
      const allowanceInfo = await fetchAllowanceResponse();
      approveAllowance = allowanceInfo.allowanceParsed;
    } catch (e) {
      console.error(e);
    }
    permitSignatureRef.current = undefined;
    permit2DataRef.current = undefined;
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
            permit2DataRef.current = permitCache.permit2Data;
            void onSubmit();
            setApproving(false);
            return;
          }

          const { signature, unsignedMessage } = await getPermitSignature({
            networkId: approveTarget.networkId,
            accountId: approveTarget.accountId,
            token: tokenInfo?.token as IToken,
            amountValue,
            providerName,
            vaultAddress: approveTarget.spenderAddress,
          });
          permitSignatureRef.current = signature;
          permit2DataRef.current = unsignedMessage;

          // Update permit cache
          updatePermitCache({
            accountId: approveTarget.accountId,
            networkId: approveTarget.networkId,
            tokenAddress: tokenInfo?.token?.address ?? '',
            amount: amountValue,
            signature,
            permit2Data: unsignedMessage,
            expiredAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
          });

          const freshFee = await fetchEstimateFeeResp(amountValue);
          setEstimateFeeResp(freshFee);

          await onSubmit();
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
        allowanceAbortRef.current?.abort();
        const abortController = new AbortController();
        allowanceAbortRef.current = abortController;
        void (async () => {
          try {
            const allowanceReady = await waitForAllowanceAfterApprove({
              requiredAmount: amountValue,
              signal: abortController.signal,
            });
            if (!allowanceReady) {
              return;
            }
            const freshFee = await fetchEstimateFeeResp(amountValue);
            setEstimateFeeResp(freshFee);
            await onSubmit();
          } finally {
            setApproving(false);
          }
        })();
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
    waitForAllowanceAfterApprove,
    fetchEstimateFeeResp,
    trackAllowance,
  ]);

  const {
    isPendleLikeLayout,
    pendleAccordionItems,
    pendleRewardRows,
    usePendleSummaryLayout,
    transactionDetailsTriggerText,
    apyDetail,
    showApyHeader,
    hasSummarySection,
    pendleTipText,
    showPendleTransactionSection,
    showExpiredRefresh,
    showReceiveInput,
    effectiveReceiveInputConfig,
    receiveArrowOverlayStyle,
  } = usePendleLayoutState({
    providerName,
    transactionConfirmation,
    amountValue,
    showApyDetail,
    receiveInputConfig,
    networkLogoURI: network?.logoURI,
    isQuoteExpired,
    loading: quoteLoading,
  });

  // During approve/submit flow, don't show expired refresh — the transaction is in progress.
  // After swap completes, onQuoteReset will restart the countdown.
  const isTransacting = approving || submitting;
  const effectiveShowExpiredRefresh = showExpiredRefresh && !isTransacting;

  const accordionContent = useMemo(() => {
    const items: ReactElement[] = [];
    if (Number(amountValue) <= 0) {
      return items;
    }

    if (isPendleLikeLayout) {
      return pendleAccordionItems;
    }

    if (transactionConfirmation?.receive) {
      items.push(
        <CalculationListItem key="receive">
          <CalculationListItem.Label
            size={transactionConfirmation.receive.title.size || '$bodyMd'}
            color={transactionConfirmation.receive.title.color}
            tooltip={
              transactionConfirmation.receive.tooltip?.type === 'text'
                ? transactionConfirmation.receive.tooltip.data?.title?.text
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
          key="network-fee"
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
          key="btc-fee-rate-input"
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
    isPendleLikeLayout,
    onFeeRateChange,
    pendleAccordionItems,
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
    if (effectiveShowExpiredRefresh) {
      return intl.formatMessage({ id: ETranslations.global_refresh });
    }
    if (!useApprove) {
      return intl.formatMessage({
        id: isPendleProvider
          ? ETranslations.global_swap
          : ETranslations.global_continue,
      });
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
    return intl.formatMessage({
      id: isPendleProvider
        ? ETranslations.global_swap
        : ETranslations.earn_deposit,
    });
  }, [
    effectiveShowExpiredRefresh,
    useApprove,
    shouldApprove,
    intl,
    usePermit2Approve,
    amountValue,
    tokenInfo?.token.symbol,
    isPendleProvider,
  ]);

  const confirmOnPress = useMemo(() => {
    if (effectiveShowExpiredRefresh) return handleLocalRefreshQuote;
    if (shouldApprove) return onApprove;
    return onSubmit;
  }, [
    effectiveShowExpiredRefresh,
    shouldApprove,
    handleLocalRefreshQuote,
    onApprove,
    onSubmit,
  ]);

  const footerContent = (
    <YStack bg="$bgApp" gap="$5">
      {isShowStakeProgress ? (
        <Stack>
          <StakeProgress
            approveType={approveType}
            currentStep={
              isDisable || shouldApprove
                ? EStakeProgressStep.approve
                : EStakeProgressStep.deposit
            }
            step2LabelId={
              isPendleProvider ? ETranslations.global_swap : undefined
            }
          />
        </Stack>
      ) : null}
      <Page.FooterActions
        p={0}
        onConfirmText={onConfirmText}
        buttonContainerProps={{
          $gtMd: {
            ml: '0',
          },
          w: '100%',
        }}
        confirmButtonProps={{
          onPress: confirmOnPress,
          loading: effectiveShowExpiredRefresh
            ? quoteRefreshing
            : loadingAllowance || approving || submitting || checkAmountLoading,
          disabled: effectiveShowExpiredRefresh ? false : isDisable,
          w: '100%',
        }}
      />
    </YStack>
  );

  const summaryContent = useMemo(() => {
    if (!hasSummarySection) return null;
    if (usePendleSummaryLayout) {
      return (
        <PendleSummarySection
          rewardRows={pendleRewardRows}
          tipText={pendleTipText}
          loading={quoteLoading}
        />
      );
    }
    return (
      <YStack gap="$2">
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
            <EarnTooltip
              title={transactionConfirmation?.title?.text}
              tooltip={transactionConfirmation?.tooltip}
            />
          ) : null}
        </XStack>
        {transactionConfirmation?.rewards?.map((reward) => {
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
                    <EarnTooltip
                      title={reward.title.text}
                      tooltip={reward.tooltip}
                    />
                  ) : null}
                </XStack>
              </XStack>
            </XStack>
          );
        })}
      </YStack>
    );
  }, [
    hasSummarySection,
    usePendleSummaryLayout,
    pendleRewardRows,
    pendleTipText,
    transactionConfirmation,
    quoteLoading,
  ]);

  const shouldShowSummaryCard = shouldShowStakingSummaryCard({
    isDisabled,
    isPendleProvider,
    amountValue,
    hasSummarySection,
    showPendleTransactionSection,
  });

  return (
    <StakingFormWrapper>
      <Stack position="relative">
        <YStack gap="$2">
          <Stack position="relative" opacity={amountInputDisabled ? 0.7 : 1}>
            <StakingAmountInput
              title={
                inputTitle ||
                intl.formatMessage({ id: ETranslations.earn_deposit })
              }
              disabled={amountInputDisabled}
              hasError={isInsufficientBalance || isCheckAmountMessageError}
              value={amountValue}
              onChange={onChangeAmountValue}
              onBlur={onBlurAmountValue}
              tokenSelectorTriggerProps={{
                selectedTokenImageUri: tokenImageUri,
                selectedTokenSymbol: tokenSymbol?.toUpperCase(),
                selectedNetworkImageUri: network?.logoURI,
                ...tokenSelectorTriggerProps,
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
          <ManagePageV2ReceiveInput
            receive={transactionConfirmation?.receive}
            config={effectiveReceiveInputConfig}
            fiatSymbol={symbol}
            payFiatValue={currentValue}
            loading={quoteLoading}
          />
        </YStack>
        {showReceiveInput ? (
          <Stack
            ai="center"
            position="absolute"
            top="50%"
            left="50%"
            zIndex={2}
            pointerEvents="none"
            style={receiveArrowOverlayStyle}
          >
            <IconButton
              alignSelf="center"
              bg="$bgApp"
              variant="tertiary"
              icon="ArrowBottomOutline"
              iconProps={{
                color: '$icon',
              }}
              size="small"
              disabled
              opacity={1}
            />
          </Stack>
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

      {shouldShowSummaryCard ? (
        <YStack
          p="$3.5"
          pt={hasSummarySection ? '$5' : '$3.5'}
          borderRadius="$3"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
        >
          {showApyHeader && apyDetail ? (
            <XStack gap="$1" ai="center" mb="$3.5">
              <EarnText
                text={apyDetail.description}
                size="$headingLg"
                color="$textSuccess"
              />
              <EarnActionIcon
                title={apyDetail.title.text}
                actionIcon={apyDetail.button}
              />
            </XStack>
          ) : null}
          {summaryContent}
          {hasSummarySection ? <Divider my="$5" /> : null}
          <YStack gap="$5">
            {ongoingValidator ? (
              <EarnValidatorSelect
                field={ongoingValidator}
                value={selectedValidator}
                onChange={setSelectedValidator}
                disabled={amountInputDisabled}
              />
            ) : null}
            {showPendleTransactionSection ? (
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
                    cursor={
                      isAccordionTriggerDisabled ? 'not-allowed' : 'pointer'
                    }
                    disabled={isAccordionTriggerDisabled}
                  >
                    {({ open }: { open: boolean }) => (
                      <>
                        {isPendleLikeLayout ? (
                          <PendleAccordionTriggerContent
                            open={open}
                            triggerText={transactionDetailsTriggerText?.text}
                            isDisabled={isAccordionTriggerDisabled}
                          />
                        ) : (
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
                            <YStack
                              animation="quick"
                              rotate={
                                open && !isAccordionTriggerDisabled
                                  ? '180deg'
                                  : '0deg'
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
                          </>
                        )}
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
            ) : null}
            {isPendleProvider ? null : (
              <TradeOrBuy
                token={tokenInfo?.token as IToken}
                accountId={accountId}
                networkId={networkId}
                containerStyle={{
                  pt: '$0',
                }}
              />
            )}
          </YStack>
        </YStack>
      ) : null}
      {beforeFooter}
      {isInModalContext ? (
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
                  step2LabelId={
                    isPendleProvider ? ETranslations.global_swap : undefined
                  }
                />
              ) : null}
            </Stack>

            <Page.FooterActions
              onConfirmText={onConfirmText}
              confirmButtonProps={{
                onPress: confirmOnPress,
                loading: effectiveShowExpiredRefresh
                  ? quoteRefreshing
                  : loadingAllowance ||
                    approving ||
                    submitting ||
                    checkAmountLoading,
                disabled: effectiveShowExpiredRefresh ? false : isDisable,
              }}
            />
          </Stack>
          <PercentageStageOnKeyboard
            onSelectPercentageStage={onSelectPercentageStage}
          />
        </Page.Footer>
      ) : (
        <YStack>{footerContent}</YStack>
      )}
    </StakingFormWrapper>
  );
}
