import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';
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
    currentModeData,
    updateCurrentModeData,
  } = useBulkSendAmountsInputContext();

  const intl = useIntl();
  const navigation = useAppNavigation();

  const media = useMedia();

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
    balance: tokenDetails?.balanceParsed,
  });

  // Mobile-only: preview mode means TransactionDetail is visible for Specified/Range
  const isInPreviewMode =
    !media.gtMd &&
    amountInputMode !== EAmountInputMode.Custom &&
    shouldShowTxDetails(amountInputMode);

  // Check if token needs approval (native tokens don't need approval)
  const needsApproval = useMemo(
    () =>
      tokenInfo &&
      !tokenInfo.isNative &&
      bulkSendMode === EBulkSendMode.OneToMany &&
      transfersInfo.length > 1,
    [tokenInfo, bulkSendMode, transfersInfo.length],
  );

  const bulkSendContractAddress = useMemo(() => {
    const addresses = getBulkSendContractAddress();
    return addresses[networkId];
  }, [networkId]);

  const handleSubmit = useCallback(async () => {
    if (bulkSendMode !== EBulkSendMode.OneToMany) return;
    if (!accountId || !networkId || !tokenInfo || !bulkSendContractAddress)
      return;

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

    setIsBuilding(true);

    // Mobile uses mode-specific data; desktop uses shared data
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
    const baseConditions =
      !tokenDetailsState.initialized ||
      (tokenDetailsState.isRefreshing && !tokenDetails) ||
      isBuilding ||
      !bulkSendContractAddress;

    if (baseConditions) return true;

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
    bulkSendContractAddress,
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
    } else if (amountInputMode === EAmountInputMode.Custom) {
      hasInsufficientBalance = isInsufficientBalance;
    }

    if (hasInsufficientBalance) {
      return intl.formatMessage({
        id: ETranslations.swap_page_button_insufficient_balance,
      });
    }

    if (media.gtMd || isInPreviewMode) {
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
  ]);

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

  const hasCustomAmounts = useMemo(
    () =>
      receivers?.some((r) => r.amount !== undefined && r.amount !== '') ??
      false,
    [receivers],
  );

  // Redirect if required parameters are missing
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

  const [amountInputValues, setAmountInputValues] =
    useState<IAmountInputValues>({
      specifiedAmount: '',
      rangeMin: '',
      rangeMax: '',
    });

  const [amountInputErrors, setAmountInputErrors] = useState<IAmountInputError>(
    {},
  );

  const [transferInfoErrors, setTransferInfoErrors] =
    useState<ITransferInfoErrors>({});

  const [transfersInfo, setTransfersInfo] = useState<ITransferInfo[]>([]);

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

  // Recalculate mobile mode totals when transfersInfo or token price changes
  useEffect(() => {
    if (!tokenDetails) return;

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

    // Custom mode starts with generated data; Specified/Range start empty
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
