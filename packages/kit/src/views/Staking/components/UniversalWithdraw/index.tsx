import type { PropsWithChildren, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { Keyboard, StyleSheet } from 'react-native';
import { useDebouncedCallback } from 'use-debounce';

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
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
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
import { validateAmountInputForStaking } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import {
  EApproveType,
  ECheckAmountActionType,
  EStakingActionType,
} from '@onekeyhq/shared/types/staking';
import type {
  ICheckAmountAlert,
  IEarnEstimateFeeResp,
  IEarnText,
  IEarnTokenInfo,
  IEarnTransactionTip,
  IEarnWithdrawType,
  IProtocolInfo,
  IStakeTransactionConfirmation,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { useEarnSignMessageWithoutVerify } from '../../hooks/useEarnSignMessageWithoutVerify';
import { usePendleLayoutState } from '../../hooks/usePendleLayoutState';
import { useQuoteRefresh } from '../../hooks/useQuoteRefresh';
import { useTrackTokenAllowance } from '../../hooks/useUtilsHooks';
import { useHandleWithdraw } from '../../pages/ProtocolDetails/useHandleActions';
import {
  capitalizeString,
  countDecimalPlaces,
  isInvalidAmount,
  shouldShowStakingSummaryCard,
} from '../../utils/utils';
import { CalculationListItem } from '../CalculationList';
import { EstimateNetworkFee } from '../EstimateNetworkFee';
import {
  type IManagePageV2ReceiveInputConfig,
  ManagePageV2ReceiveInput,
} from '../ManagePageV2ReceiveInput';
import { EarnActionIcon } from '../ProtocolDetails/EarnActionIcon';
import { EarnAmountText } from '../ProtocolDetails/EarnAmountText';
import { EarnText } from '../ProtocolDetails/EarnText';
import { EarnTooltip } from '../ProtocolDetails/EarnTooltip';
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

import type { FontSizeTokens } from 'tamagui';

type IUniversalWithdrawProps = {
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
  requestSymbol?: string;

  minAmount?: string;

  estimateFeeResp?: IEarnEstimateFeeResp;

  protocolVault?: string;

  identity?: string;

  isDisabled?: boolean;

  inputTitle?: string;

  onConfirm?: ({
    amount,
    withdrawAll,
    signature,
    message,
    effectiveApy,
    useEthenaCooldown,
    resumeEthenaCooldownUnstake,
    onStepChange,
    onEthenaCooldownUnstakeReady,
    withdrawType,
  }: {
    amount: string;
    withdrawAll: boolean;
    // Stakefish: signature and message for withdraw all
    signature?: string;
    message?: string;
    effectiveApy?: string | number;
    // Pendle: Ethena cooldown path vs instant swap
    useEthenaCooldown?: boolean;
    resumeEthenaCooldownUnstake?: boolean;
    // Pendle Ethena: step change callback for multi-step progress
    onStepChange?: (step: number) => void;
    onEthenaCooldownUnstakeReady?: () => void;
    withdrawType?: IEarnWithdrawType;
  }) => Promise<void>;
  beforeFooter?: ReactElement | null;
  showApyDetail?: boolean;
  isInModalContext?: boolean;
  receiveInputConfig?: IManagePageV2ReceiveInputConfig;
  transactionInputTokenAddress?: string;
  transactionOutputTokenAddress?: string;
  isQuoteExpired?: boolean;
  onQuoteReset?: () => void;
  refreshKey?: number;
  onQuoteRefreshingChange?: (loading: boolean) => void;
  approveTarget?: {
    accountId: string;
    networkId: string;
    spenderAddress: string;
    token?: IToken;
  };
  currentAllowance?: string;
  pendleSlippage?: number;
  initialWithdrawType?: IEarnWithdrawType;
  receiptTokenRate?: string;
  protocolInfo?: IProtocolInfo;
  tokenInfo?: IEarnTokenInfo;
};

const WITHDRAW_ACCORDION_KEY = 'withdraw-accordion-content';

type IWithdrawPathBox = {
  title: IEarnText;
  description: IEarnText;
  subtitle?: IEarnText;
  subtitleDescription?: IEarnText;
  withdrawType?: IEarnWithdrawType;
  disabled?: boolean;
  tip?: IEarnTransactionTip;
};

type IWithdrawPathDialogContentProps = {
  boxes: IWithdrawPathBox[];
  initialSelectedIndex: number;
  selectedIndexRef: {
    current: number;
  };
  onTipAction?: (tip: IEarnTransactionTip) => void | Promise<void>;
};

function WithdrawPathDialogContent({
  boxes,
  initialSelectedIndex,
  selectedIndexRef,
  onTipAction,
}: IWithdrawPathDialogContentProps) {
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);
  const handleSelect = useCallback(
    (index: number) => {
      selectedIndexRef.current = index;
      setSelectedIndex(index);
    },
    [selectedIndexRef],
  );

  return (
    <YStack>
      {boxes.map((box, index) => {
        const isSelected = index === selectedIndex;
        const isDisabled = !!box.disabled;
        const tipAction =
          box.tip?.button?.type === EStakingActionType.CancelWithdrawal
            ? {
                primary: box.tip.button.text.text,
                onPrimaryPress: () => {
                  if (box.tip) {
                    void onTipAction?.(box.tip);
                  }
                },
              }
            : undefined;
        return (
          <YStack key={index} gap="$2">
            <XStack
              py="$2.5"
              gap="$3"
              ai="center"
              userSelect="none"
              cursor={isDisabled ? 'not-allowed' : 'pointer'}
              opacity={isDisabled ? 0.5 : 1}
              onPress={() => {
                if (isDisabled) return;
                handleSelect(index);
              }}
            >
              <Stack
                w="$5"
                h="$5"
                my="$0.5"
                borderWidth="$0.5"
                borderColor={isSelected ? '$transparent' : '$borderStrong'}
                bg={isSelected ? '$bgPrimary' : '$transparent'}
                borderRadius="$full"
                ai="center"
                jc="center"
              >
                {isSelected ? (
                  <Stack
                    w="$2.5"
                    h="$2.5"
                    bg="$iconInverse"
                    borderRadius="$full"
                  />
                ) : null}
              </Stack>
              <YStack flex={1} gap="$1">
                <SizableText size="$bodyLgMedium" color="$text">
                  {box.title.text}
                </SizableText>
                {box.subtitle?.text ? (
                  <SizableText
                    size="$bodyMd"
                    color={box.subtitle?.color || '$textSubdued'}
                  >
                    {box.subtitle.text}
                  </SizableText>
                ) : null}
              </YStack>
              <YStack flex={1} gap="$1" ai="flex-end">
                <EarnAmountText size="$headingMd" color="$text">
                  {box.description.text}
                </EarnAmountText>
                {box.subtitleDescription?.text ? (
                  <SizableText
                    size="$bodyMd"
                    color={box.subtitleDescription?.color || '$textSubdued'}
                  >
                    {box.subtitleDescription.text}
                  </SizableText>
                ) : null}
              </YStack>
            </XStack>
            {box.tip?.text ? (
              <Alert
                icon="InfoCircleOutline"
                type="warning"
                renderTitle={() => (
                  <EarnText text={box.tip?.text} size="$bodyMdMedium" />
                )}
                action={tipAction}
              />
            ) : null}
          </YStack>
        );
      })}
    </YStack>
  );
}

export function UniversalWithdraw({
  accountAddress,
  balance,
  price: inputPrice,
  accountId,
  networkId,
  tokenImageUri,
  tokenSymbol,
  requestSymbol,
  providerLogo,
  providerName,
  initialAmount,
  minAmount = '0',
  decimals,
  protocolVault,
  identity,
  isDisabled,
  inputTitle,

  onConfirm,
  beforeFooter,
  showApyDetail = false,
  isInModalContext = false,
  receiveInputConfig,
  transactionInputTokenAddress,
  transactionOutputTokenAddress,
  isQuoteExpired,
  onQuoteReset,
  refreshKey,
  onQuoteRefreshingChange,
  approveTarget,
  currentAllowance = '0',
  pendleSlippage,
  initialWithdrawType,
  receiptTokenRate,
  protocolInfo,
  tokenInfo,
}: PropsWithChildren<IUniversalWithdrawProps>) {
  const navigation = useAppNavigation();
  const handleWithdrawAction = useHandleWithdraw();
  const { handleOpenWebSite } = useBrowserAction().current;
  const price = Number(inputPrice) > 0 ? inputPrice : '0';
  const [loading, setLoading] = useState<boolean>(false);
  const withdrawAllRef = useRef(false);
  const [isWithdrawAll, setIsWithdrawAll] = useState(false);
  const isCancelWithdrawal = initialWithdrawType === 'cancel';
  const [amountValue, setAmountValue] = useState(
    isCancelWithdrawal ? '0' : (initialAmount ?? ''),
  );
  const [selectedWithdrawPathIndex, setSelectedWithdrawPathIndex] = useState(0);
  const [withdrawProgressStep, setWithdrawProgressStep] = useState(
    EStakeProgressStep.approve,
  );
  // Keep the host page from re-entering the pre-approve state mid flow.
  const [ignoreAllowanceCheck, setIgnoreAllowanceCheck] = useState(false);
  const [pendingEthenaCooldownUnstake, setPendingEthenaCooldownUnstake] =
    useState(false);
  const ethenaCooldownCompletedRef = useRef(false);
  const [transactionConfirmation, setTransactionConfirmation] = useState<
    IStakeTransactionConfirmation | undefined
  >();

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
  const isPendleProvider = useMemo(
    () => earnUtils.isPendleProvider({ providerName: providerName ?? '' }),
    [providerName],
  );
  const isNativeProvider = useMemo(
    () => earnUtils.isNativeProvider({ providerName: providerName ?? '' }),
    [providerName],
  );
  const shouldSendProtocolVault = useMemo(
    () =>
      earnUtils.shouldSendEarnProtocolVault({
        providerName: providerName ?? '',
      }),
    [providerName],
  );

  const withdrawPathConfirmBoxes = useMemo(() => {
    if (!(isPendleProvider || isNativeProvider)) return [];
    return transactionConfirmation?.withdrawPath?.data?.confirmBoxes ?? [];
  }, [
    isPendleProvider,
    isNativeProvider,
    transactionConfirmation?.withdrawPath?.data?.confirmBoxes,
  ]);

  const effectiveSelectedWithdrawPathIndex = useMemo(() => {
    if (withdrawPathConfirmBoxes.length <= 1) return 0;
    return Math.min(
      Math.max(selectedWithdrawPathIndex, 0),
      withdrawPathConfirmBoxes.length - 1,
    );
  }, [selectedWithdrawPathIndex, withdrawPathConfirmBoxes.length]);

  useEffect(() => {
    if (selectedWithdrawPathIndex !== effectiveSelectedWithdrawPathIndex) {
      setSelectedWithdrawPathIndex(effectiveSelectedWithdrawPathIndex);
    }
  }, [effectiveSelectedWithdrawPathIndex, selectedWithdrawPathIndex]);

  const selectedWithdrawPath = useMemo(() => {
    if (!withdrawPathConfirmBoxes.length) return undefined;
    return (
      withdrawPathConfirmBoxes[effectiveSelectedWithdrawPathIndex] ??
      withdrawPathConfirmBoxes[0]
    );
  }, [withdrawPathConfirmBoxes, effectiveSelectedWithdrawPathIndex]);

  const selectedWithdrawType = useMemo<IEarnWithdrawType | undefined>(() => {
    if (isCancelWithdrawal) return 'cancel';
    return selectedWithdrawPath?.withdrawType;
  }, [isCancelWithdrawal, selectedWithdrawPath?.withdrawType]);

  const rootTransactionTip = useMemo(
    () =>
      transactionConfirmation?.withdrawPath?.data?.tip ??
      transactionConfirmation?.tip,
    [
      transactionConfirmation?.tip,
      transactionConfirmation?.withdrawPath?.data?.tip,
    ],
  );
  const formTransactionTip = useMemo(
    () => (selectedWithdrawPath?.tip ? undefined : rootTransactionTip),
    [rootTransactionTip, selectedWithdrawPath?.tip],
  );

  const isNativeQueuedWithdraw =
    isNativeProvider && selectedWithdrawType === 'queued';

  const handleTipAction = useCallback(
    async (tip?: IEarnTransactionTip) => {
      const button = tip?.button ?? formTransactionTip?.button;
      if (
        button?.type !== EStakingActionType.CancelWithdrawal ||
        !protocolInfo?.earnAccount?.accountId
      ) {
        return;
      }
      await handleWithdrawAction({
        withdrawType: EStakingActionType.CancelWithdrawal,
        protocolInfo,
        tokenInfo,
        accountId: protocolInfo.earnAccount.accountId,
        networkId: protocolInfo.networkId,
        symbol: protocolInfo.symbol,
        provider: protocolInfo.provider,
      });
    },
    [formTransactionTip?.button, handleWithdrawAction, protocolInfo, tokenInfo],
  );

  const approveAmountValue = useMemo(() => {
    if (!isNativeQueuedWithdraw || !receiptTokenRate) {
      return amountValue;
    }

    const amountBN = new BigNumber(amountValue);
    const receiptTokenRateBN = new BigNumber(receiptTokenRate);
    const approveTokenDecimals =
      approveTarget?.token?.decimals ?? decimals ?? 0;
    if (
      amountBN.isNaN() ||
      amountBN.lte(0) ||
      receiptTokenRateBN.isNaN() ||
      receiptTokenRateBN.lte(0)
    ) {
      return amountValue;
    }

    const roundingMode = isWithdrawAll
      ? BigNumber.ROUND_CEIL
      : BigNumber.ROUND_FLOOR;

    // For max queued withdrawals the server spends the full receipt-token
    // balance. The displayed underlying amount may be rounded down, so ceil the
    // approval by at most one smallest receipt unit to avoid under-approving.
    return amountBN
      .multipliedBy(receiptTokenRateBN)
      .integerValue(roundingMode)
      .shiftedBy(-approveTokenDecimals)
      .toFixed();
  }, [
    amountValue,
    approveTarget?.token?.decimals,
    decimals,
    isNativeQueuedWithdraw,
    isWithdrawAll,
    receiptTokenRate,
  ]);

  // --- Approve logic (Pendle sell and Native queued withdraw) ---
  const useApprove =
    (isPendleProvider || isNativeQueuedWithdraw) &&
    !!approveTarget?.spenderAddress;
  const [approving, setApproving] = useState(false);
  const allowanceAbortRef = useRef<AbortController | undefined>(undefined);

  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId: approveTarget?.accountId ?? '',
    networkId: approveTarget?.networkId ?? '',
  });

  const {
    allowance,
    loading: loadingAllowance,
    trackAllowance,
    fetchAllowanceResponse,
  } = useTrackTokenAllowance({
    accountId: approveTarget?.accountId ?? '',
    networkId: approveTarget?.networkId ?? '',
    tokenAddress: approveTarget?.token?.address ?? '',
    spenderAddress: approveTarget?.spenderAddress ?? '',
    initialValue: currentAllowance,
    approveType: EApproveType.Legacy,
  });

  const isFocus = useIsFocused();

  const needsApproval = useMemo(() => {
    if (!useApprove) return false;
    if (!isFocus) return true;
    const amountBN = new BigNumber(approveAmountValue);
    const allowanceBN = new BigNumber(allowance);
    return !amountBN.isNaN() && amountBN.gt(0) && allowanceBN.lt(amountBN);
  }, [useApprove, isFocus, approveAmountValue, allowance]);

  const shouldApprove = useMemo(
    () => needsApproval && !ignoreAllowanceCheck,
    [needsApproval, ignoreAllowanceCheck],
  );

  useEffect(
    () => () => {
      allowanceAbortRef.current?.abort();
    },
    [],
  );

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
      if (!useApprove || !requiredAmount) {
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
    [useApprove, fetchAllowanceResponse],
  );

  // Refs to break circular dependency: onApprove needs onPress/fetchTransactionConfirmation
  // which are defined later. Assigned after their useCallback declarations.
  const onPressRef = useRef<() => Promise<void>>(undefined);
  const fetchTransactionConfirmationRef =
    useRef<
      (amount: string) => Promise<IStakeTransactionConfirmation | undefined>
    >(undefined);

  const onApprove = useCallback(async () => {
    if (!approveTarget?.token || !approveAmountValue) return;
    Keyboard.dismiss();
    setApproving(true);

    let approveAllowance = allowance;
    try {
      const allowanceInfo = await fetchAllowanceResponse();
      approveAllowance = allowanceInfo.allowanceParsed;
    } catch (_e) {
      // use cached allowance
    }

    const allowanceBN = new BigNumber(approveAllowance);
    const amountBN = new BigNumber(approveAmountValue);
    if (!amountBN.isNaN() && allowanceBN.gte(amountBN)) {
      // Already approved
      setApproving(false);
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
          amount: approveAmountValue,
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
              requiredAmount: approveAmountValue,
              signal: abortController.signal,
            });
            if (!allowanceReady) {
              return;
            }
            await onPressRef.current?.();
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
    approveAmountValue,
    approveTarget,
    navigationToTxConfirm,
    fetchAllowanceResponse,
    trackAllowance,
    waitForAllowanceAfterApprove,
  ]);
  const actionSymbol = useMemo(
    () => requestSymbol || tokenSymbol || '',
    [requestSymbol, tokenSymbol],
  );
  const [checkAmountMessage, setCheckoutAmountMessage] = useState('');
  const [checkAmountAlerts, setCheckAmountAlerts] = useState<
    ICheckAmountAlert[]
  >([]);

  const { result: estimateFeeResp } = usePromiseResult(async () => {
    if (
      !accountId ||
      !networkId ||
      !providerName ||
      !actionSymbol ||
      (!isCancelWithdrawal && !BigNumber(amountValue).isGreaterThan(0))
    ) {
      return undefined;
    }

    if (earnUtils.isLidoProvider({ providerName })) {
      return undefined;
    }

    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId,
      networkId,
    });

    const resp = await backgroundApiProxy.serviceStaking.estimateFee({
      networkId,
      provider: providerName,
      symbol: actionSymbol,
      action: 'unstake',
      amount: isCancelWithdrawal ? '0' : amountValue || balance || '1',
      txId: earnUtils.isBabylonProvider({ providerName })
        ? identity
        : undefined,
      protocolVault: shouldSendProtocolVault ? protocolVault : undefined,
      identity,
      accountAddress: account.address,
      withdrawAll: withdrawAllRef.current,
      inputTokenAddress: transactionInputTokenAddress,
      outputTokenAddress: transactionOutputTokenAddress,
      withdrawType: selectedWithdrawType,
    });
    return resp;
  }, [
    amountValue,
    accountId,
    networkId,
    providerName,
    actionSymbol,
    identity,
    protocolVault,
    shouldSendProtocolVault,
    balance,
    transactionInputTokenAddress,
    transactionOutputTokenAddress,
    selectedWithdrawType,
    isCancelWithdrawal,
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
    setAmountValue(isCancelWithdrawal ? '0' : '');
    setCheckoutAmountMessage('');
    setCheckAmountAlerts([]);
    setIgnoreAllowanceCheck(false);
    setPendingEthenaCooldownUnstake(false);
    withdrawAllRef.current = false;
    setIsWithdrawAll(false);
    // Reset withdraw signature and message
    withdrawSignatureRef.current = undefined;
    withdrawMessageRef.current = undefined;
  }, [isCancelWithdrawal]);

  const handleSelectWithdrawPath = useCallback(
    (index: number) => {
      const targetBox = withdrawPathConfirmBoxes[index];
      if (!targetBox || targetBox.disabled) {
        return;
      }
      setIgnoreAllowanceCheck(false);
      setPendingEthenaCooldownUnstake(false);
      setWithdrawProgressStep(EStakeProgressStep.approve);
      setSelectedWithdrawPathIndex(index);
    },
    [withdrawPathConfirmBoxes],
  );

  const onPress = useCallback(async () => {
    try {
      Keyboard.dismiss();
      setLoading(true);
      ethenaCooldownCompletedRef.current = false;
      const shouldUseEthenaCooldown =
        isPendleProvider &&
        networkId === getNetworkIdsMap().eth &&
        withdrawPathConfirmBoxes.length > 1 &&
        effectiveSelectedWithdrawPathIndex === 0;
      const shouldResumeEthenaCooldownUnstake =
        shouldUseEthenaCooldown && pendingEthenaCooldownUnstake;

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
            symbol: actionSymbol || '',
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

      // Check high price impact (Pendle only)
      if (
        isPendleProvider &&
        !isCancelWithdrawal &&
        !shouldResumeEthenaCooldownUnstake
      ) {
        const payFiatValue =
          Number(amountValue) > 0 && Number(price) > 0
            ? new BigNumber(amountValue).multipliedBy(price).toFixed()
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

      await onConfirm?.({
        amount: isCancelWithdrawal ? '0' : amountValue,
        withdrawAll: withdrawAllRef.current,
        signature: withdrawSignatureRef.current,
        message: withdrawMessageRef.current,
        effectiveApy: transactionConfirmation?.effectiveApy,
        withdrawType: selectedWithdrawType,
        useEthenaCooldown: shouldUseEthenaCooldown ? true : undefined,
        resumeEthenaCooldownUnstake: shouldResumeEthenaCooldownUnstake
          ? true
          : undefined,
        onStepChange: (step: number) => {
          setIgnoreAllowanceCheck(true);
          setWithdrawProgressStep(step);
          if (step >= EStakeProgressStep.unstake) {
            ethenaCooldownCompletedRef.current = true;
          }
        },
        onEthenaCooldownUnstakeReady: shouldUseEthenaCooldown
          ? () => {
              setIgnoreAllowanceCheck(true);
              setPendingEthenaCooldownUnstake(true);
              setWithdrawProgressStep(EStakeProgressStep.unstake);
            }
          : undefined,
      });
      if (shouldUseEthenaCooldown) {
        if (ethenaCooldownCompletedRef.current) {
          resetAmount();
          setWithdrawProgressStep(EStakeProgressStep.approve);
          onQuoteReset?.();
        }
      } else {
        resetAmount();
        setWithdrawProgressStep(EStakeProgressStep.approve);
        // Auto-refresh quote countdown after swap completes
        onQuoteReset?.();
      }
    } finally {
      setLoading(false);
    }
  }, [
    amountValue,
    onConfirm,
    onQuoteReset,
    resetAmount,
    isStakefishEthWithdraw,
    signPersonalMessage,
    networkId,
    accountId,
    providerName,
    actionSymbol,
    identity,
    isPendleProvider,
    withdrawPathConfirmBoxes.length,
    effectiveSelectedWithdrawPathIndex,
    intl,
    symbol,
    price,
    receiveInputConfig,
    transactionConfirmation?.effectiveApy,
    transactionConfirmation?.receive,
    pendingEthenaCooldownUnstake,
    selectedWithdrawType,
    isCancelWithdrawal,
  ]);

  const [checkAmountLoading, setCheckAmountLoading] = useState(false);
  const [transactionConfirmationLoading, setTransactionConfirmationLoading] =
    useState(false);

  const quoteLoading = checkAmountLoading || transactionConfirmationLoading;

  const checkAmount = useDebouncedCallback(async (amount: string) => {
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
        action: ECheckAmountActionType.UNSTAKING,
        amount,
        protocolVault,
        withdrawAll: withdrawAllRef.current,
        identity,
        inputTokenAddress: transactionInputTokenAddress,
        outputTokenAddress: transactionOutputTokenAddress,
        slippage: pendleSlippage,
        withdrawType: selectedWithdrawType,
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

  const fetchTransactionConfirmation = useCallback(
    async (amount: string) => {
      if (isDisabled) {
        return undefined;
      }
      const resp =
        await backgroundApiProxy.serviceStaking.getTransactionConfirmation({
          networkId: networkId || '',
          provider: providerName || '',
          symbol: actionSymbol || '',
          vault: shouldSendProtocolVault ? protocolVault || '' : '',
          accountAddress,
          action: ECheckAmountActionType.UNSTAKING,
          amount,
          identity,
          inputTokenAddress: transactionInputTokenAddress,
          outputTokenAddress: transactionOutputTokenAddress,
          slippage: pendleSlippage,
          withdrawType: selectedWithdrawType,
        });
      return resp;
    },
    [
      isDisabled,
      accountAddress,
      protocolVault,
      shouldSendProtocolVault,
      networkId,
      providerName,
      actionSymbol,
      identity,
      transactionInputTokenAddress,
      transactionOutputTokenAddress,
      pendleSlippage,
      selectedWithdrawType,
    ],
  );

  // Keep refs in sync for onApprove's async onSuccess handler
  onPressRef.current = onPress;
  fetchTransactionConfirmationRef.current = fetchTransactionConfirmation;

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

  useEffect(() => {
    void debouncedFetchTransactionConfirmation(amountValue);
  }, [
    amountValue,
    debouncedFetchTransactionConfirmation,
    selectedWithdrawType,
    transactionOutputTokenAddress,
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

  const onChangeAmountValue = useCallback(
    (value: string, isMax = false) => {
      if (isCancelWithdrawal) {
        return;
      }
      if (!validateAmountInputForStaking(value, decimals)) {
        return;
      }
      const valueBN = new BigNumber(value);
      if (valueBN.isNaN()) {
        if (value === '') {
          setCheckoutAmountMessage('');
          setCheckAmountAlerts([]);
          setIgnoreAllowanceCheck(false);
          setPendingEthenaCooldownUnstake(false);
          setWithdrawProgressStep(EStakeProgressStep.approve);
          setAmountValue('');
          setIsWithdrawAll(false);
          withdrawAllRef.current = false;
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
        setIgnoreAllowanceCheck(false);
        setPendingEthenaCooldownUnstake(false);
        setWithdrawProgressStep(EStakeProgressStep.approve);
        setAmountValue(value);
      }
      withdrawAllRef.current = !!isMax;
      setIsWithdrawAll(!!isMax);
      void checkAmount(value);
    },
    [checkAmount, decimals, isCancelWithdrawal],
  );

  // Re-trigger checkAmount when output token changes
  useEffect(() => {
    if (!isCancelWithdrawal && amountValue && !isInvalidAmount(amountValue)) {
      void checkAmount(amountValue);
    }
  }, [
    transactionOutputTokenAddress,
    checkAmount,
    amountValue,
    isCancelWithdrawal,
    selectedWithdrawType,
  ]);

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
  }, [minAmount, amountValue, balance]);
  const onBlurAmountValue = useOnBlurAmountValue(amountValue, setAmountValue);

  const onMax = useCallback(() => {
    onChangeAmountValue(balance, true);
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

  const isCheckAmountMessageError =
    amountValue?.length > 0 && !!checkAmountMessage;

  const isDisable = useMemo<boolean>(
    () =>
      isDisabled ||
      !!selectedWithdrawPath?.disabled ||
      (!isCancelWithdrawal &&
        (isInvalidAmount(amountValue) ||
          BigNumber(amountValue).isLessThanOrEqualTo(0))) ||
      isCheckAmountMessageError ||
      checkAmountAlerts.length > 0 ||
      checkAmountLoading,
    [
      isDisabled,
      amountValue,
      isCheckAmountMessageError,
      checkAmountAlerts.length,
      checkAmountLoading,
      isCancelWithdrawal,
      selectedWithdrawPath?.disabled,
    ],
  );

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
    providerName: providerName ?? '',
    transactionConfirmation,
    amountValue,
    showApyDetail,
    receiveInputConfig,
    networkLogoURI: network?.logoURI,
    isQuoteExpired,
    loading: quoteLoading,
  });

  // During approve/submit flow, don't show expired refresh — the transaction is in progress.
  const isTransacting = approving || loading;
  const effectiveShowExpiredRefresh = showExpiredRefresh && !isTransacting;

  const amountInputDisabled = useMemo(() => {
    return isDisabled || initialAmount !== undefined || isCancelWithdrawal;
  }, [isDisabled, initialAmount, isCancelWithdrawal]);

  const accordionContent = useMemo(() => {
    const items: ReactElement[] = [];
    if (!isCancelWithdrawal && Number(amountValue) <= 0) {
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
          estimateFeeResp={estimateFeeResp}
          isVisible={isCancelWithdrawal || Number(amountValue) > 0}
        />,
      );
    }
    return items;
  }, [
    amountValue,
    estimateFeeResp,
    isCancelWithdrawal,
    isPendleLikeLayout,
    pendleAccordionItems,
    transactionConfirmation?.receive,
  ]);
  const isAccordionTriggerDisabled = !amountValue;

  const showWithdrawPathSelector =
    withdrawPathConfirmBoxes.length > 1 && !!selectedWithdrawPath;
  const shouldShowPendleWithdrawProgress =
    useApprove &&
    !!amountValue &&
    !isInvalidAmount(amountValue) &&
    (shouldApprove || withdrawProgressStep > EStakeProgressStep.approve);
  const isEthenaCooldownWithdrawPath =
    shouldShowPendleWithdrawProgress &&
    withdrawPathConfirmBoxes.length > 1 &&
    effectiveSelectedWithdrawPathIndex === 0;
  const shouldResumeEthenaCooldownUnstake =
    isEthenaCooldownWithdrawPath && pendingEthenaCooldownUnstake;

  const showWithdrawPathDialog = useCallback(() => {
    const selectedIndexRef = {
      current: effectiveSelectedWithdrawPathIndex,
    };
    const dialogRef: {
      close?: () => Promise<void> | void;
    } = {};
    const dialog = Dialog.show({
      title:
        transactionConfirmation?.withdrawPath?.text?.text ||
        intl.formatMessage({
          id: ETranslations.defi_withdrawal_options,
        }),
      renderContent: (
        <WithdrawPathDialogContent
          boxes={withdrawPathConfirmBoxes}
          initialSelectedIndex={effectiveSelectedWithdrawPathIndex}
          selectedIndexRef={selectedIndexRef}
          onTipAction={async (tip) => {
            await dialogRef.close?.();
            await handleTipAction(tip);
          }}
        />
      ),
      onConfirm: () => {
        if (selectedIndexRef.current !== effectiveSelectedWithdrawPathIndex) {
          handleSelectWithdrawPath(selectedIndexRef.current);
        }
      },
    });
    dialogRef.close = dialog.close;
  }, [
    effectiveSelectedWithdrawPathIndex,
    handleSelectWithdrawPath,
    handleTipAction,
    intl,
    transactionConfirmation?.withdrawPath?.text?.text,
    withdrawPathConfirmBoxes,
  ]);

  const confirmText = useMemo(() => {
    if (shouldApprove) return ETranslations.global_approve;
    if (effectiveShowExpiredRefresh) return ETranslations.global_refresh;
    if (shouldResumeEthenaCooldownUnstake) return ETranslations.defi_unstake;
    if (isCancelWithdrawal) return ETranslations.global_confirm;
    if (isPendleProvider) return ETranslations.global_swap;
    return ETranslations.global_withdraw;
  }, [
    shouldApprove,
    effectiveShowExpiredRefresh,
    shouldResumeEthenaCooldownUnstake,
    isCancelWithdrawal,
    isPendleProvider,
  ]);

  const confirmOnPress = useMemo(() => {
    if (shouldApprove) return onApprove;
    if (effectiveShowExpiredRefresh) return handleLocalRefreshQuote;
    return onPress;
  }, [
    shouldApprove,
    effectiveShowExpiredRefresh,
    onApprove,
    handleLocalRefreshQuote,
    onPress,
  ]);

  const confirmLoading = useMemo(() => {
    if (shouldApprove) return loadingAllowance || approving;
    if (effectiveShowExpiredRefresh) return quoteRefreshing;
    return loading || checkAmountLoading;
  }, [
    shouldApprove,
    effectiveShowExpiredRefresh,
    loadingAllowance,
    approving,
    quoteRefreshing,
    loading,
    checkAmountLoading,
  ]);

  const confirmDisabled = useMemo(() => {
    if (shouldApprove) return isDisable;
    if (effectiveShowExpiredRefresh) return false;
    return isDisable;
  }, [shouldApprove, effectiveShowExpiredRefresh, isDisable]);

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
                intl.formatMessage({ id: ETranslations.global_withdraw })
              }
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
                iconText: intl.formatMessage({
                  id: ETranslations.global_withdraw,
                }),
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
              testID="staking-icon-btn"
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

      {showWithdrawPathSelector && selectedWithdrawPath ? (
        <XStack
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
          borderRadius="$3"
          p="$3.5"
          gap="$2.5"
          ai="center"
          userSelect="none"
          cursor="pointer"
          hoverStyle={{ bg: '$bgHover' }}
          onPress={showWithdrawPathDialog}
        >
          <YStack flex={1} gap="$1">
            <SizableText size="$bodyMdMedium" color="$text">
              {selectedWithdrawPath.title.text}
            </SizableText>
            {selectedWithdrawPath.subtitle?.text ? (
              <SizableText
                size="$bodySm"
                color={selectedWithdrawPath.subtitle?.color || '$textSubdued'}
              >
                {selectedWithdrawPath.subtitle.text}
              </SizableText>
            ) : null}
          </YStack>
          <YStack gap="$1" ai="flex-end">
            <EarnAmountText size="$bodyMdMedium" color="$text">
              {selectedWithdrawPath.description.text}
            </EarnAmountText>
            {selectedWithdrawPath.subtitleDescription?.text ? (
              <XStack ai="center">
                <SizableText
                  size="$bodySmMedium"
                  color={
                    selectedWithdrawPath.subtitleDescription?.color ||
                    '$textSubdued'
                  }
                >
                  {selectedWithdrawPath.subtitleDescription.text}
                </SizableText>
              </XStack>
            ) : null}
          </YStack>
          <Icon
            name="ChevronRightSmallOutline"
            size="$5"
            color="$iconSubdued"
          />
        </XStack>
      ) : null}

      {formTransactionTip?.text ? (
        <Alert
          icon="InfoCircleOutline"
          type="warning"
          renderTitle={() => (
            <EarnText text={formTransactionTip.text} size="$bodyMdMedium" />
          )}
          action={
            formTransactionTip.button?.type ===
            EStakingActionType.CancelWithdrawal
              ? {
                  primary: formTransactionTip.button.text.text,
                  onPrimaryPress: () => {
                    void handleTipAction();
                  },
                }
              : undefined
          }
        />
      ) : null}

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
          pb={hasSummarySection ? '$5' : '$3.5'}
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
          {hasSummarySection && usePendleSummaryLayout ? (
            <PendleSummarySection
              rewardRows={pendleRewardRows}
              tipText={pendleTipText}
              loading={quoteLoading}
            />
          ) : null}
          {hasSummarySection && !usePendleSummaryLayout ? (
            <YStack gap="$1.5">
              <XStack ai="center" gap="$1">
                <EarnText
                  text={transactionConfirmation?.title}
                  color="$textSubdued"
                  size="$bodyMd"
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
          ) : null}
          {hasSummarySection && showPendleTransactionSection ? (
            <Divider my="$5" />
          ) : null}
          {showPendleTransactionSection ? (
            <Accordion
              overflow="hidden"
              width="100%"
              type="single"
              collapsible
              defaultValue={isPendleLikeLayout ? '' : WITHDRAW_ACCORDION_KEY}
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
                            animateOnly={ANIMATE_ONLY_TRANSFORM}
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
                    animateOnly={ANIMATE_ONLY_OPACITY}
                    exitStyle={{ opacity: 0 }}
                    px={0}
                    pb={0}
                    pt={accordionContent.length > 0 ? '$3.5' : '$0'}
                    gap={isPendleLikeLayout ? '$3.5' : '$2.5'}
                  >
                    {accordionContent}
                  </Accordion.Content>
                </Accordion.HeightAnimator>
              </Accordion.Item>
            </Accordion>
          ) : null}
        </YStack>
      ) : null}
      {beforeFooter}
      {shouldShowPendleWithdrawProgress ? (
        <StakeProgress
          approveType={EApproveType.Legacy}
          currentStep={
            shouldApprove
              ? EStakeProgressStep.approve
              : (Math.max(
                  withdrawProgressStep,
                  EStakeProgressStep.deposit,
                ) as EStakeProgressStep)
          }
          step2LabelId={ETranslations.global_swap}
          step3LabelId={
            isEthenaCooldownWithdrawPath
              ? ETranslations.defi_unstake
              : undefined
          }
        />
      ) : null}
      {isInModalContext ? (
        <Page.Footer>
          <Page.FooterActions
            onConfirmText={intl.formatMessage({ id: confirmText })}
            confirmButtonProps={{
              onPress: confirmOnPress,
              loading: confirmLoading,
              disabled: confirmDisabled,
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
            onConfirmText={intl.formatMessage({ id: confirmText })}
            buttonContainerProps={{
              $gtMd: {
                ml: '0',
              },
              w: '100%',
            }}
            confirmButtonProps={{
              onPress: confirmOnPress,
              loading: confirmLoading,
              disabled: confirmDisabled,
              w: '100%',
            }}
          />
        </YStack>
      )}
    </StakingFormWrapper>
  );
}
