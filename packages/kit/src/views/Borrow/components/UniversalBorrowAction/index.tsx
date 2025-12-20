import type { PropsWithChildren, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isNaN as isNaNValue } from 'lodash';
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
import { BtcFeeRateInput } from '@onekeyhq/kit/src/views/Staking/components/BtcFeeRateInput';
import { CalculationListItem } from '@onekeyhq/kit/src/views/Staking/components/CalculationList';
import {
  EstimateNetworkFee,
  useShowStakeEstimateGasAlert,
} from '@onekeyhq/kit/src/views/Staking/components/EstimateNetworkFee';
import { EarnActionIcon } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnActionIcon';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { EarnValidatorSelect } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnValidatorSelect';
import {
  EStakeProgressStep,
  StakeProgress,
} from '@onekeyhq/kit/src/views/Staking/components/StakeProgress';
import {
  StakingAmountInput,
  useOnBlurAmountValue,
} from '@onekeyhq/kit/src/views/Staking/components/StakingAmountInput';
import StakingFormWrapper from '@onekeyhq/kit/src/views/Staking/components/StakingFormWrapper';
import { TradeOrBuy } from '@onekeyhq/kit/src/views/Staking/components/TradeOrBuy';
import { formatStakingDistanceToNowStrict } from '@onekeyhq/kit/src/views/Staking/components/utils';
import { useBorrowApiParams } from '@onekeyhq/kit/src/views/Staking/hooks/useBorrowApiParams';
import { useEarnPermitApprove } from '@onekeyhq/kit/src/views/Staking/hooks/useEarnPermitApprove';
import { useEarnSignMessageWithoutVerify } from '@onekeyhq/kit/src/views/Staking/hooks/useEarnSignMessageWithoutVerify';
import { useTrackTokenAllowance } from '@onekeyhq/kit/src/views/Staking/hooks/useUtilsHooks';
import {
  capitalizeString,
  countDecimalPlaces,
} from '@onekeyhq/kit/src/views/Staking/utils/utils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import type { IFeeUTXO } from '@onekeyhq/shared/types/fee';
import type {
  IApproveConfirmFnParams,
  IBorrowTransactionConfirmation,
  ICheckAmountAlert,
  IEarnEstimateFeeResp,
  IEarnPermit2ApproveSignData,
  IEarnSelectField,
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

import type { FontSizeTokens } from 'tamagui';

const buildBorrowTxConfirmationAsStake = (
  tx: IBorrowTransactionConfirmation,
): IStakeTransactionConfirmation => {
  const emptyText = { text: '' };
  const rewards = [
    tx.healthFactor
      ? {
          title: tx.healthFactor.title,
          description: tx.healthFactor.description,
        }
      : undefined,
    tx.refundableFee
      ? {
          title: tx.refundableFee.title,
          description: tx.refundableFee.description,
          tooltip: tx.refundableFee.tooltip,
        }
      : undefined,
    tx.liquidationAt
      ? {
          title: tx.liquidationAt.title,
          description: tx.liquidationAt.description,
        }
      : undefined,
  ].filter((item): item is IStakeTransactionConfirmation['rewards'][number] =>
    Boolean(item),
  );

  return {
    title: emptyText,
    rewards,
    receive: {
      title: emptyText,
      description: emptyText,
      tooltip: {
        type: 'text',
        data: {
          title: emptyText,
        },
      },
    },
  };
};

type IUniversalBorrowActionApproveTarget = {
  accountId: string;
  networkId: string;
  spenderAddress: string;
  token?: IToken;
};

export type IBorrowWithdrawConfirmParams = {
  amount: string;
  withdrawAll: boolean;
  // Stakefish: signature and message for withdraw all
  signature?: string;
  message?: string;
};

export type IUniversalBorrowActionPrimaryProps = {
  action: 'supply' | 'borrow';
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
  approveTarget: IUniversalBorrowActionApproveTarget;
  beforeFooter?: ReactElement | null;
  showApyDetail?: boolean;
  isInModalContext?: boolean;
  ongoingValidator?: IEarnSelectField;

  useBorrowApi?: boolean;
  borrowMarketAddress?: string;
  borrowReserveAddress?: string;
};

export type IUniversalBorrowActionSecondaryProps = {
  action: 'withdraw' | 'repay';
  accountAddress: string;
  balance: string;
  price: string;

  accountId?: string;
  networkId?: string;

  providerLogo?: string;
  providerName?: string;

  decimals?: number;

  initialAmount?: string;
  tokenImageUri?: string;
  tokenSymbol?: string;

  minAmount?: string;

  estimateFeeResp?: IEarnEstimateFeeResp;

  protocolVault?: string;

  identity?: string;

  isDisabled?: boolean;

  onConfirm?: (params: IBorrowWithdrawConfirmParams) => Promise<void>;
  beforeFooter?: ReactElement | null;
  showApyDetail?: boolean;
  isInModalContext?: boolean;

  useBorrowApi?: boolean;
  borrowMarketAddress?: string;
  borrowReserveAddress?: string;
};

export type IUniversalBorrowActionProps =
  | IUniversalBorrowActionPrimaryProps
  | IUniversalBorrowActionSecondaryProps;

function UniversalBorrowActionPrimaryContent({
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
  useBorrowApi = false,
  borrowMarketAddress,
  borrowReserveAddress,
  action,
}: PropsWithChildren<IUniversalBorrowActionPrimaryProps>) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
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

  const borrowApiCtx = useBorrowApiParams({
    useBorrowApi,
    networkId,
    provider: providerName,
    marketAddress: borrowMarketAddress,
    reserveAddress: borrowReserveAddress,
    accountId,
    action,
  });
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
      if (borrowApiCtx.isBorrow) {
        const resp =
          await backgroundApiProxy.serviceStaking.getBorrowTransactionConfirmation(
            {
              ...borrowApiCtx.borrowApiParams,
              amount,
            },
          );
        return buildBorrowTxConfirmationAsStake(resp);
      }
      const resp =
        await backgroundApiProxy.serviceStaking.getTransactionConfirmation({
          networkId,
          provider: providerName,
          symbol: tokenInfo?.token.symbol || '',
          vault: useVaultProvider ? protocolInfo?.vault || '' : '',
          accountAddress: protocolInfo?.earnAccount?.accountAddress || '',
          action: ECheckAmountActionType.STAKING,
          amount,
          identity: stakefishIdentity,
        });
      return resp;
    },
    [
      isDisabled,
      borrowApiCtx,
      networkId,
      providerName,
      tokenInfo?.token.symbol,
      useVaultProvider,
      protocolInfo?.vault,
      protocolInfo?.earnAccount?.accountAddress,
      stakefishIdentity,
    ],
  );

  const debouncedFetchTransactionConfirmation = useDebouncedCallback(
    async (amount?: string) => {
      const resp = await fetchTransactionConfirmation(amount || '0');
      // FIXME
      setTransactionConfirmation(undefined);
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

      if (borrowApiCtx.isBorrow && !shouldApprove) {
        const resp =
          await backgroundApiProxy.serviceStaking.getBorrowEstimateFee({
            ...borrowApiCtx.borrowApiParams,
            amount: amountNumber.toFixed(),
          });
        return resp;
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
      borrowApiCtx,
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
    stakefishIdentity,
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

  const checkAmount = useDebouncedCallback(
    async ({ amount, identity }: { amount: string; identity?: string }) => {
      if (isNaNValue(amount)) {
        return;
      }
      setCheckAmountLoading(true);
      try {
        if (borrowApiCtx.isBorrow) {
          const response =
            await backgroundApiProxy.serviceStaking.getBorrowCheckAmount({
              ...borrowApiCtx.borrowApiParams,
              amount,
            });

          if (Number(response.code) === 0) {
            setCheckoutAmountMessage('');
            setCheckAmountAlerts(response.data?.alerts || []);
          } else {
            setCheckoutAmountMessage(response.message);
            setCheckAmountAlerts([]);
          }
          return;
        }

        const response = await backgroundApiProxy.serviceStaking.checkAmount({
          accountId,
          networkId,
          symbol: tokenSymbol,
          provider: providerName,
          action: identity
            ? ECheckAmountActionType.RESTAKE
            : ECheckAmountActionType.STAKING,
          amount,
          protocolVault,
          withdrawAll: false,
          identity,
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
      if (isOverflowDecimals) {
        // setAmountValue((oldValue) => oldValue);
      } else {
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
    const minFeeBN = new BigNumber(minTransactionFee || '0');
    const remainBN = balanceBN.minus(minFeeBN);
    const maxAmountBN = remainBN.gt(0) ? remainBN : balanceBN;
    const formattedMaxAmount =
      typeof decimals === 'number'
        ? maxAmountBN.toFixed(decimals, BigNumber.ROUND_DOWN)
        : maxAmountBN.toFixed();
    onChangeAmountValue(formattedMaxAmount);
  }, [onChangeAmountValue, balance, minTransactionFee, decimals]);

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
          ...permitSignatureParams,
          ...stakefishParams,
        });
        resetAmount();
      } finally {
        setSubmitting(false);
      }
    };

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
    isStakefishProvider,
    selectedValidator,
    isStakefishCreateNewValidator,
    signPersonalMessage,
    networkId,
    accountId,
    tokenSymbol,
    providerName,
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

    if (transactionConfirmation?.receive?.title?.text) {
      items.push(
        <CalculationListItem key="receive">
          <CalculationListItem.Label
            size={transactionConfirmation.receive.title.size || '$bodyMd'}
            color={transactionConfirmation.receive.title.color}
            tooltip={
              transactionConfirmation.receive.tooltip.type === 'text'
                ? transactionConfirmation.receive.tooltip?.data?.title?.text
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
          onPress: shouldApprove ? onApprove : onSubmit,
          loading:
            loadingAllowance || approving || submitting || checkAmountLoading,
          disabled: isDisable,
          w: '100%',
        }}
      />
    </YStack>
  );

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
                return (
                  <YStack>
                    <EarnText text={alert?.title} size="$bodyMdMedium" />
                    <EarnText text={alert.text} size="$bodyMdMedium" />
                    <EarnText text={alert?.description} size="$bodyMdMedium" />
                  </YStack>
                );
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

      {!isDisabled ? (
        <YStack
          p="$3.5"
          pt="$5"
          borderRadius="$3"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
        >
          {showApyDetail && transactionConfirmation?.apyDetail ? (
            <XStack gap="$1" ai="center" mb="$3.5">
              <EarnText
                text={transactionConfirmation.apyDetail.description}
                size="$headingLg"
                color="$textSuccess"
              />
              <EarnActionIcon
                title={transactionConfirmation.apyDetail.title.text}
                actionIcon={transactionConfirmation.apyDetail.button}
              />
            </XStack>
          ) : null}
          <YStack gap="$2">
            {transactionConfirmation?.title?.text ? (
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
                              ? transactionConfirmation?.tooltip?.data
                                  ?.description
                              : undefined
                          }
                          size="$bodyMd"
                        />
                      </Stack>
                    }
                  />
                ) : null}
              </XStack>
            ) : null}
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
                            (reward.tooltip as IEarnTextTooltip)?.data
                              ?.description?.text
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
          <Divider my="$5" />
          <YStack gap="$5">
            {ongoingValidator ? (
              <EarnValidatorSelect
                field={ongoingValidator}
                value={selectedValidator}
                onChange={setSelectedValidator}
                disabled={amountInputDisabled}
              />
            ) : null}
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
              containerStyle={{
                pt: '$0',
              }}
            />
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
                />
              ) : null}
            </Stack>

            <Page.FooterActions
              onConfirmText={onConfirmText}
              confirmButtonProps={{
                onPress: shouldApprove ? onApprove : onSubmit,
                loading:
                  loadingAllowance ||
                  approving ||
                  submitting ||
                  checkAmountLoading,
                disabled: isDisable,
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

const isWithdrawAmountInvalid = (num: string) =>
  BigNumber(num).isNaN() || (typeof num === 'string' && num.endsWith('.'));

const WITHDRAW_ACCORDION_KEY = 'withdraw-accordion-content';

function UniversalBorrowActionSecondaryContent({
  accountAddress,
  balance,
  price: inputPrice,
  accountId,
  networkId,
  tokenImageUri,
  tokenSymbol,
  providerLogo,
  providerName,
  initialAmount,
  minAmount = '0',
  decimals,
  protocolVault,
  identity,
  isDisabled,
  useBorrowApi = false,
  borrowMarketAddress,
  borrowReserveAddress,
  action,

  onConfirm,
  beforeFooter,
  showApyDetail = false,
  isInModalContext = false,
}: PropsWithChildren<IUniversalBorrowActionSecondaryProps>) {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const { handleOpenWebSite } = useBrowserAction().current;
  const price = Number(inputPrice) > 0 ? inputPrice : '0';
  const [loading, setLoading] = useState<boolean>(false);
  const withdrawAllRef = useRef(false);
  const [amountValue, setAmountValue] = useState(initialAmount ?? '');

  // Sign message hook and refs for withdraw all signature
  const signPersonalMessage = useEarnSignMessageWithoutVerify();
  const withdrawSignatureRef = useRef<string | undefined>(undefined);
  const withdrawMessageRef = useRef<string | undefined>(undefined);
  // Only Stakefish ETH needs signature for withdraw all
  const isStakefishEthWithdraw = useMemo(
    () =>
      earnUtils.isStakefishProvider({ providerName: providerName ?? '' }) &&
      tokenSymbol?.toUpperCase() === 'ETH',
    [providerName, tokenSymbol],
  );
  const [checkAmountMessage, setCheckoutAmountMessage] = useState('');
  const [checkAmountAlerts, setCheckAmountAlerts] = useState<
    ICheckAmountAlert[]
  >([]);

  const borrowApiCtx = useBorrowApiParams({
    useBorrowApi,
    networkId,
    provider: providerName,
    marketAddress: borrowMarketAddress,
    reserveAddress: borrowReserveAddress,
    accountId,
    action,
  });

  const { result: estimateFeeResp } = usePromiseResult(async () => {
    if (
      !accountId ||
      !networkId ||
      !providerName ||
      !tokenSymbol ||
      !BigNumber(amountValue).isGreaterThan(0)
    ) {
      return undefined;
    }

    if (earnUtils.isLidoProvider({ providerName })) {
      return undefined;
    }

    if (borrowApiCtx.isBorrow) {
      const amountNumber = BigNumber(amountValue || '0');
      const resp = await backgroundApiProxy.serviceStaking.getBorrowEstimateFee(
        {
          ...borrowApiCtx.borrowApiParams,
          amount: amountNumber.isNaN() ? '0' : amountNumber.toFixed(),
        },
      );
      return resp;
    }

    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId,
      networkId,
    });

    const resp = await backgroundApiProxy.serviceStaking.estimateFee({
      networkId,
      provider: providerName,
      symbol: tokenSymbol,
      action: 'unstake',
      amount: amountValue || balance || '1',
      txId: earnUtils.isBabylonProvider({ providerName })
        ? identity
        : undefined,
      protocolVault: earnUtils.isVaultBasedProvider({
        providerName,
      })
        ? protocolVault
        : undefined,
      identity,
      accountAddress: account.address,
      withdrawAll: withdrawAllRef.current,
    });
    return resp;
  }, [
    amountValue,
    accountId,
    borrowApiCtx,
    networkId,
    providerName,
    tokenSymbol,
    identity,
    protocolVault,
    balance,
  ]);

  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();

  const intl = useIntl();

  const network = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getNetwork({
        networkId,
      }),
    [networkId],
  ).result;

  const resetAmount = useCallback(() => {
    setAmountValue('');
    setCheckoutAmountMessage('');
    setCheckAmountAlerts([]);
    withdrawAllRef.current = false;
    // Reset withdraw signature and message
    withdrawSignatureRef.current = undefined;
    withdrawMessageRef.current = undefined;
  }, []);

  const onPress = useCallback(async () => {
    try {
      Keyboard.dismiss();
      setLoading(true);

      // Get signature for withdraw all (Stakefish ETH)
      if (
        isStakefishEthWithdraw &&
        withdrawAllRef.current &&
        !withdrawSignatureRef.current
      ) {
        try {
          const { signature, message } = await signPersonalMessage({
            networkId: networkId || '',
            accountId: accountId || '',
            provider: providerName || '',
            symbol: tokenSymbol || '',
            action: 'unstake',
            identity,
          });
          withdrawSignatureRef.current = signature;
          withdrawMessageRef.current = message;
        } catch (error) {
          console.error('Stakefish withdraw sign error:', error);
          setLoading(false);
          return;
        }
      }

      await onConfirm?.({
        amount: amountValue,
        withdrawAll: withdrawAllRef.current,
        signature: withdrawSignatureRef.current,
        message: withdrawMessageRef.current,
      });
      resetAmount();
    } finally {
      setLoading(false);
    }
  }, [
    amountValue,
    onConfirm,
    resetAmount,
    isStakefishEthWithdraw,
    signPersonalMessage,
    networkId,
    accountId,
    providerName,
    tokenSymbol,
    identity,
  ]);

  const [checkAmountLoading, setCheckAmountLoading] = useState(false);
  const checkAmount = useDebouncedCallback(async (amount: string) => {
    if (isWithdrawAmountInvalid(amount)) {
      return;
    }
    setCheckAmountLoading(true);
    try {
      if (borrowApiCtx.isBorrow) {
        const response =
          await backgroundApiProxy.serviceStaking.getBorrowCheckAmount({
            ...borrowApiCtx.borrowApiParams,
            amount,
          });

        if (Number(response.code) === 0) {
          setCheckoutAmountMessage('');
          setCheckAmountAlerts(response.data?.alerts || []);
        } else {
          setCheckoutAmountMessage(response.message);
          setCheckAmountAlerts([]);
        }
        return;
      }

      const response = await backgroundApiProxy.serviceStaking.checkAmount({
        accountId,
        networkId,
        symbol: tokenSymbol,
        provider: providerName,
        action: ECheckAmountActionType.UNSTAKING,
        amount,
        protocolVault,
        withdrawAll: withdrawAllRef.current,
        identity,
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

  const [transactionConfirmation, setTransactionConfirmation] = useState<
    IStakeTransactionConfirmation | undefined
  >();
  const fetchTransactionConfirmation = useCallback(
    async (amount: string) => {
      if (isDisabled) {
        return undefined;
      }

      if (borrowApiCtx.isBorrow) {
        const resp =
          await backgroundApiProxy.serviceStaking.getBorrowTransactionConfirmation(
            {
              ...borrowApiCtx.borrowApiParams,
              amount,
            },
          );
        return buildBorrowTxConfirmationAsStake(resp);
      }

      const resp =
        await backgroundApiProxy.serviceStaking.getTransactionConfirmation({
          networkId: networkId || '',
          provider: providerName || '',
          symbol: tokenSymbol || '',
          vault: earnUtils.isVaultBasedProvider({
            providerName: providerName ?? '',
          })
            ? protocolVault || ''
            : '',
          accountAddress,
          action: ECheckAmountActionType.UNSTAKING,
          amount,
          identity,
        });
      return resp;
    },
    [
      isDisabled,
      borrowApiCtx,
      accountAddress,
      protocolVault,
      networkId,
      providerName,
      tokenSymbol,
      identity,
    ],
  );

  const debouncedFetchTransactionConfirmation = useDebouncedCallback(
    async (amount?: string) => {
      const resp = await fetchTransactionConfirmation(amount || '0');
      // FIXME
      setTransactionConfirmation(undefined);
    },
    350,
  );

  useEffect(() => {
    void debouncedFetchTransactionConfirmation(amountValue);
  }, [amountValue, debouncedFetchTransactionConfirmation]);

  const onChangeAmountValue = useCallback(
    (value: string, isMax = false) => {
      if (!validateAmountInputForStaking(value, decimals)) {
        return;
      }
      const valueBN = new BigNumber(value);
      if (valueBN.isNaN()) {
        if (value === '') {
          setCheckoutAmountMessage('');
          setCheckAmountAlerts([]);
          setAmountValue('');
        }
        return;
      }
      const isOverflowDecimals = Boolean(
        decimals &&
          Number(decimals) > 0 &&
          countDecimalPlaces(value) > decimals,
      );
      if (isOverflowDecimals) {
        setAmountValue((oldValue) => oldValue);
      } else {
        setAmountValue(value);
      }
      withdrawAllRef.current = !!isMax;
      void checkAmount(value);
    },
    [checkAmount, decimals],
  );

  const currentValue = useMemo<string | undefined>(() => {
    if (Number(amountValue) > 0 && Number(price) > 0) {
      return BigNumber(amountValue).multipliedBy(price).toFixed();
    }
    return undefined;
  }, [amountValue, price]);

  const remainingLessThanMinAmountWarning = useMemo<boolean>(() => {
    if (Number(minAmount) > 0) {
      const minAmountBN = new BigNumber(Number(minAmount));
      const amountValueBN = new BigNumber(amountValue);
      const balanceBN = new BigNumber(balance);
      if (minAmountBN.gt(0) && amountValueBN.gt(0) && balanceBN.gte(0)) {
        return (
          amountValueBN.gt(0) &&
          amountValueBN.gte(minAmountBN) &&
          balanceBN.minus(amountValueBN).gt(0) &&
          balanceBN.minus(amountValueBN).lt(minAmountBN)
        );
      }
    }
    return false;
  }, [amountValue, balance, minAmount]);

  const onBlurAmountValue = useOnBlurAmountValue(amountValue, setAmountValue);

  const onMax = useCallback(() => {
    const formattedMaxAmount =
      typeof decimals === 'number'
        ? new BigNumber(balance).toFixed(decimals, BigNumber.ROUND_DOWN)
        : balance;
    onChangeAmountValue(formattedMaxAmount, true);
  }, [onChangeAmountValue, balance, decimals]);

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

  const isCheckAmountMessageError =
    amountValue?.length > 0 && !!checkAmountMessage;

  const isDisable = useMemo<boolean>(
    () =>
      isDisabled ||
      isWithdrawAmountInvalid(amountValue) ||
      BigNumber(amountValue).isLessThanOrEqualTo(0) ||
      isCheckAmountMessageError ||
      checkAmountAlerts.length > 0 ||
      checkAmountLoading,
    [
      isDisabled,
      amountValue,
      isCheckAmountMessageError,
      checkAmountAlerts.length,
      checkAmountLoading,
    ],
  );

  const amountInputDisabled = useMemo(() => {
    return isDisabled || initialAmount !== undefined;
  }, [isDisabled, initialAmount]);

  const accordionContent = useMemo(() => {
    const items: ReactElement[] = [];
    if (Number(amountValue) <= 0) {
      return items;
    }
    if (transactionConfirmation?.receive?.title?.text) {
      items.push(
        <CalculationListItem>
          <CalculationListItem.Label
            size={transactionConfirmation.receive.title.size || '$bodyMd'}
            color={transactionConfirmation.receive.title.color}
            tooltip={
              transactionConfirmation.receive.tooltip.type === 'text'
                ? transactionConfirmation.receive.tooltip?.data?.title?.text
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
          estimateFeeResp={estimateFeeResp}
          isVisible={Number(amountValue) > 0}
        />,
      );
    }
    return items;
  }, [amountValue, estimateFeeResp, transactionConfirmation?.receive]);
  const isAccordionTriggerDisabled = !amountValue;

  return (
    <StakingFormWrapper>
      <Stack position="relative" opacity={amountInputDisabled ? 0.7 : 1}>
        <StakingAmountInput
          title={intl.formatMessage({ id: ETranslations.global_withdraw })}
          disabled={amountInputDisabled}
          hasError={isCheckAmountMessageError}
          value={amountValue}
          onChange={onChangeAmountValue}
          onBlur={onBlurAmountValue}
          tokenSelectorTriggerProps={{
            selectedTokenImageUri: tokenImageUri,
            selectedTokenSymbol: tokenSymbol,
            selectedNetworkImageUri: network?.logoURI,
          }}
          inputProps={{
            placeholder: '0',
            autoFocus: !amountInputDisabled,
          }}
          balanceProps={{
            value: balance,
            iconText: intl.formatMessage({ id: ETranslations.global_withdraw }),
            onPress: onMax,
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

      {remainingLessThanMinAmountWarning ? (
        <Alert
          icon="InfoCircleOutline"
          type="warning"
          title={intl.formatMessage(
            { id: ETranslations.earn_unstake_all_due_to_min_withdrawal },
            { number: minAmount, symbol: tokenSymbol },
          )}
        />
      ) : null}
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
                return (
                  <YStack>
                    <EarnText text={alert?.title} size="$bodyMdMedium" />
                    <EarnText text={alert.text} size="$bodyMdMedium" />
                    <EarnText text={alert?.description} size="$bodyMdMedium" />
                  </YStack>
                );
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
      {!isDisabled ? (
        <YStack
          p="$3.5"
          pt="$5"
          borderRadius="$3"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
        >
          {showApyDetail && transactionConfirmation?.apyDetail ? (
            <XStack gap="$1" ai="center" mb="$3.5">
              <EarnText
                text={transactionConfirmation.apyDetail.description}
                size="$headingLg"
                color="$textSuccess"
              />
              <EarnActionIcon
                title={transactionConfirmation.apyDetail.title.text}
                actionIcon={transactionConfirmation.apyDetail.button}
              />
            </XStack>
          ) : null}
          <YStack gap="$2">
            {transactionConfirmation?.title?.text ? (
              <XStack ai="center" gap="$1">
                <EarnText
                  text={transactionConfirmation?.title}
                  color="$textSubdued"
                  size="$bodyMd"
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
                              ? transactionConfirmation.tooltip?.data
                                  ?.description
                              : undefined
                          }
                          size="$bodyMd"
                        />
                      </Stack>
                    }
                  />
                ) : null}
              </XStack>
            ) : null}
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
                            (reward.tooltip as IEarnTextTooltip)?.data
                              ?.description?.text
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
          <Divider my="$5" />
          <Accordion
            overflow="hidden"
            width="100%"
            type="single"
            collapsible
            defaultValue={WITHDRAW_ACCORDION_KEY}
          >
            <Accordion.Item value={WITHDRAW_ACCORDION_KEY}>
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
        </YStack>
      ) : null}
      {beforeFooter}
      {isInModalContext ? (
        <Page.Footer>
          <Page.FooterActions
            onConfirmText={intl.formatMessage({
              id: ETranslations.global_withdraw,
            })}
            confirmButtonProps={{
              onPress,
              loading: loading || checkAmountLoading,
              disabled: isDisable,
            }}
          />
          <PercentageStageOnKeyboard
            onSelectPercentageStage={onSelectPercentageStage}
          />
        </Page.Footer>
      ) : (
        <YStack>
          <Page.FooterActions
            p={0}
            onConfirmText={intl.formatMessage({
              id: ETranslations.global_withdraw,
            })}
            buttonContainerProps={{
              $gtMd: {
                ml: '0',
              },
              w: '100%',
            }}
            confirmButtonProps={{
              onPress,
              loading: loading || checkAmountLoading,
              disabled: isDisable,
              w: '100%',
            }}
          />
        </YStack>
      )}
    </StakingFormWrapper>
  );
}

export function UniversalBorrowAction(props: IUniversalBorrowActionProps) {
  const { action } = props;
  if (action === 'withdraw' || action === 'repay') {
    return <UniversalBorrowActionSecondaryContent {...props} />;
  }

  return (
    <UniversalBorrowActionPrimaryContent
      {...(props as IUniversalBorrowActionPrimaryProps)}
    />
  );
}
