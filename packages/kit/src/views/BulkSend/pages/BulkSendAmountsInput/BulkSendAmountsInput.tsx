import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';
import pLimit from 'p-limit';
import { useIntl } from 'react-intl';
import { Keyboard } from 'react-native';

import {
  NumberSizeableText,
  Page,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
  calculateIsAmountValid,
  calculateTotalAmounts,
  checkSenderInsufficientBalance,
  getBulkSendMinTransferAmount,
  getBulkSendMinTransferDisplayAmount,
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
  } = useBulkSendAmountsInputContext();

  const isOneToMany = bulkSendMode === EBulkSendMode.OneToMany;
  const shouldHideMaxMode = !isOneToMany && hasDuplicateSenders;

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
    balance: isOneToMany ? tokenDetails?.balanceParsed : undefined,
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
      const reviewParams = media.gtMd
        ? { ...params, intervalSettings }
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

      const unsignedTxs: IUnsignedTxPro[] = [];
      const approvesInfo: IApproveInfo[] = [];

      let ataCount: number | undefined;

      if (isNativeBatchTransfer) {
        // Native batch: no approvals, use vault's splitting method
        const batchResult =
          await backgroundApiProxy.serviceSend.buildBulkSendUnsignedTxs({
            networkId,
            accountId,
            transfersInfo: effectiveTransfersInfo,
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
              amount: effectiveTotalTokenAmount,
            });

          if (!allowanceResponse?.isApproved) {
            const baseTokenInfo = {
              ...tokenInfo,
              isNative: !!tokenInfo.isNative,
              name: tokenInfo.name ?? tokenInfo.symbol,
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
              amount: effectiveTotalTokenAmount,
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
            transfersInfo: effectiveTransfersInfo,
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
        transfersInfo: effectiveTransfersInfo,
        bulkSendMode,
        isInModal,
        totalTokenAmount: effectiveTotalTokenAmount,
        totalFiatAmount: effectiveTotalFiatAmount,
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
    bulkSendContractAddress,
    isNativeBatchTransfer,
    needsApproval,
    bulkSendMode,
    isInModal,
    getEffectiveData,
    navigateToReviewOrInterval,
  ]);

  // Submit handler for ManyToOne / ManyToMany modes
  const handleSubmitManyToManyOrManyToOne = useCallback(async () => {
    if (!accountId || !networkId || !tokenInfo) return;

    setIsBuilding(true);

    const {
      effectiveTransfersInfo,
      effectiveTotalTokenAmount,
      effectiveTotalFiatAmount,
    } = getEffectiveData();

    try {
      // Resolve Max mode amounts from sender balances
      const resolvedTransfersInfo = isMaxMode
        ? effectiveTransfersInfo.map((transfer) => ({
            ...transfer,
            amount: senderBalances[transfer.from] ?? '0',
          }))
        : effectiveTransfersInfo;

      // Recalculate totals for Max mode
      let finalTotalTokenAmount = effectiveTotalTokenAmount;
      let finalTotalFiatAmount = effectiveTotalFiatAmount;
      if (isMaxMode && tokenDetails?.price) {
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
        isMaxMode,
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

    return !isAmountValid || isInsufficientBalance;
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
    if (!tokenInfo) return;
    if (amountInputMode !== EAmountInputMode.Specified) return;

    // Non-OneToMany: toggle Max mode (send full balance per sender)
    if (!isOneToMany) {
      setIsMaxMode(!isMaxMode);
      return;
    }

    // OneToMany: calculate max amount per address from balance
    const balance = tokenDetails?.balanceParsed ?? '0';
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
                  !shouldHideMaxMode
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
  const hasCustomAmounts = useMemo(
    () =>
      (receivers?.some((r) => r.amount !== undefined && r.amount !== '') ||
        senders?.some((s) => s.amount !== undefined && s.amount !== '')) ??
      false,
    [receivers, senders],
  );
  const isOneToMany = bulkSendMode === EBulkSendMode.OneToMany;

  const [tokenDetails, setTokenDetails] = useState<
    ({ info: IToken } & ITokenFiat) | undefined
  >(initialTokenDetails);
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
    if (bulkSendMode !== EBulkSendMode.ManyToMany) return false;
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

  // Recalculate mobile mode totals when transfersInfo or token price changes
  useEffect(() => {
    if (!tokenDetails) return;

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
        tokenPrice: tokenDetails.price,
      });
      const modeIsInsufficient = isOneToMany
        ? new BigNumber(modeTotalToken).gt(tokenDetails.balanceParsed)
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
    tokenDetails?.price,
    tokenDetails?.balanceParsed,
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

  const [intervalSettings, setIntervalSettings] = useState<IIntervalSettings>({
    mode: EIntervalMode.None,
    minSeconds: '',
    maxSeconds: '',
  });

  // Per-sender accountId map (address -> accountId) from route params
  const senderAccountIdMap = useMemo(() => {
    const map = new Map<string, string>();
    senders?.forEach((s) => {
      if (s.accountId) map.set(s.address, s.accountId);
    });
    return map;
  }, [senders]);

  const validateSpecifiedAmountValue = useCallback(
    (specifiedAmount: string): IAmountInputError => {
      const balance = tokenDetails?.balanceParsed ?? '0';
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
      tokenDetails?.balanceParsed,
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
      balance = tokenDetails?.balanceParsed ?? '0';
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
    });

    return error ? { rangeError: error } : {};
  }, [
    amountInputValues.rangeMax,
    amountInputValues.rangeMin,
    isOneToMany,
    minTransferAmount,
    senderBalances,
    tokenDetails?.balanceParsed,
    tokenInfo.decimals,
    tokenInfo.symbol,
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
        tokenPrice: tokenDetails?.price,
      }),
    [displaySummaryTransfersInfo, tokenDetails?.price],
  );

  useEffect(() => {
    if (bulkSendMode === EBulkSendMode.OneToMany && tokenDetails) {
      const totalTokenAmountBN = new BigNumber(totalTokenAmount ?? '0');
      setIsInsufficientBalance(
        totalTokenAmountBN.gt(tokenDetails.balanceParsed),
      );
    }
  }, [tokenDetails, totalTokenAmount, bulkSendMode]);

  usePromiseResult(
    async () => {
      if (
        bulkSendMode === EBulkSendMode.OneToMany &&
        accountId &&
        networkId &&
        tokenInfo
      ) {
        setTokenDetailsState((prev) => ({
          ...prev,
          isRefreshing: true,
        }));
        const [checkInscriptionProtectionEnabled, vaultSettings] =
          await Promise.all([
            backgroundApiProxy.serviceSetting.checkInscriptionProtectionEnabled(
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
          checkInscriptionProtectionEnabled && vaultSettings.hasFrozenBalance;

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

          if (resp[0]) {
            setTokenDetails(resp[0]);
            setTokenDetailsState({
              initialized: true,
              isRefreshing: false,
            });
          } else {
            setTokenDetails(undefined);
          }
        } catch (_) {
          setTokenDetails(undefined);
        } finally {
          setTokenDetailsState({
            initialized: true,
            isRefreshing: false,
          });
        }
      }
    },
    [networkId, accountId, tokenInfo, bulkSendMode],
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

      const vaultSettings =
        await backgroundApiProxy.serviceNetwork.getVaultSettings({
          networkId,
        });

      const balanceMap: Record<string, string> = {};
      const failedSet = new Set<string>();
      const limit = pLimit(5);

      try {
        await Promise.all(
          sendersWithAccountId.map((sender) =>
            limit(async () => {
              if (!sender.accountId) return;
              try {
                const withCheckInscription =
                  vaultSettings.hasFrozenBalance &&
                  (await backgroundApiProxy.serviceSetting.checkInscriptionProtectionEnabled(
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
                } else {
                  failedSet.add(sender.address);
                }
              } catch (_e) {
                failedSet.add(sender.address);
              }
            }),
          ),
        );
      } finally {
        setSenderBalances(balanceMap);
        setSenderBalancesFailed(failedSet);
        setSenderBalancesLoading(false);
      }
    },
    [networkId, tokenInfo, bulkSendMode, senders],
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
    const generateTransfersInfo = (): ITransferInfo[] => {
      switch (bulkSendMode) {
        case EBulkSendMode.OneToMany: {
          const sender = senders[0];
          if (!sender) return [];
          return receivers.map((receiver) => ({
            from: sender.address,
            to: receiver.address,
            amount: receiver.amount ?? '',
            tokenInfo,
          }));
        }
        case EBulkSendMode.ManyToOne: {
          const receiver = receivers[0];
          if (!receiver) return [];
          return senders.map((sender) => ({
            from: sender.address,
            to: receiver.address,
            amount: sender.amount ?? '',
            tokenInfo,
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
            tokenInfo,
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
      tokenDetails,
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
      tokenDetails,
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
