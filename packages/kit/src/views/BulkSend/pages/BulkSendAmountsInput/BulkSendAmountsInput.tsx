import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { chunk, isEmpty } from 'lodash';
import pLimit from 'p-limit';
import { useIntl } from 'react-intl';
import { Keyboard } from 'react-native';

import {
  NumberSizeableText,
  Page,
  SizableText,
  Toast,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { convertTokenFiatToCurrency } from '@onekeyhq/kit/src/utils/fiatConvert';
import {
  useCurrencyPersistAtom,
  useInscriptionProtectionStateAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IApproveInfo,
  ITransferInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { getBulkSendContractAddress } from '@onekeyhq/shared/src/consts/bulkSendContractAddress';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_TOKEN,
} from '@onekeyhq/shared/src/consts/walletConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalBulkSendRoutes,
  EModalRoutes,
  type IModalBulkSendParamList,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import { validateTokenAmount } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  EAmountInputMode,
  EBulkSendMode,
  EIntervalMode,
  type IAmountInputError,
  type IAmountInputValues,
  type IIntervalSettings,
  type ITransferInfoErrors,
} from '@onekeyhq/shared/types/bulkSend';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import BulkSendBar from '../../components/BulkSendBar';
import BulkSendContentWrapper from '../../components/BulkSendContentWrapper';
import BulkSendHeader from '../../components/BulkSendHeader';
import { useRedirectToBulkSendAddressesInput } from '../../hooks/useRedirectToBulkSendAddressesInput';
import {
  DEFAULT_INTERVAL_SETTINGS,
  calculateIsAmountValid,
  calculateTotalAmounts,
  checkSenderInsufficientBalance,
  getBulkSendMinTransferAmount,
  getBulkSendMinTransferDisplayAmount,
  isBulkSendTokenDetailsMatched,
  validateIntervalSettings,
  validateRangeInput,
} from '../../utils';

import { AmountPreview } from './components/AmountPreview';
import {
  BulkSendAmountsInputContext,
  type IBulkSendAmountsInputContext,
  type IMobileModeData,
  type IMobileModeDataByMode,
  type IPreviewState,
  useBulkSendAmountsInputContext,
} from './components/Context';
import MobileLayout from './components/MobileLayout';
import TableLayout from './components/TableLayout';
import { useAmountPreview } from './components/useAmountPreview';

function BaseBulkSendAmountsInput({ isInModal }: { isInModal?: boolean }) {
  const {
    accountId,
    networkId,
    tokenInfo,
    tokenDetails,
    tokenDetailsState,
    bulkSendMode,
    transfersInfo,
    totalTokenAmount,
    totalFiatAmount,
    isAmountValid,
    isInsufficientBalance,
    amountInputMode,
    amountInputValues,
    setAmountInputValues,
    amountInputErrors,
    setAmountInputErrors,
    previewState,
    setPreviewState,
    setTransfersInfo,
    currentModeData,
    updateCurrentModeData,
    isMaxMode,
    setIsMaxMode,
    intervalSettings,
    setIntervalSettings,
    senderBalances,
    senderBalancesLoading,
    senderBalancesFailed,
    senderAccountIdMap,
    minTransferAmount,
    hasDuplicateSenders,
    rebaseMultiplier,
    displayBalance,
    isScaledUiUnsupported,
  } = useBulkSendAmountsInputContext();

  const isOneToMany = bulkSendMode === EBulkSendMode.OneToMany;
  const shouldShowMaxMode = isOneToMany
    ? !tokenInfo?.isNative
    : !hasDuplicateSenders;

  const intl = useIntl();
  const navigation = useAppNavigation();

  const media = useMedia();
  const minTransferDisplayAmount = useMemo(
    () =>
      getBulkSendMinTransferDisplayAmount({
        minTransferAmount,
        tokenDecimals: tokenInfo?.decimals,
      }),
    [minTransferAmount, tokenInfo?.decimals],
  );

  const [settings] = useSettingsPersistAtom();

  const [isBuilding, setIsBuilding] = useState(false);

  // On mobile, update both shared and mode-specific data when preview generates amounts
  const setTransfersInfoWithModeUpdate = useCallback(
    (newTransfersInfo: ITransferInfo[]) => {
      setTransfersInfo(newTransfersInfo);
      if (!media.gtMd && amountInputMode !== EAmountInputMode.Custom) {
        updateCurrentModeData({ transfersInfo: newTransfersInfo });
      }
    },
    [setTransfersInfo, media.gtMd, amountInputMode, updateCurrentModeData],
  );

  const { handlePreview, shouldShowTxDetails } = useAmountPreview({
    tokenInfo,
    transfersInfo,
    setTransfersInfo: setTransfersInfoWithModeUpdate,
    previewState,
    setPreviewState,
    balance: isOneToMany
      ? (displayBalance ?? tokenDetails?.balanceParsed)
      : undefined,
  });

  // Mobile-only: preview mode means TransactionDetail is visible for Specified/Range
  const isInPreviewMode =
    !media.gtMd &&
    amountInputMode !== EAmountInputMode.Custom &&
    shouldShowTxDetails(amountInputMode);

  const { result: vaultSettings } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceNetwork.getVaultSettings({ networkId }),
    [networkId],
  );
  const isNativeBatchTransfer =
    vaultSettings?.nativeBatchTransferEnabled ?? false;

  // Check if token needs approval (native tokens don't need approval)
  const needsApproval = useMemo(
    () =>
      tokenInfo &&
      !tokenInfo.isNative &&
      !isNativeBatchTransfer &&
      bulkSendMode === EBulkSendMode.OneToMany &&
      transfersInfo.length > 1,
    [tokenInfo, bulkSendMode, transfersInfo.length, isNativeBatchTransfer],
  );

  const bulkSendContractAddress = useMemo(() => {
    const addresses = getBulkSendContractAddress();
    return addresses[networkId];
  }, [networkId]);

  // Helper: get effective data based on platform (mobile uses mode-specific data)
  const getEffectiveData = useCallback(() => {
    const effectiveTransfersInfo = !media.gtMd
      ? currentModeData.transfersInfo
      : transfersInfo;
    const effectiveTotalTokenAmount = !media.gtMd
      ? currentModeData.totalTokenAmount
      : totalTokenAmount;
    const effectiveTotalFiatAmount = !media.gtMd
      ? currentModeData.totalFiatAmount
      : totalFiatAmount;
    return {
      effectiveTransfersInfo,
      effectiveTotalTokenAmount,
      effectiveTotalFiatAmount,
    };
  }, [
    media.gtMd,
    currentModeData.transfersInfo,
    currentModeData.totalTokenAmount,
    currentModeData.totalFiatAmount,
    transfersInfo,
    totalTokenAmount,
    totalFiatAmount,
  ]);

  // Helper: navigate to review or interval page
  const navigateToReviewOrInterval = useCallback(
    (params: {
      networkId: string;
      accountId: string | undefined;
      unsignedTxs: IUnsignedTxPro[];
      approvesInfo: IApproveInfo[];
      tokenInfo: IToken;
      transfersInfo: ITransferInfo[];
      bulkSendMode: EBulkSendMode;
      isInModal?: boolean;
      isMaxMode?: boolean;
      totalTokenAmount: string;
      totalFiatAmount: string;
      ataCount?: number;
    }) => {
      // Mobile non-OneToMany: navigate to interval page first
      const shouldShowInterval = !media.gtMd && !isOneToMany;
      // Desktop: pass interval settings directly to review
      // OneToMany uses smart contract batch, interval not applicable
      const effectiveIntervalSettings = isOneToMany
        ? { mode: EIntervalMode.None, minSeconds: '', maxSeconds: '' }
        : intervalSettings;
      const reviewParams = media.gtMd
        ? { ...params, intervalSettings: effectiveIntervalSettings }
        : params;
      const intervalInputParams = {
        ...params,
        intervalSettings,
        onConfirmIntervalSettings: setIntervalSettings,
      };

      if (shouldShowInterval) {
        if (isInModal) {
          navigation.push(
            EModalBulkSendRoutes.BulkSendIntervalInput,
            intervalInputParams,
          );
        } else {
          navigation.pushModal(EModalRoutes.BulkSendModal, {
            screen: EModalBulkSendRoutes.BulkSendIntervalInput,
            params: intervalInputParams,
          });
        }
      } else if (isInModal) {
        navigation.push(EModalBulkSendRoutes.BulkSendReview, reviewParams);
      } else {
        navigation.pushModal(EModalRoutes.BulkSendModal, {
          screen: EModalBulkSendRoutes.BulkSendReview,
          params: reviewParams,
        });
      }
    },
    [
      media.gtMd,
      isOneToMany,
      intervalSettings,
      isInModal,
      navigation,
      setIntervalSettings,
    ],
  );

  // Submit handler for OneToMany mode
  const handleSubmitOneToMany = useCallback(async () => {
    if (
      !accountId ||
      !networkId ||
      !tokenInfo ||
      (!bulkSendContractAddress && !isNativeBatchTransfer)
    )
      return;

    setIsBuilding(true);

    const {
      effectiveTransfersInfo,
      effectiveTotalTokenAmount,
      effectiveTotalFiatAmount,
    } = getEffectiveData();

    try {
      const sender = effectiveTransfersInfo[0]?.from;
      if (!sender) return;

      // Scaled-UI (rebase) tokens: user input and the effective totals are
      // display-basis; convert every transfer to its raw on-chain amount
      // before any tx or approval is built and before transfersInfo rides
      // the route to Review/Process (Process rebuilds txs from it right
      // before signing). The snapshot multiplier is stamped onto each
      // transfer's tokenInfo so downstream display leaves can re-derive the
      // display amount. No full-send shortcut is needed here: the per-address
      // MAX is a user-editable balance/count split, and per-row ROUND_DOWN
      // division can never sum above the raw balance the validators checked.
      let rawTransfersInfo = effectiveTransfersInfo;
      let approvalTokenAmount = effectiveTotalTokenAmount;
      let finalTotalTokenAmount = effectiveTotalTokenAmount;
      let finalTotalFiatAmount = effectiveTotalFiatAmount;
      if (tokenRebaseUtils.isValidBalanceMultiplier(rebaseMultiplier)) {
        rawTransfersInfo = effectiveTransfersInfo.map((transfer) => ({
          ...transfer,
          amount: tokenRebaseUtils.removeBalanceMultiplier({
            amount: transfer.amount,
            balanceMultiplier: rebaseMultiplier,
            decimals: tokenInfo.decimals,
          }),
          tokenInfo: transfer.tokenInfo
            ? { ...transfer.tokenInfo, balanceMultiplier: rebaseMultiplier }
            : transfer.tokenInfo,
        }));
        // A display amount below one raw unit × multiplier truncates to a
        // raw 0; block instead of building a zero transfer that costs fees.
        if (
          rawTransfersInfo.some((transfer, index) => {
            const displayAmount = effectiveTransfersInfo[index]?.amount ?? '0';
            return (
              !new BigNumber(displayAmount).isZero() &&
              new BigNumber(transfer.amount).isZero()
            );
          })
        ) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.send_amount_too_small,
            }),
          });
          return;
        }
        // The on-chain allowance must cover the raw amounts actually spent,
        // not the display-basis total.
        approvalTokenAmount = rawTransfersInfo
          .reduce(
            (acc, transfer) => acc.plus(transfer.amount || '0'),
            new BigNumber(0),
          )
          .toFixed();
        // The per-row display->raw division floors at token decimals, so the
        // pre-division totals can exceed what actually gets signed. Rebuild
        // the Grand Summary totals from the raw amounts — the same numbers
        // Review/Process re-derive their per-row display from — so summary
        // and details always agree.
        ({
          totalTokenAmount: finalTotalTokenAmount,
          totalFiatAmount: finalTotalFiatAmount,
        } = calculateTotalAmounts({
          transfersInfo: rawTransfersInfo.map((transfer) => ({
            ...transfer,
            amount: tokenRebaseUtils.applyBalanceMultiplier({
              amount: transfer.amount,
              balanceMultiplier: rebaseMultiplier,
            }),
          })),
          tokenPrice: tokenDetails?.price,
        }));
      }

      const unsignedTxs: IUnsignedTxPro[] = [];
      const approvesInfo: IApproveInfo[] = [];

      let ataCount: number | undefined;

      if (isNativeBatchTransfer) {
        // Native batch: no approvals, use vault's splitting method
        const batchResult =
          await backgroundApiProxy.serviceSend.buildBulkSendUnsignedTxs({
            networkId,
            accountId,
            transfersInfo: rawTransfersInfo,
          });
        unsignedTxs.push(...batchResult.unsignedTxs);
        ataCount = batchResult.ataCount;
      } else {
        // EVM/TRON: existing approval + contract-based flow
        if (needsApproval) {
          const allowanceResponse =
            await backgroundApiProxy.serviceSwap.fetchApproveAllowance({
              networkId,
              tokenAddress: tokenInfo.address,
              spenderAddress: bulkSendContractAddress,
              walletAddress: sender,
              accountId,
              amount: approvalTokenAmount,
            });

          if (!allowanceResponse?.isApproved) {
            // Stamp the same snapshot multiplier the transfers carry so the
            // review card re-derives the display-basis approve amount and
            // the approve editors keep failing closed on scaled tokens.
            const baseTokenInfo = {
              ...tokenInfo,
              isNative: !!tokenInfo.isNative,
              name: tokenInfo.name ?? tokenInfo.symbol,
              ...(tokenRebaseUtils.isValidBalanceMultiplier(rebaseMultiplier)
                ? { balanceMultiplier: rebaseMultiplier }
                : {}),
            };

            // USDT-like tokens require reset approval first
            if (allowanceResponse?.shouldResetApprove) {
              approvesInfo.push({
                owner: sender,
                spender: bulkSendContractAddress,
                amount: '0',
                isMax: false,
                tokenInfo: baseTokenInfo,
              });
            }

            // Add the actual approval
            approvesInfo.push({
              owner: sender,
              spender: bulkSendContractAddress,
              amount: approvalTokenAmount,
              isMax: false,
              tokenInfo: baseTokenInfo,
            });
          }
        }

        let prevNonce: number | undefined;
        for (const approveInfo of approvesInfo) {
          const unsignedTx =
            await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
              networkId,
              accountId,
              approveInfo,
              prevNonce,
            });
          prevNonce = unsignedTx.nonce;
          unsignedTxs.push(unsignedTx);
        }
        unsignedTxs.push(
          await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
            networkId,
            accountId,
            transfersInfo: rawTransfersInfo,
            prevNonce,
          }),
        );
      }

      navigateToReviewOrInterval({
        networkId,
        accountId,
        unsignedTxs,
        approvesInfo,
        tokenInfo,
        transfersInfo: rawTransfersInfo,
        bulkSendMode,
        isInModal,
        totalTokenAmount: finalTotalTokenAmount,
        totalFiatAmount: finalTotalFiatAmount,
        ataCount,
      });
    } catch (error) {
      console.error('Failed to build OneToMany transactions:', error);
    } finally {
      setIsBuilding(false);
    }
  }, [
    accountId,
    networkId,
    tokenInfo,
    tokenDetails?.price,
    bulkSendContractAddress,
    isNativeBatchTransfer,
    needsApproval,
    bulkSendMode,
    isInModal,
    getEffectiveData,
    navigateToReviewOrInterval,
    rebaseMultiplier,
    intl,
  ]);

  // Submit handler for ManyToOne / ManyToMany modes
  const handleSubmitManyToManyOrManyToOne = useCallback(async () => {
    if (!accountId || !networkId || !tokenInfo) return;

    // Scaled-UI (rebase) tokens: the per-sender balance pipeline only keeps
    // raw balances with the multiplier stripped, so display-basis input
    // cannot be converted per sender here. Fail closed (same policy as
    // private send) instead of building txs that would move multiplier× the
    // intended amount.
    if (isScaledUiUnsupported) {
      Toast.error({
        title: 'Bulk send does not support scaled-UI tokens yet',
      });
      return;
    }

    setIsBuilding(true);

    const {
      effectiveTransfersInfo,
      effectiveTotalTokenAmount,
      effectiveTotalFiatAmount,
    } = getEffectiveData();

    try {
      // Resolve Max mode amounts from sender balances
      const resolvedTransfersInfo =
        !isOneToMany && isMaxMode
          ? effectiveTransfersInfo.map((transfer) => ({
              ...transfer,
              amount: senderBalances[transfer.from] ?? '0',
            }))
          : effectiveTransfersInfo;

      // Recalculate totals for Max mode
      let finalTotalTokenAmount = effectiveTotalTokenAmount;
      let finalTotalFiatAmount = effectiveTotalFiatAmount;
      if (!isOneToMany && isMaxMode && tokenDetails?.price) {
        const { totalTokenAmount: maxTotal, totalFiatAmount: maxFiat } =
          calculateTotalAmounts({
            transfersInfo: resolvedTransfersInfo,
            tokenPrice: tokenDetails.price,
          });
        finalTotalTokenAmount = maxTotal;
        finalTotalFiatAmount = maxFiat;
      }

      // Each sender creates an independent transaction
      const unsignedTxs: IUnsignedTxPro[] = [];

      for (const transfer of resolvedTransfersInfo) {
        // Use per-sender accountId when available
        const senderAccountId =
          senderAccountIdMap.get(transfer.from) ?? accountId;
        const unsignedTx =
          await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
            networkId,
            accountId: senderAccountId,
            transfersInfo: [transfer],
          });
        unsignedTxs.push({ ...unsignedTx, accountId: senderAccountId });
      }

      navigateToReviewOrInterval({
        networkId,
        accountId,
        unsignedTxs,
        approvesInfo: [],
        tokenInfo,
        transfersInfo: resolvedTransfersInfo,
        bulkSendMode,
        isInModal,
        isMaxMode: !isOneToMany && isMaxMode,
        totalTokenAmount: finalTotalTokenAmount,
        totalFiatAmount: finalTotalFiatAmount,
      });
    } catch (error) {
      console.error(
        'Failed to build ManyToMany/ManyToOne transactions:',
        error,
      );
    } finally {
      setIsBuilding(false);
    }
  }, [
    accountId,
    networkId,
    tokenInfo,
    tokenDetails?.price,
    bulkSendMode,
    isInModal,
    isMaxMode,
    senderBalances,
    senderAccountIdMap,
    getEffectiveData,
    navigateToReviewOrInterval,
    isOneToMany,
    isScaledUiUnsupported,
  ]);

  // Main submit dispatcher
  const handleSubmit = useCallback(async () => {
    // Mobile: Specified/Range mode requires a preview step before review
    if (
      !media.gtMd &&
      amountInputMode !== EAmountInputMode.Custom &&
      !shouldShowTxDetails(amountInputMode)
    ) {
      Keyboard.dismiss();
      handlePreview(
        amountInputMode,
        amountInputValues,
        amountInputMode === EAmountInputMode.Range
          ? previewState.rangePreviewAmounts
          : undefined,
      );
      return;
    }

    if (bulkSendMode === EBulkSendMode.OneToMany) {
      await handleSubmitOneToMany();
    } else {
      await handleSubmitManyToManyOrManyToOne();
    }
  }, [
    bulkSendMode,
    media.gtMd,
    amountInputMode,
    amountInputValues,
    shouldShowTxDetails,
    handlePreview,
    previewState.rangePreviewAmounts,
    handleSubmitOneToMany,
    handleSubmitManyToManyOrManyToOne,
  ]);

  const isSubmitDisabled = useMemo(() => {
    const baseConditions =
      !tokenDetailsState.initialized ||
      (tokenDetailsState.isRefreshing && !tokenDetails) ||
      isBuilding ||
      (isOneToMany && !bulkSendContractAddress && !isNativeBatchTransfer);

    if (baseConditions) return true;

    // Max mode requires all sender balances to be loaded successfully
    if (
      !isOneToMany &&
      isMaxMode &&
      (senderBalancesLoading || senderBalancesFailed.size > 0)
    )
      return true;

    if (!media.gtMd) {
      // In preview mode, only check mode-specific insufficient balance
      if (isInPreviewMode) {
        return currentModeData.isInsufficientBalance;
      }

      // In Custom mode, check mode-specific errors and data
      if (amountInputMode === EAmountInputMode.Custom) {
        const hasTransferErrors = !isEmpty(currentModeData.transferInfoErrors);
        return (
          hasTransferErrors ||
          currentModeData.isInsufficientBalance ||
          currentModeData.transfersInfo.length === 0
        );
      }

      // Specified/Range non-preview: only check input validity.
      // Don't use shared isInsufficientBalance here — it reflects original
      // receiver amounts which haven't been regenerated yet. The actual
      // insufficient balance check happens after preview generates new amounts.
      return !isAmountValid;
    }

    // Desktop non-OneToMany: also check interval validity (inline editing has no confirm gate)
    const hasIntervalError =
      !isOneToMany && !!validateIntervalSettings(intervalSettings, intl);

    return !isAmountValid || isInsufficientBalance || hasIntervalError;
  }, [
    tokenDetailsState.initialized,
    tokenDetailsState.isRefreshing,
    tokenDetails,
    currentModeData,
    isAmountValid,
    isInsufficientBalance,
    isBuilding,
    isOneToMany,
    bulkSendContractAddress,
    isNativeBatchTransfer,
    isMaxMode,
    senderBalancesLoading,
    senderBalancesFailed.size,
    media.gtMd,
    isInPreviewMode,
    amountInputMode,
    intervalSettings,
    intl,
  ]);

  const confirmButtonText = useMemo(() => {
    let hasInsufficientBalance = false;
    if (!media.gtMd) {
      if (amountInputMode === EAmountInputMode.Custom || isInPreviewMode) {
        hasInsufficientBalance = currentModeData.isInsufficientBalance;
      }
    } else if (amountInputMode === EAmountInputMode.Custom || !isOneToMany) {
      hasInsufficientBalance = isInsufficientBalance;
    }

    if (hasInsufficientBalance) {
      return intl.formatMessage({
        id: ETranslations.swap_page_button_insufficient_balance,
      });
    }

    if (media.gtMd || (isInPreviewMode && isOneToMany)) {
      return intl.formatMessage({
        id: ETranslations.wallet_bulk_send_btn_review,
      });
    }

    return intl.formatMessage({ id: ETranslations.wallet_bulk_send_btn_next });
  }, [
    intl,
    media.gtMd,
    amountInputMode,
    isInPreviewMode,
    currentModeData.isInsufficientBalance,
    isInsufficientBalance,
    isOneToMany,
  ]);

  const handleMaxPress = useCallback(() => {
    if (!tokenInfo || (isOneToMany && tokenInfo.isNative)) return;
    if (amountInputMode !== EAmountInputMode.Specified) return;

    // Non-OneToMany: toggle Max mode (send full token balance per sender)
    if (!isOneToMany) {
      setIsMaxMode(!isMaxMode);
      return;
    }

    // OneToMany token transfer: calculate max token amount per address from
    // balance. Display basis for scaled-UI tokens — the per-address amount
    // stays user-editable and is converted back to raw at submit.
    const balance = displayBalance ?? tokenDetails?.balanceParsed ?? '0';
    if (!balance || transfersInfo.length === 0) return;
    const maxAmountPerAddress = new BigNumber(balance)
      .dividedBy(transfersInfo.length)
      .decimalPlaces(tokenInfo.decimals, BigNumber.ROUND_DOWN)
      .toFixed();
    setAmountInputValues({
      ...amountInputValues,
      specifiedAmount: maxAmountPerAddress,
    });
    const maxAmountBN = new BigNumber(maxAmountPerAddress);
    const minTransferAmountBN = new BigNumber(minTransferAmount);
    if (
      !minTransferAmountBN.isZero() &&
      !maxAmountBN.isZero() &&
      maxAmountBN.isLessThan(minTransferAmountBN)
    ) {
      setAmountInputErrors({
        ...amountInputErrors,
        specifiedAmount: intl.formatMessage(
          { id: ETranslations.send_error_minimum_amount },
          {
            amount: minTransferDisplayAmount,
            token: tokenInfo.symbol,
          },
        ),
      });
      return;
    }

    setAmountInputErrors({
      ...amountInputErrors,
      specifiedAmount: undefined,
    });
  }, [
    intl,
    amountInputMode,
    isOneToMany,
    isMaxMode,
    setIsMaxMode,
    displayBalance,
    tokenDetails?.balanceParsed,
    transfersInfo.length,
    setAmountInputValues,
    amountInputValues,
    tokenInfo,
    setAmountInputErrors,
    amountInputErrors,
    minTransferAmount,
    minTransferDisplayAmount,
  ]);

  return (
    <Page scrollEnabled>
      {media.gtMd ? null : (
        <Page.Header
          headerTitle={intl.formatMessage({
            id: ETranslations.wallet_bulk_send_set_amount_title,
          })}
        />
      )}
      <BulkSendBar />
      <Page.Body>
        <BulkSendContentWrapper>
          <BulkSendHeader bulkSendMode={bulkSendMode} />
          {media.gtMd ? <TableLayout /> : <MobileLayout />}
        </BulkSendContentWrapper>
      </Page.Body>
      <Page.Footer borderTopWidth={1} borderColor="$borderDefault">
        <BulkSendContentWrapper
          $gtMd={{
            mt: '$0',
            px: '$0',
            mx: 'auto',
            maxWidth: '$180',
          }}
        >
          <Page.FooterActions
            px="$0"
            onConfirmText={confirmButtonText}
            confirmButtonProps={{
              onPress: handleSubmit,
              disabled: isSubmitDisabled,
              loading: isBuilding,
            }}
          >
            {media.gtMd ? (
              <YStack gap="$1" h="$10" justifyContent="center">
                <SizableText size="$bodySm" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.wallet_bulk_send_total_amount,
                  })}
                </SizableText>
                <XStack alignItems="center" gap="$1">
                  <NumberSizeableText
                    size="$bodyLgMedium"
                    formatter="balance"
                    formatterOptions={{ tokenSymbol: tokenInfo?.symbol }}
                  >
                    {totalTokenAmount}
                  </NumberSizeableText>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    (
                    <NumberSizeableText
                      size="$bodyMd"
                      formatter="value"
                      formatterOptions={{
                        currency: settings.currencyInfo.symbol,
                      }}
                    >
                      {totalFiatAmount}
                    </NumberSizeableText>
                    )
                  </SizableText>
                </XStack>
              </YStack>
            ) : (
              <AmountPreview
                containerProps={{
                  mb: '$4',
                }}
                amountInputValues={amountInputValues}
                amountInputMode={amountInputMode}
                amountInputErrors={amountInputErrors}
                tokenDetails={tokenDetails}
                transfersInfo={
                  amountInputMode === EAmountInputMode.Custom
                    ? currentModeData.transfersInfo
                    : transfersInfo
                }
                isInPreviewMode={isInPreviewMode}
                previewTotalTokenAmount={currentModeData.totalTokenAmount}
                previewTotalFiatAmount={currentModeData.totalFiatAmount}
                rangePreviewAmounts={previewState.rangePreviewAmounts}
                onMaxPress={
                  amountInputMode === EAmountInputMode.Specified &&
                  shouldShowMaxMode
                    ? handleMaxPress
                    : undefined
                }
                isInsufficientBalance={
                  amountInputMode === EAmountInputMode.Custom || isInPreviewMode
                    ? currentModeData.isInsufficientBalance
                    : false
                }
                isMaxMode={isMaxMode}
                hideBalance={!isOneToMany}
              />
            )}
          </Page.FooterActions>
        </BulkSendContentWrapper>
      </Page.Footer>
    </Page>
  );
}

type IBulkSendAmountsInputRouteParams =
  IModalBulkSendParamList[EModalBulkSendRoutes.BulkSendAmountsInput];

function BulkSendAmountsInputContent({
  networkId,
  accountId,
  senders,
  receivers,
  tokenInfo,
  tokenDetails: initialTokenDetails,
  bulkSendMode,
  isInModal,
  hasDuplicateSenders: _hasDuplicateSendersProp,
}: IBulkSendAmountsInputRouteParams) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const [inscriptionProtectionState] = useInscriptionProtectionStateAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const hasCustomAmounts = useMemo(
    () =>
      (receivers?.some((r) => r.amount !== undefined && r.amount !== '') ||
        senders?.some((s) => s.amount !== undefined && s.amount !== '')) ??
      false,
    [receivers, senders],
  );
  const isOneToMany = bulkSendMode === EBulkSendMode.OneToMany;
  const sanitizedInitialTokenDetails = useMemo(
    () =>
      isBulkSendTokenDetailsMatched(
        {
          networkId,
          tokenInfo,
        },
        initialTokenDetails,
      )
        ? initialTokenDetails
        : undefined,
    [networkId, tokenInfo, initialTokenDetails],
  );

  const [tokenDetails, setTokenDetails] = useState<
    ({ info: IToken } & ITokenFiat) | undefined
  >(sanitizedInitialTokenDetails);
  const tokenDetailsRequestIdRef = useRef(0);
  const [tokenDetailsState, setTokenDetailsState] = useState<{
    initialized: boolean;
    isRefreshing: boolean;
  }>({
    initialized: true,
    isRefreshing: false,
  });
  const [amountInputMode, setAmountInputMode] = useState<EAmountInputMode>(
    EAmountInputMode.Specified,
  );

  const [isMaxMode, setIsMaxModeRaw] = useState(false);

  const [amountInputValues, setAmountInputValues] =
    useState<IAmountInputValues>({
      specifiedAmount: '',
      rangeMin: '',
      rangeMax: '',
    });

  const setIsMaxMode = useCallback(
    (value: boolean) => {
      setIsMaxModeRaw(value);
      setAmountInputValues((prev) => ({ ...prev, isMaxMode: value }));
    },
    [setAmountInputValues],
  );

  const [amountInputErrors, setAmountInputErrors] = useState<IAmountInputError>(
    {},
  );

  const [transferInfoErrors, setTransferInfoErrors] =
    useState<ITransferInfoErrors>({});

  const [transfersInfo, setTransfersInfo] = useState<ITransferInfo[]>([]);

  // Dynamically compute whether there are duplicate sender addresses
  const hasDuplicateSenders = useMemo(() => {
    if (bulkSendMode === EBulkSendMode.OneToMany) return false;
    const senderAddresses = transfersInfo.map((t) => t.from);
    return new Set(senderAddresses).size !== senderAddresses.length;
  }, [bulkSendMode, transfersInfo]);

  // Auto-exit Max mode when duplicate senders appear
  useEffect(() => {
    if (hasDuplicateSenders && isMaxMode) {
      setIsMaxMode(false);
    }
  }, [hasDuplicateSenders, isMaxMode, setIsMaxMode]);

  const [previewState, setPreviewState] = useState<IPreviewState>({
    specifiedPreviewed: false,
    rangePreviewed: false,
    rangePreviewAmounts: [],
  });

  // Mobile: independent data per mode
  const defaultModeData: IMobileModeData = useMemo(
    () => ({
      transfersInfo: [],
      transferInfoErrors: {},
      isInsufficientBalance: false,
      totalTokenAmount: '0',
      totalFiatAmount: '0',
    }),
    [],
  );

  const [mobileModeData, setMobileModeData] = useState<IMobileModeDataByMode>({
    [EAmountInputMode.Specified]: { ...defaultModeData },
    [EAmountInputMode.Range]: { ...defaultModeData },
    [EAmountInputMode.Custom]: { ...defaultModeData },
  });

  // fetchTokensDetails responses (and the route-param initial details) are
  // normalized to USD basis for caching (tagged currency:'usd'), while this
  // page does fiat math with tokenDetails.price and renders the results under
  // settings.currencyInfo.symbol. Convert once here, before the value enters
  // the context, so every consumer (TableLayout / AmountInput / AmountPreview
  // and the max-mode totals) sees display-currency values.
  const matchedTokenDetails = useMemo(() => {
    if (
      !isBulkSendTokenDetailsMatched(
        {
          networkId,
          tokenInfo,
        },
        tokenDetails,
      ) ||
      !tokenDetails
    ) {
      return undefined;
    }
    return convertTokenFiatToCurrency({
      tokenFiat: tokenDetails,
      targetCurrency: settings.currencyInfo.id,
      currencyMap,
    });
  }, [
    networkId,
    tokenInfo,
    tokenDetails,
    settings.currencyInfo.id,
    currencyMap,
  ]);

  // Scaled-UI (rebase) tokens (OK-58046): user-entered amounts and balances
  // shown on this page are display-basis; ITransferInfo.amount must stay raw.
  // One multiplier for the whole page is correct because every transfer moves
  // the same token. Native coins can never legitimately carry a multiplier —
  // same guard as the Send page.
  //
  // Multiplier precedence: live detail > last rendered live value > route
  // token snapshot. tokenInfo is the token-list snapshot taken when the user
  // picked the token on the addresses page, and BulkSend is a long form —
  // by submit time that snapshot can be arbitrarily stale. Once a live
  // detail has rendered amounts, a failed poll (which clears
  // matchedTokenDetails) must not swap the basis back to the stale snapshot:
  // tokenRebaseUtils requires the display->raw conversion at submit to use
  // the same multiplier that rendered the amounts the user confirmed. The
  // remembered value is keyed by token identity so a mid-flow token change
  // can never leak the previous token's multiplier under fresh amounts.
  const rebaseTokenKey = useMemo(
    () =>
      tokenInfo
        ? `${tokenInfo.networkId ?? networkId ?? ''}__${(
            tokenInfo.address ?? ''
          ).toLowerCase()}`
        : undefined,
    [tokenInfo, networkId],
  );
  const lastLiveMultiplierRef = useRef<
    | {
        tokenKey: string;
        balanceMultiplier: string | undefined;
      }
    | undefined
  >(undefined);
  useEffect(() => {
    if (
      tokenInfo &&
      !tokenInfo.isNative &&
      matchedTokenDetails &&
      rebaseTokenKey
    ) {
      lastLiveMultiplierRef.current = {
        tokenKey: rebaseTokenKey,
        balanceMultiplier:
          tokenRebaseUtils.pickBalanceMultiplier(matchedTokenDetails) ??
          tokenInfo.balanceMultiplier,
      };
    }
  }, [tokenInfo, matchedTokenDetails, rebaseTokenKey]);
  const rebaseMultiplier = useMemo(() => {
    if (!tokenInfo || tokenInfo.isNative) {
      return undefined;
    }
    if (matchedTokenDetails) {
      return (
        tokenRebaseUtils.pickBalanceMultiplier(matchedTokenDetails) ??
        tokenInfo.balanceMultiplier
      );
    }
    const lastLive = lastLiveMultiplierRef.current;
    if (lastLive && lastLive.tokenKey === rebaseTokenKey) {
      return lastLive.balanceMultiplier;
    }
    return tokenInfo.balanceMultiplier;
  }, [tokenInfo, matchedTokenDetails, rebaseTokenKey]);

  const displayBalance = useMemo(() => {
    const raw = matchedTokenDetails?.balanceParsed;
    return tokenRebaseUtils.applyBalanceMultiplier({
      amount: raw,
      balanceMultiplier: rebaseMultiplier,
    });
  }, [matchedTokenDetails?.balanceParsed, rebaseMultiplier]);

  useEffect(() => {
    setTokenDetails(sanitizedInitialTokenDetails);
  }, [sanitizedInitialTokenDetails]);

  const updateCurrentModeData = useCallback(
    (data: Partial<IMobileModeData>) => {
      setMobileModeData((prev) => ({
        ...prev,
        [amountInputMode]: {
          ...prev[amountInputMode],
          ...data,
        },
      }));
    },
    [amountInputMode],
  );

  const currentModeData = useMemo(
    () => mobileModeData[amountInputMode],
    [mobileModeData, amountInputMode],
  );

  // Per-sender balance data (ManyToOne/ManyToMany only)
  const [senderBalances, setSenderBalances] = useState<Record<string, string>>(
    {},
  );
  const [senderBalancesLoading, setSenderBalancesLoading] = useState(false);
  const [senderBalancesFailed, setSenderBalancesFailed] = useState<Set<string>>(
    new Set(),
  );
  // Whether any fetched sender token detail carries a scaled-UI multiplier.
  // The senderBalances map itself only keeps raw balanceParsed, so this flag
  // is the only trace of the multiplier on the ManyToOne/ManyToMany path.
  const [senderHasScaledUiToken, setSenderHasScaledUiToken] = useState(false);
  const buildSenderBalanceAddressKey = useCallback(
    (address: string) => {
      const trimmedAddress = address.trim();
      if (networkUtils.isEvmNetwork({ networkId })) {
        return trimmedAddress.toLowerCase();
      }
      return trimmedAddress;
    },
    [networkId],
  );

  // Recalculate mobile mode totals when transfersInfo or token price changes
  useEffect(() => {
    if (!matchedTokenDetails) return;

    setMobileModeData((prev) => {
      const modeData = prev[amountInputMode];
      if (modeData.transfersInfo.length === 0) return prev;

      const resolvedModeTransfersInfo =
        !isOneToMany && isMaxMode
          ? modeData.transfersInfo.map((transfer) => ({
              ...transfer,
              amount: senderBalances[transfer.from] ?? '0',
            }))
          : modeData.transfersInfo;

      const {
        totalTokenAmount: modeTotalToken,
        totalFiatAmount: modeTotalFiat,
      } = calculateTotalAmounts({
        transfersInfo: resolvedModeTransfersInfo,
        tokenPrice: matchedTokenDetails.price,
      });
      const modeIsInsufficient = isOneToMany
        ? new BigNumber(modeTotalToken).gt(
            displayBalance ?? matchedTokenDetails.balanceParsed,
          )
        : !isMaxMode &&
          checkSenderInsufficientBalance({
            transfersInfo: modeData.transfersInfo,
            senderBalances,
          });

      if (
        modeData.totalTokenAmount === modeTotalToken &&
        modeData.totalFiatAmount === modeTotalFiat &&
        modeData.isInsufficientBalance === modeIsInsufficient
      ) {
        return prev;
      }

      return {
        ...prev,
        [amountInputMode]: {
          ...modeData,
          totalTokenAmount: modeTotalToken,
          totalFiatAmount: modeTotalFiat,
          isInsufficientBalance: modeIsInsufficient,
        },
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentModeData.transfersInfo,
    amountInputMode,
    isOneToMany,
    isMaxMode,
    senderBalances,
    matchedTokenDetails?.price,
    matchedTokenDetails?.balanceParsed,
    displayBalance,
  ]);

  const isAmountValid = useMemo(
    () =>
      calculateIsAmountValid({
        amountInputMode,
        amountInputErrors,
        amountInputValues,
        transferInfoErrors,
      }),
    [amountInputMode, amountInputErrors, amountInputValues, transferInfoErrors],
  );

  const { result: outerVaultSettings } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceNetwork.getVaultSettings({ networkId }),
    [networkId],
  );

  const minTransferAmount = useMemo(() => {
    return getBulkSendMinTransferAmount({
      vaultSettings: outerVaultSettings,
      isNative: tokenInfo?.isNative,
    });
  }, [outerVaultSettings, tokenInfo?.isNative]);
  const minTransferDisplayAmount = useMemo(
    () =>
      getBulkSendMinTransferDisplayAmount({
        minTransferAmount,
        tokenDecimals: tokenInfo?.decimals,
      }),
    [minTransferAmount, tokenInfo?.decimals],
  );
  const shouldValidateInitialAmountsRef = useRef(false);

  const [isInsufficientBalance, setIsInsufficientBalance] = useState(false);

  const [intervalSettings, setIntervalSettings] = useState<IIntervalSettings>(
    DEFAULT_INTERVAL_SETTINGS,
  );

  // Per-sender accountId map (address -> accountId) from route params
  const senderAccountIdMap = useMemo(() => {
    const map = new Map<string, string>();
    senders?.forEach((s) => {
      if (s.accountId) map.set(s.address, s.accountId);
    });
    return map;
  }, [senders]);

  // ManyToOne/ManyToMany with a scaled-UI token: sender balances arrive raw
  // with the multiplier stripped, so display-basis input cannot be converted
  // per sender. Fail closed at submit (same policy as private send) instead
  // of building txs that would move multiplier× the intended amount. A
  // multiplier of exactly 1 is a no-op (raw == display) and must not block.
  const isScaledUiUnsupported = useMemo(
    () =>
      !isOneToMany &&
      (senderHasScaledUiToken ||
        tokenRebaseUtils.isScalingBalanceMultiplier(rebaseMultiplier)),
    [isOneToMany, senderHasScaledUiToken, rebaseMultiplier],
  );

  const validateSpecifiedAmountValue = useCallback(
    (specifiedAmount: string): IAmountInputError => {
      const balance = displayBalance ?? '0';
      const minTransferAmountBN = new BigNumber(minTransferAmount);
      const valueBN = new BigNumber(specifiedAmount || '0');

      if (
        !minTransferAmountBN.isZero() &&
        !valueBN.isZero() &&
        !valueBN.isNaN() &&
        valueBN.isLessThan(minTransferAmountBN)
      ) {
        return {
          specifiedAmount: intl.formatMessage(
            { id: ETranslations.send_error_minimum_amount },
            {
              amount: minTransferDisplayAmount,
              token: tokenInfo.symbol,
            },
          ),
        };
      }

      const { error } = validateTokenAmount({
        token: tokenInfo,
        amount: new BigNumber(specifiedAmount || '0')
          .times(transfersInfo.length)
          .toFixed(),
        maxAmount: isOneToMany ? balance : undefined,
        allowZero: false,
        customErrorMessages: {
          maxAmount: intl.formatMessage({
            id: ETranslations.swap_page_button_insufficient_balance,
          }),
          zeroAmount: intl.formatMessage({
            id: ETranslations.wallet_bulk_send_error_amount_zero,
          }),
          decimalPlaces: intl.formatMessage(
            {
              id: ETranslations.wallet_bulk_send_error_max_decimal_places,
            },
            { decimals: tokenInfo.decimals },
          ),
        },
      });

      return error ? { specifiedAmount: error } : {};
    },
    [
      intl,
      isOneToMany,
      minTransferAmount,
      minTransferDisplayAmount,
      displayBalance,
      tokenInfo,
      transfersInfo.length,
    ],
  );

  const validateRangeAmountValue = useCallback((): IAmountInputError => {
    // For OneToMany, use the single account balance.
    // For ManyToMany/ManyToOne, use the minimum sender balance so range min
    // doesn't exceed any sender's balance.
    let balance: string | undefined;
    if (isOneToMany) {
      balance = displayBalance ?? '0';
    } else {
      const balanceValues = Object.values(senderBalances);
      if (balanceValues.length > 0) {
        balance = balanceValues.reduce((min, val) =>
          new BigNumber(val).lt(min) ? val : min,
        );
      }
    }
    const error = validateRangeInput({
      rangeMin: amountInputValues.rangeMin,
      rangeMax: amountInputValues.rangeMax,
      balance,
      minTransferAmount,
      tokenSymbol: tokenInfo.symbol,
      tokenDecimals: tokenInfo.decimals,
      intl,
    });

    return error ? { rangeError: error } : {};
  }, [
    amountInputValues.rangeMax,
    amountInputValues.rangeMin,
    isOneToMany,
    minTransferAmount,
    senderBalances,
    displayBalance,
    tokenInfo.decimals,
    tokenInfo.symbol,
    intl,
  ]);

  const validateCustomTransfers = useCallback(
    (items: ITransferInfo[]): ITransferInfoErrors => {
      const errors: ITransferInfoErrors = {};

      items.forEach((transfer, index) => {
        const { isValid, error } = validateTokenAmount({
          token: tokenInfo,
          amount: transfer.amount,
          allowZero: false,
          minAmount:
            minTransferAmount && minTransferAmount !== '0'
              ? minTransferAmount
              : undefined,
          customErrorMessages: {
            zeroAmount: intl.formatMessage({
              id: ETranslations.wallet_bulk_send_error_amount_zero,
            }),
            decimalPlaces: intl.formatMessage(
              {
                id: ETranslations.wallet_bulk_send_error_max_decimal_places,
              },
              { decimals: tokenInfo.decimals },
            ),
            minAmount: intl.formatMessage(
              { id: ETranslations.send_error_minimum_amount },
              {
                amount: minTransferDisplayAmount,
                token: tokenInfo.symbol,
              },
            ),
          },
        });

        if (!isValid && error) {
          errors[index] = { amount: error };
        }
      });

      return errors;
    },
    [intl, minTransferAmount, minTransferDisplayAmount, tokenInfo],
  );

  const displaySummaryTransfersInfo = useMemo(
    () =>
      !isOneToMany && isMaxMode
        ? transfersInfo.map((transfer) => ({
            ...transfer,
            amount: senderBalances[transfer.from] ?? '0',
          }))
        : transfersInfo,
    [isOneToMany, isMaxMode, transfersInfo, senderBalances],
  );

  const { totalTokenAmount, totalFiatAmount } = useMemo(
    () =>
      calculateTotalAmounts({
        transfersInfo: displaySummaryTransfersInfo,
        tokenPrice: matchedTokenDetails?.price,
      }),
    [displaySummaryTransfersInfo, matchedTokenDetails?.price],
  );

  useEffect(() => {
    if (bulkSendMode === EBulkSendMode.OneToMany && matchedTokenDetails) {
      const totalTokenAmountBN = new BigNumber(totalTokenAmount ?? '0');
      setIsInsufficientBalance(
        totalTokenAmountBN.gt(
          displayBalance ?? matchedTokenDetails.balanceParsed,
        ),
      );
    }
  }, [matchedTokenDetails, totalTokenAmount, bulkSendMode, displayBalance]);

  usePromiseResult(
    async () => {
      if (
        bulkSendMode === EBulkSendMode.OneToMany &&
        accountId &&
        networkId &&
        tokenInfo
      ) {
        const requestId = tokenDetailsRequestIdRef.current + 1;
        tokenDetailsRequestIdRef.current = requestId;
        setTokenDetailsState((prev) => ({
          ...prev,
          isRefreshing: true,
        }));
        const [effectiveInscriptionProtection, vaultSettings] =
          await Promise.all([
            backgroundApiProxy.serviceSetting.getEffectiveInscriptionProtection(
              {
                networkId,
                accountId,
              },
            ),
            backgroundApiProxy.serviceNetwork.getVaultSettings({
              networkId,
            }),
          ]);
        const withCheckInscription =
          effectiveInscriptionProtection && vaultSettings.hasFrozenBalance;

        try {
          const resp = await backgroundApiProxy.serviceToken.fetchTokensDetails(
            {
              accountId,
              networkId,
              contractList: [tokenInfo.address],
              withFrozenBalance: true,
              withCheckInscription,
            },
          );

          if (tokenDetailsRequestIdRef.current !== requestId) {
            return;
          }

          if (
            resp[0] &&
            isBulkSendTokenDetailsMatched(
              {
                networkId,
                tokenInfo,
              },
              resp[0],
            )
          ) {
            setTokenDetails(resp[0]);
            setTokenDetailsState({
              initialized: true,
              isRefreshing: false,
            });
          } else {
            setTokenDetails(undefined);
          }
        } catch (_) {
          if (tokenDetailsRequestIdRef.current !== requestId) {
            return;
          }
          setTokenDetails(undefined);
        } finally {
          if (tokenDetailsRequestIdRef.current === requestId) {
            setTokenDetailsState({
              initialized: true,
              isRefreshing: false,
            });
          }
        }
      }
    },
    // The policy state is an intentional invalidation signal; bg computes the final value.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [
      networkId,
      accountId,
      tokenInfo,
      bulkSendMode,
      inscriptionProtectionState.localEnabled,
      inscriptionProtectionState.serverEnabled,
    ],
    {
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_TOKEN,
    },
  );

  // Fetch per-sender balances for ManyToOne/ManyToMany modes
  usePromiseResult(
    async () => {
      if (bulkSendMode === EBulkSendMode.OneToMany) return;
      if (!networkId || !tokenInfo || !senders || senders.length === 0) return;

      // Only fetch for senders that have accountId resolved
      const sendersWithAccountId = senders.filter((s) => s.accountId);
      if (sendersWithAccountId.length === 0) return;

      setSenderBalancesLoading(true);

      const fetchSenderBalancesLegacy = async () => {
        const vaultSettings =
          await backgroundApiProxy.serviceNetwork.getVaultSettings({
            networkId,
          });
        const balanceMap: Record<string, string> = {};
        const failedSet = new Set<string>();
        const limit = pLimit(5);

        await Promise.all(
          sendersWithAccountId.map((sender) =>
            limit(async () => {
              if (!sender.accountId) return;
              try {
                const withCheckInscription =
                  vaultSettings.hasFrozenBalance &&
                  (await backgroundApiProxy.serviceSetting.getEffectiveInscriptionProtection(
                    {
                      networkId,
                      accountId: sender.accountId,
                    },
                  ));
                const resp =
                  await backgroundApiProxy.serviceToken.fetchTokensDetails({
                    accountId: sender.accountId,
                    networkId,
                    contractList: [tokenInfo.address],
                    withFrozenBalance: true,
                    withCheckInscription,
                  });
                if (resp[0]) {
                  balanceMap[sender.address] = resp[0].balanceParsed;
                  if (
                    tokenRebaseUtils.isScalingBalanceMultiplier(
                      tokenRebaseUtils.pickBalanceMultiplier(resp[0]),
                    )
                  ) {
                    setSenderHasScaledUiToken(true);
                  }
                } else {
                  failedSet.add(sender.address);
                }
              } catch (_e) {
                failedSet.add(sender.address);
              }
            }),
          ),
        );

        return {
          balanceMap,
          failedSet,
        };
      };

      try {
        const isCustomNetwork =
          await backgroundApiProxy.serviceNetwork.isCustomNetwork({
            networkId,
          });

        if (isCustomNetwork) {
          const { balanceMap, failedSet } = await fetchSenderBalancesLegacy();
          setSenderBalances(balanceMap);
          setSenderBalancesFailed(failedSet);
          return;
        }

        const senderGroups = new Map<
          string,
          {
            queryAddress: string;
            originalAddresses: Set<string>;
          }
        >();

        sendersWithAccountId.forEach((sender) => {
          const addressKey = buildSenderBalanceAddressKey(sender.address);
          const existingGroup = senderGroups.get(addressKey);
          if (existingGroup) {
            existingGroup.originalAddresses.add(sender.address);
            return;
          }
          senderGroups.set(addressKey, {
            queryAddress: sender.address.trim(),
            originalAddresses: new Set([sender.address]),
          });
        });

        const balanceMap: Record<string, string> = {};
        const failedSet = new Set<string>();
        const batchBalancesByKey = new Map<string, string>();
        const batchAccountId =
          sendersWithAccountId.find((sender) => sender.accountId)?.accountId ??
          accountId ??
          '';

        const BATCH_CHUNK_SIZE = 50;
        const allGroups = Array.from(senderGroups.values());
        const groupChunks = chunk(allGroups, BATCH_CHUNK_SIZE);

        const chunkResults = await Promise.all(
          groupChunks.map((groupChunk) =>
            backgroundApiProxy.serviceToken.fetchTokensDetailsBatch({
              accountId: batchAccountId,
              networkId,
              contractList: [tokenInfo.address],
              queries: groupChunk.map((group) => ({
                accountAddress: group.queryAddress,
              })),
            }),
          ),
        );

        chunkResults.flat().forEach((item) => {
          const addressKey = buildSenderBalanceAddressKey(item.accountAddress);
          if (!senderGroups.has(addressKey)) {
            return;
          }
          if (batchBalancesByKey.has(addressKey)) {
            return;
          }
          const matchedToken = item.tokens.find((token) =>
            isBulkSendTokenDetailsMatched(
              {
                networkId,
                tokenInfo,
              },
              token,
            ),
          );
          if (matchedToken?.balanceParsed !== undefined) {
            batchBalancesByKey.set(addressKey, matchedToken.balanceParsed);
            if (
              tokenRebaseUtils.isScalingBalanceMultiplier(
                tokenRebaseUtils.pickBalanceMultiplier(matchedToken),
              )
            ) {
              setSenderHasScaledUiToken(true);
            }
          }
        });

        senderGroups.forEach(({ originalAddresses }, addressKey) => {
          const balance = batchBalancesByKey.get(addressKey);
          if (balance === undefined) {
            originalAddresses.forEach((address) => {
              failedSet.add(address);
            });
            return;
          }
          originalAddresses.forEach((address) => {
            balanceMap[address] = balance;
          });
        });

        setSenderBalances(balanceMap);
        setSenderBalancesFailed(failedSet);
      } catch (_e) {
        const allAddresses = new Set<string>();
        sendersWithAccountId.forEach((sender) => {
          allAddresses.add(sender.address);
        });
        setSenderBalances({});
        setSenderBalancesFailed(allAddresses);
      } finally {
        setSenderBalancesLoading(false);
      }
    },
    // The policy state is an intentional invalidation signal; bg computes the final value.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [
      networkId,
      tokenInfo,
      bulkSendMode,
      senders,
      accountId,
      buildSenderBalanceAddressKey,
      inscriptionProtectionState.localEnabled,
      inscriptionProtectionState.serverEnabled,
    ],
    {
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_TOKEN,
    },
  );

  // Per-sender balance validation for ManyToOne/ManyToMany
  // Aggregates amounts for duplicate senders before comparing to balance
  useEffect(() => {
    if (bulkSendMode === EBulkSendMode.OneToMany) return;
    if (isMaxMode) {
      setIsInsufficientBalance(false);
      return;
    }
    if (Object.keys(senderBalances).length === 0) return;

    setIsInsufficientBalance(
      checkSenderInsufficientBalance({ transfersInfo, senderBalances }),
    );
  }, [bulkSendMode, isMaxMode, senderBalances, transfersInfo]);

  useEffect(() => {
    // ITransferInfo.amount is display-basis while it lives on this page, so
    // strip any scaled-UI multiplier the route token happens to carry:
    // display leaves (BulkSendTxDetails / BulkSendProcessItem) re-derive
    // display amounts from tokenInfo.balanceMultiplier and must treat these
    // amounts as-is. The submit conversion stamps the snapshot multiplier
    // back at the moment amounts become raw, making "tokenInfo carries a
    // multiplier" synonymous with "amount is raw".
    const transferTokenInfo: IToken = {
      ...tokenInfo,
      balanceMultiplier: undefined,
    };
    const generateTransfersInfo = (): ITransferInfo[] => {
      switch (bulkSendMode) {
        case EBulkSendMode.OneToMany: {
          const sender = senders[0];
          if (!sender) return [];
          return receivers.map((receiver) => ({
            from: sender.address,
            to: receiver.address,
            amount: receiver.amount ?? '',
            tokenInfo: transferTokenInfo,
          }));
        }
        case EBulkSendMode.ManyToOne: {
          const receiver = receivers[0];
          if (!receiver) return [];
          return senders.map((sender) => ({
            from: sender.address,
            to: receiver.address,
            amount: sender.amount ?? '',
            tokenInfo: transferTokenInfo,
          }));
        }
        case EBulkSendMode.ManyToMany: {
          if (senders.length !== receivers.length) {
            throw new OneKeyLocalError(
              `ManyToMany mode requires equal senders and receivers count. Got ${senders.length} senders and ${receivers.length} receivers.`,
            );
          }
          return senders.map((sender, i) => ({
            from: sender.address,
            to: receivers[i].address,
            amount: receivers[i].amount ?? sender.amount ?? '',
            tokenInfo: transferTokenInfo,
          }));
        }
        default:
          return [];
      }
    };

    const _transfersInfo = generateTransfersInfo();

    const firstAmount = _transfersInfo[0]?.amount ?? '';
    if (_transfersInfo.every((transfer) => transfer.amount === firstAmount)) {
      setAmountInputMode(EAmountInputMode.Specified);
      if (firstAmount) {
        setAmountInputValues((prev) => ({
          ...prev,
          specifiedAmount: firstAmount,
        }));
      }
    } else {
      setAmountInputMode(EAmountInputMode.Custom);
    }

    if (bulkSendMode === EBulkSendMode.OneToMany) {
      setAmountInputValues((prev) => ({
        ...prev,
        rangeMin: '0',
        rangeMax: initialTokenDetails.balanceParsed,
      }));
    }

    setTransfersInfo(_transfersInfo);
    setAmountInputErrors({});
    setTransferInfoErrors({});

    // Custom mode starts with generated data; Specified/Range start empty
    setMobileModeData({
      [EAmountInputMode.Specified]: { ...defaultModeData },
      [EAmountInputMode.Range]: { ...defaultModeData },
      [EAmountInputMode.Custom]: {
        ...defaultModeData,
        transfersInfo: _transfersInfo,
      },
    });
    shouldValidateInitialAmountsRef.current = true;
  }, [
    bulkSendMode,
    senders,
    receivers,
    tokenInfo,
    initialTokenDetails?.balanceParsed,
    defaultModeData,
  ]);

  useEffect(() => {
    if (!shouldValidateInitialAmountsRef.current) {
      return;
    }
    if (!outerVaultSettings || transfersInfo.length === 0) {
      return;
    }

    if (amountInputMode === EAmountInputMode.Specified) {
      const nextAmountErrors = amountInputValues.specifiedAmount
        ? validateSpecifiedAmountValue(amountInputValues.specifiedAmount)
        : {};
      setAmountInputErrors(nextAmountErrors);
      setTransferInfoErrors({});
      updateCurrentModeData({ transferInfoErrors: {} });
    } else if (amountInputMode === EAmountInputMode.Range) {
      const nextAmountErrors =
        amountInputValues.rangeMin || amountInputValues.rangeMax
          ? validateRangeAmountValue()
          : {};
      setAmountInputErrors(nextAmountErrors);
      setTransferInfoErrors({});
      updateCurrentModeData({ transferInfoErrors: {} });
    } else if (amountInputMode === EAmountInputMode.Custom) {
      const nextTransferInfoErrors = validateCustomTransfers(transfersInfo);
      setTransferInfoErrors(nextTransferInfoErrors);
      updateCurrentModeData({
        transferInfoErrors: nextTransferInfoErrors,
      });
      setAmountInputErrors({});
    }

    shouldValidateInitialAmountsRef.current = false;
  }, [
    amountInputMode,
    amountInputValues.rangeMax,
    amountInputValues.rangeMin,
    amountInputValues.specifiedAmount,
    outerVaultSettings,
    transfersInfo,
    updateCurrentModeData,
    validateCustomTransfers,
    validateRangeAmountValue,
    validateSpecifiedAmountValue,
  ]);

  const context = useMemo<IBulkSendAmountsInputContext>(
    () => ({
      accountId,
      networkId,
      hasCustomAmounts,
      tokenInfo,
      tokenDetails: matchedTokenDetails,
      setTokenDetails,
      tokenDetailsState,
      setTokenDetailsState,
      bulkSendMode,
      isMaxMode,
      setIsMaxMode,
      transfersInfo,
      setTransfersInfo,
      amountInputMode,
      setAmountInputMode,
      amountInputValues,
      setAmountInputValues,
      amountInputErrors,
      setAmountInputErrors,
      transferInfoErrors,
      setTransferInfoErrors,
      isAmountValid,
      totalTokenAmount,
      totalFiatAmount,
      isInsufficientBalance,
      previewState,
      setPreviewState,
      mobileModeData,
      setMobileModeData,
      updateCurrentModeData,
      currentModeData,
      minTransferAmount,
      rebaseMultiplier,
      displayBalance,
      isScaledUiUnsupported,
      intervalSettings,
      setIntervalSettings,
      senderBalances,
      setSenderBalances,
      senderBalancesLoading,
      setSenderBalancesLoading,
      senderBalancesFailed,
      setSenderBalancesFailed,
      senderAccountIdMap,
      hasDuplicateSenders,
    }),
    [
      networkId,
      accountId,
      hasCustomAmounts,
      matchedTokenDetails,
      tokenDetailsState,
      bulkSendMode,
      isMaxMode,
      setIsMaxMode,
      transfersInfo,
      setTransfersInfo,
      amountInputMode,
      amountInputValues,
      amountInputErrors,
      transferInfoErrors,
      isAmountValid,
      tokenInfo,
      totalTokenAmount,
      totalFiatAmount,
      isInsufficientBalance,
      previewState,
      mobileModeData,
      updateCurrentModeData,
      currentModeData,
      minTransferAmount,
      rebaseMultiplier,
      displayBalance,
      isScaledUiUnsupported,
      intervalSettings,
      senderBalances,
      senderBalancesLoading,
      senderBalancesFailed,
      senderAccountIdMap,
      hasDuplicateSenders,
    ],
  );

  return (
    <BulkSendAmountsInputContext.Provider value={context}>
      <BaseBulkSendAmountsInput isInModal={isInModal} />
    </BulkSendAmountsInputContext.Provider>
  );
}

function BulkSendAmountsInput() {
  const route = useAppRoute<
    IModalBulkSendParamList,
    EModalBulkSendRoutes.BulkSendAmountsInput
  >();

  const params = route.params;
  const hasRequiredParams = Boolean(
    params?.networkId &&
    params?.senders?.length &&
    params?.receivers?.length &&
    params?.tokenInfo &&
    params?.bulkSendMode,
  );

  useRedirectToBulkSendAddressesInput({
    networkId: params?.networkId,
    accountId: params?.accountId,
    tokenInfo: params?.tokenInfo,
    isInModal: params?.isInModal,
    bulkSendMode: params?.bulkSendMode,
    hasRequiredParams,
  });

  if (!hasRequiredParams || !params) {
    return null;
  }

  return <BulkSendAmountsInputContent {...params} />;
}

export default BulkSendAmountsInput;
