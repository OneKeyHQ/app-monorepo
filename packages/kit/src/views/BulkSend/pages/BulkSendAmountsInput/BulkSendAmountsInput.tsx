import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import {
  NumberSizeableText,
  Page,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
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
import {
  EModalBulkSendRoutes,
  EModalRoutes,
  ETabHomeRoutes,
  type IModalBulkSendParamList,
} from '@onekeyhq/shared/src/routes';
import {
  EAmountInputMode,
  EBulkSendMode,
  type IAmountInputError,
  type IAmountInputValues,
  type ITransferInfoErrors,
} from '@onekeyhq/shared/types/bulkSend';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import BulkSendBar from '../../components/BulkSendBar';
import BulkSendContentWrapper from '../../components/BulkSendContentWrapper';
import BulkSendHeader from '../../components/BulkSendHeader';
import { calculateIsAmountValid, calculateTotalAmounts } from '../../utils';

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
    // Mobile-specific
    currentModeData,
    updateCurrentModeData,
  } = useBulkSendAmountsInputContext();

  const intl = useIntl();
  const navigation = useAppNavigation();

  const media = useMedia();

  const [settings] = useSettingsPersistAtom();

  const [isBuilding, setIsBuilding] = useState(false);

  // For mobile Specified/Range modes, we need to update both shared and mode-specific data
  // when handlePreview generates new amounts
  const setTransfersInfoWithModeUpdate = useCallback(
    (newTransfersInfo: ITransferInfo[]) => {
      setTransfersInfo(newTransfersInfo);
      // Also update mode-specific data for mobile
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
    balance: tokenDetails?.balanceParsed,
  });

  // Check if we're in preview mode (TransactionDetail is shown for Specified/Range)
  // Only applies to mobile view
  const isInPreviewMode =
    !media.gtMd &&
    amountInputMode !== EAmountInputMode.Custom &&
    shouldShowTxDetails(amountInputMode);

  // Check if token needs approval (native tokens don't need approval)
  const needsApproval = useMemo(
    () => tokenInfo && !tokenInfo.isNative,
    [tokenInfo],
  );

  // Get BulkSend contract address for current network
  const bulkSendContractAddress = useMemo(() => {
    const addresses = getBulkSendContractAddress();
    return addresses[networkId];
  }, [networkId]);

  const handleSubmit = useCallback(async () => {
    if (bulkSendMode !== EBulkSendMode.OneToMany) return;
    if (!accountId || !networkId || !tokenInfo || !bulkSendContractAddress)
      return;

    // For mobile view only: Specified/Range mode requires preview step
    // Desktop (gtMd) skips preview and goes directly to review
    if (
      !media.gtMd &&
      amountInputMode !== EAmountInputMode.Custom &&
      !shouldShowTxDetails(amountInputMode)
    ) {
      handlePreview(
        amountInputMode,
        amountInputValues,
        amountInputMode === EAmountInputMode.Range
          ? previewState.rangePreviewAmounts
          : undefined,
      );
      return;
    }

    setIsBuilding(true);

    // For mobile, use mode-specific data; for desktop, use shared data
    const effectiveTransfersInfo = !media.gtMd
      ? currentModeData.transfersInfo
      : transfersInfo;
    const effectiveTotalTokenAmount = !media.gtMd
      ? currentModeData.totalTokenAmount
      : totalTokenAmount;
    const effectiveTotalFiatAmount = !media.gtMd
      ? currentModeData.totalFiatAmount
      : totalFiatAmount;

    try {
      const sender = effectiveTransfersInfo[0]?.from;
      if (!sender) return;

      const approvesInfo: IApproveInfo[] = [];

      // Check if token needs approval (native tokens don't need approval)
      if (needsApproval) {
        // Fetch current allowance using swap service
        const allowanceResponse =
          await backgroundApiProxy.serviceSwap.fetchApproveAllowance({
            networkId,
            tokenAddress: tokenInfo.address,
            spenderAddress: bulkSendContractAddress,
            walletAddress: sender,
            accountId,
            amount: effectiveTotalTokenAmount,
          });

        // If not approved or allowance is insufficient, prepare approve info
        if (!allowanceResponse?.isApproved) {
          const baseTokenInfo = {
            ...tokenInfo,
            isNative: !!tokenInfo.isNative,
            name: tokenInfo.name ?? tokenInfo.symbol,
          };

          // Handle USDT-like tokens that require reset approval first
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

      const unsignedTxs: IUnsignedTxPro[] = [];
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

      const params = {
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
      };

      if (isInModal) {
        navigation.push(EModalBulkSendRoutes.BulkSendReview, params);
      } else {
        navigation.pushModal(EModalRoutes.BulkSendModal, {
          screen: EModalBulkSendRoutes.BulkSendReview,
          params,
        });
      }
    } catch (error) {
      console.error('Failed to build transactions:', error);
    } finally {
      setIsBuilding(false);
    }
  }, [
    bulkSendMode,
    accountId,
    networkId,
    tokenInfo,
    bulkSendContractAddress,
    transfersInfo,
    needsApproval,
    totalTokenAmount,
    totalFiatAmount,
    isInModal,
    navigation,
    amountInputMode,
    amountInputValues,
    shouldShowTxDetails,
    handlePreview,
    media.gtMd,
    currentModeData.transfersInfo,
    currentModeData.totalTokenAmount,
    currentModeData.totalFiatAmount,
    previewState.rangePreviewAmounts,
  ]);

  const isSubmitDisabled = useMemo(() => {
    // Base conditions that always apply
    const baseConditions =
      !tokenDetailsState.initialized ||
      (tokenDetailsState.isRefreshing && !tokenDetails) ||
      isBuilding ||
      !bulkSendContractAddress;

    if (baseConditions) return true;

    // For mobile view:
    if (!media.gtMd) {
      // Issue 1: In Specified/Range modes, if already in preview mode (Transaction Detail shown),
      // allow proceeding even if input has validation errors - use already generated Transfer Info
      if (isInPreviewMode) {
        // In preview mode, check mode-specific insufficient balance
        return currentModeData.isInsufficientBalance;
      }

      // Issue 2: In Custom mode, check mode-specific transferInfoErrors
      if (amountInputMode === EAmountInputMode.Custom) {
        const hasTransferErrors = !isEmpty(currentModeData.transferInfoErrors);
        return (
          hasTransferErrors ||
          currentModeData.isInsufficientBalance ||
          currentModeData.transfersInfo.length === 0
        );
      }
    }

    // Default validation for desktop and mobile non-preview modes
    return !isAmountValid || isInsufficientBalance;
  }, [
    tokenDetailsState.initialized,
    tokenDetailsState.isRefreshing,
    tokenDetails,
    isAmountValid,
    isInsufficientBalance,
    isBuilding,
    bulkSendContractAddress,
    media.gtMd,
    isInPreviewMode,
    amountInputMode,
    currentModeData.isInsufficientBalance,
    currentModeData.transferInfoErrors,
    currentModeData.transfersInfo.length,
  ]);

  // Determine button text based on preview state and insufficient balance
  const confirmButtonText = useMemo(() => {
    // Only show "Insufficient Balance" in Custom mode
    const hasInsufficientBalance = !media.gtMd
      ? amountInputMode === EAmountInputMode.Custom || isInPreviewMode
        ? currentModeData.isInsufficientBalance
        : false
      : amountInputMode === EAmountInputMode.Custom && isInsufficientBalance;

    if (hasInsufficientBalance) {
      return intl.formatMessage({
        id: ETranslations.swap_page_button_insufficient_balance,
      });
    }
    // Desktop: always show "Review" (no preview mode, goes directly to review page)
    // Mobile: show "Review" only after preview, otherwise show "Next"
    if (media.gtMd) {
      return intl.formatMessage({
        id: ETranslations.wallet_bulk_send_btn_review,
      });
    }
    return isInPreviewMode
      ? intl.formatMessage({ id: ETranslations.wallet_bulk_send_btn_review })
      : intl.formatMessage({ id: ETranslations.wallet_bulk_send_btn_next });
  }, [
    intl,
    media.gtMd,
    amountInputMode,
    isInPreviewMode,
    currentModeData.isInsufficientBalance,
    isInsufficientBalance,
  ]);

  // Handle Max button press - fills in max amount per address
  const handleMaxPress = useCallback(() => {
    if (!tokenInfo) return;
    if (amountInputMode !== EAmountInputMode.Specified) return;
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
    // Clear any existing errors since max amount is always valid
    setAmountInputErrors({
      ...amountInputErrors,
      specifiedAmount: undefined,
    });
  }, [
    amountInputMode,
    tokenDetails?.balanceParsed,
    transfersInfo.length,
    setAmountInputValues,
    amountInputValues,
    tokenInfo,
    setAmountInputErrors,
    amountInputErrors,
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
              // Desktop: Show Total amount on the left
              <YStack gap="$1">
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
              // Mobile: Show AmountPreview
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
                  amountInputMode === EAmountInputMode.Specified
                    ? handleMaxPress
                    : undefined
                }
                isInsufficientBalance={
                  amountInputMode === EAmountInputMode.Custom || isInPreviewMode
                    ? currentModeData.isInsufficientBalance
                    : false
                }
              />
            )}
          </Page.FooterActions>
        </BulkSendContentWrapper>
      </Page.Footer>
    </Page>
  );
}

function BulkSendAmountsInput() {
  const navigation = useAppNavigation();

  const route = useAppRoute<
    IModalBulkSendParamList,
    EModalBulkSendRoutes.BulkSendAmountsInput
  >();

  const {
    networkId,
    accountId,
    senders,
    receivers,
    tokenInfo,
    tokenDetails: initialTokenDetails,
    bulkSendMode,
    isInModal,
  } = route.params ?? {};

  // Check if receivers have custom amounts (from address input with "address,amount" format)
  const hasCustomAmounts = useMemo(
    () =>
      receivers?.some((r) => r.amount !== undefined && r.amount !== '') ??
      false,
    [receivers],
  );

  // Validate required parameters and redirect if missing
  useEffect(() => {
    const hasRequiredParams =
      networkId &&
      senders?.length > 0 &&
      receivers?.length > 0 &&
      tokenInfo &&
      bulkSendMode;

    if (!hasRequiredParams) {
      if (isInModal) {
        navigation.replace(EModalBulkSendRoutes.BulkSendAddressesInput, {
          networkId,
          accountId,
          indexedAccountId: undefined,
          tokenInfo,
          isInModal: true,
        });
      } else {
        navigation.replace(ETabHomeRoutes.TabHomeBulkSendAddressesInput, {
          networkId,
          accountId,
          indexedAccountId: undefined,
          tokenInfo,
          isInModal: false,
        });
      }
    }
  }, [
    networkId,
    accountId,
    senders,
    receivers,
    tokenInfo,
    bulkSendMode,
    isInModal,
    navigation,
  ]);

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

  // Amount input values state
  const [amountInputValues, setAmountInputValues] =
    useState<IAmountInputValues>({
      specifiedAmount: '',
      rangeMin: '',
      rangeMax: '',
    });

  // Amount input errors state
  const [amountInputErrors, setAmountInputErrors] = useState<IAmountInputError>(
    {},
  );

  // Transfer info errors state
  const [transferInfoErrors, setTransferInfoErrors] =
    useState<ITransferInfoErrors>({});

  const [transfersInfo, setTransfersInfo] = useState<ITransferInfo[]>([]);

  // Preview state for Specified/Range modes
  const [previewState, setPreviewState] = useState<IPreviewState>({
    specifiedPreviewed: false,
    rangePreviewed: false,
    rangePreviewAmounts: [],
  });

  // Mobile-specific: independent data for each mode
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

  // Helper to update current mode's data
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

  // Get current mode's data for mobile
  const currentModeData = useMemo(
    () => mobileModeData[amountInputMode],
    [mobileModeData, amountInputMode],
  );

  // Update mobile mode data with calculated values when transfersInfo changes
  // Use JSON.stringify to detect actual changes in transfersInfo array
  const currentModeTransfersInfoJson = JSON.stringify(
    currentModeData.transfersInfo.map((t) => ({ to: t.to, amount: t.amount })),
  );
  useEffect(() => {
    if (!tokenDetails) return;

    // Use functional update to avoid race conditions - read latest state inside setState
    setMobileModeData((prev) => {
      const modeData = prev[amountInputMode];
      if (modeData.transfersInfo.length === 0) return prev;

      const {
        totalTokenAmount: modeTotalToken,
        totalFiatAmount: modeTotalFiat,
      } = calculateTotalAmounts({
        transfersInfo: modeData.transfersInfo,
        tokenPrice: tokenDetails.price,
      });
      const modeIsInsufficient = new BigNumber(modeTotalToken).gt(
        tokenDetails.balanceParsed,
      );

      // Only update if values actually changed
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
    currentModeTransfersInfoJson,
    amountInputMode,
    tokenDetails?.price,
    tokenDetails?.balanceParsed,
  ]);

  // Calculate if current mode is valid using shared logic
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

  const [isInsufficientBalance, setIsInsufficientBalance] = useState(false);

  const { totalTokenAmount, totalFiatAmount } = useMemo(
    () =>
      calculateTotalAmounts({
        transfersInfo,
        tokenPrice: tokenDetails?.price,
      }),
    [transfersInfo, tokenDetails?.price],
  );

  useEffect(() => {
    if (bulkSendMode === EBulkSendMode.OneToMany && tokenDetails) {
      const totalTokenAmountBN = new BigNumber(totalTokenAmount ?? '0');
      setIsInsufficientBalance(
        totalTokenAmountBN.gt(tokenDetails.balanceParsed),
      );
    }
  }, [
    totalTokenAmount,
    tokenDetails?.balanceParsed,
    bulkSendMode,
    tokenDetails,
  ]);

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

    // Initialize mobile mode data for all three modes
    // Custom mode uses the generated transfersInfo
    // Specified and Range modes start with empty data (populated on Preview)
    setMobileModeData({
      [EAmountInputMode.Specified]: { ...defaultModeData },
      [EAmountInputMode.Range]: { ...defaultModeData },
      [EAmountInputMode.Custom]: {
        ...defaultModeData,
        transfersInfo: _transfersInfo,
      },
    });
  }, [
    bulkSendMode,
    senders,
    receivers,
    tokenInfo,
    initialTokenDetails?.balanceParsed,
    defaultModeData,
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
      // Mobile-specific
      mobileModeData,
      setMobileModeData,
      updateCurrentModeData,
      currentModeData,
    }),
    [
      networkId,
      accountId,
      hasCustomAmounts,
      tokenDetails,
      tokenDetailsState,
      bulkSendMode,
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
    ],
  );

  return (
    <BulkSendAmountsInputContext.Provider value={context}>
      <BaseBulkSendAmountsInput isInModal={isInModal} />
    </BulkSendAmountsInputContext.Provider>
  );
}

export default BulkSendAmountsInput;
