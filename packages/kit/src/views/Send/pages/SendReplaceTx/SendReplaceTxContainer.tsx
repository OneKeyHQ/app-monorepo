import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { cloneDeep, isNil } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Alert,
  Dialog,
  Icon,
  IconButton,
  NumberSizeableText,
  Page,
  SizableText,
  Spinner,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { calculateFeeForSend } from '@onekeyhq/kit/src/utils/gasFee';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { REPLACE_TX_FEE_UP_RATIO } from '@onekeyhq/shared/src/consts/walletConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSendRoutes,
  IModalSendParamList,
} from '@onekeyhq/shared/src/routes';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import { calculateNativeAmountInActions } from '@onekeyhq/shared/src/utils/txActionUtils';
import type {
  IFeeInfoUnit,
  ISendSelectedFeeInfo,
} from '@onekeyhq/shared/types/fee';
import { EFeeType } from '@onekeyhq/shared/types/fee';
import { EReplaceTxType } from '@onekeyhq/shared/types/tx';

import { FeeEditor } from '../../components/SendFee';
import { usePreCheckFeeInfo } from '../../hooks/usePreCheckFeeInfo';

import type { RouteProp } from '@react-navigation/core';

function SendReplaceTxContainer() {
  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.SendReplaceTx>>();

  const { accountId, networkId, replaceEncodedTx, replaceType, historyTx } =
    route.params;

  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();

  const intl = useIntl();
  const { network, account } = useAccountData({ accountId, networkId });

  const originalEncodedTx = historyTx.decodedTx.encodedTx as IEncodedTxEvm;
  const gasLimit = originalEncodedTx.gasLimit || originalEncodedTx.gas;

  // on chain value
  const { maxFeePerGas, maxPriorityFeePerGas, gasPrice } = originalEncodedTx;

  // on chain value to Gwei
  const originalMaxFeePerGas = useMemo(
    () =>
      maxFeePerGas && network
        ? chainValueUtils.convertChainValueToGwei({
            value: maxFeePerGas,
            network,
          })
        : undefined,
    [maxFeePerGas, network],
  );

  const originalMaxPriorityFeePerGas = useMemo(
    () =>
      maxPriorityFeePerGas && network
        ? chainValueUtils.convertChainValueToGwei({
            value: maxPriorityFeePerGas,
            network,
          })
        : undefined,
    [maxPriorityFeePerGas, network],
  );

  const originalGasPrice = useMemo(
    () =>
      gasPrice && network
        ? chainValueUtils.convertChainValueToGwei({
            value: gasPrice,
            network,
          })
        : undefined,
    [gasPrice, network],
  );

  const [settings] = useSettingsPersistAtom();

  const [feeInfo, setFeeInfo] = useState<IFeeInfoUnit | undefined>(undefined);
  const [isInit, setIsInit] = useState(false);
  const [isLoadingFeeInfo, setIsLoadingFeeInfo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEstimateFeeInit = useRef(false);

  const [feeInfoUsedAsRestBase, setFeeInfoUsedAsRestBase] = useState<{
    gasLimit: string | undefined;
    maxFeePerGas: string | undefined;
    maxPriorityFeePerGas: string | undefined;
    gasPrice: string | undefined;
  }>({
    gasLimit: undefined,
    maxFeePerGas: undefined,
    maxPriorityFeePerGas: undefined,
    gasPrice: undefined,
  });

  const [replaceFeeInfo, setReplaceFeeInfo] = useState<{
    gasLimit: string | undefined;
    maxFeePerGas: string | undefined;
    maxPriorityFeePerGas: string | undefined;
    gasPrice: string | undefined;
  }>({
    gasLimit: undefined,
    maxFeePerGas: undefined,
    maxPriorityFeePerGas: undefined,
    gasPrice: undefined,
  });

  const { result: nativeTokenDetails, isLoading: isLoadingTokenDetails } =
    usePromiseResult(
      async () => {
        if (!network) return;
        const nativeTokenAddress =
          await backgroundApiProxy.serviceToken.getNativeTokenAddress({
            networkId,
          });
        const checkInscriptionProtectionEnabled =
          await backgroundApiProxy.serviceSetting.checkInscriptionProtectionEnabled(
            {
              networkId,
              accountId,
            },
          );
        const withCheckInscription =
          checkInscriptionProtectionEnabled && settings.inscriptionProtection;
        const r = await backgroundApiProxy.serviceToken.fetchTokensDetails({
          networkId,
          accountId,
          contractList: [nativeTokenAddress],
          withFrozenBalance: true,
          withCheckInscription,
        });
        return r[0];
      },
      [accountId, network, networkId, settings.inscriptionProtection],
      { watchLoading: true },
    );

  useEffect(() => {
    const fetchFeeInfo = async () => {
      if (!account || !network || !isInit || isEstimateFeeInit.current) return;

      isEstimateFeeInit.current = true;

      setIsLoadingFeeInfo(true);

      const { encodedTx } =
        await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
          networkId,
          accountId,
          encodedTx: replaceEncodedTx,
        });

      const f = await backgroundApiProxy.serviceGas.estimateFee({
        accountId,
        networkId,
        accountAddress: account.address,
        encodedTx,
      });

      // Check if the current estimated fee is higher than the default replacement transaction fee.
      // If so replace it with the normal level of the current  estimated fee.
      if (
        f.gasEIP1559 &&
        f.gasEIP1559[1] &&
        replaceFeeInfo.maxFeePerGas &&
        replaceFeeInfo.maxPriorityFeePerGas
      ) {
        const normalFee = f.gasEIP1559[1];
        let shouldReplaceMaxFee = false;
        let shouldReplaceMaxPriorityFee = false;

        if (
          new BigNumber(normalFee.maxFeePerGas).isGreaterThan(
            replaceFeeInfo.maxFeePerGas,
          )
        ) {
          shouldReplaceMaxFee = true;
        }

        if (
          new BigNumber(normalFee.maxPriorityFeePerGas).isGreaterThan(
            replaceFeeInfo.maxPriorityFeePerGas,
          )
        ) {
          shouldReplaceMaxPriorityFee = true;
        }
        if (shouldReplaceMaxFee || shouldReplaceMaxPriorityFee) {
          setReplaceFeeInfo((prev) => ({
            ...prev,
            maxFeePerGas: shouldReplaceMaxFee
              ? normalFee.maxFeePerGas
              : prev.maxFeePerGas,
            maxPriorityFeePerGas: shouldReplaceMaxPriorityFee
              ? normalFee.maxPriorityFeePerGas
              : prev.maxPriorityFeePerGas,
          }));

          setFeeInfoUsedAsRestBase((prev) => ({
            ...prev,
            maxFeePerGas: shouldReplaceMaxFee
              ? normalFee.maxFeePerGas
              : prev.maxFeePerGas,
            maxPriorityFeePerGas: shouldReplaceMaxPriorityFee
              ? normalFee.maxPriorityFeePerGas
              : prev.maxPriorityFeePerGas,
          }));
        }
      } else if (f.gas && f.gas[1] && replaceFeeInfo.gasPrice) {
        const normalFee = f.gas[1];
        if (
          new BigNumber(normalFee.gasPrice).isGreaterThan(
            replaceFeeInfo.gasPrice,
          )
        ) {
          setReplaceFeeInfo((prev) => ({
            ...prev,
            gasPrice: normalFee.gasPrice,
          }));
          setFeeInfoUsedAsRestBase((prev) => ({
            ...prev,
            gasPrice: normalFee.gasPrice,
          }));
        }
      }

      setIsLoadingFeeInfo(false);

      setFeeInfo({
        common: f.common,
        gasEIP1559: f.gasEIP1559?.[1],
        gas: f.gas?.[1],
      });
    };

    void fetchFeeInfo();
  }, [
    account,
    accountId,
    isInit,
    network,
    networkId,
    replaceEncodedTx,
    replaceFeeInfo.gasPrice,
    replaceFeeInfo.maxFeePerGas,
    replaceFeeInfo.maxPriorityFeePerGas,
  ]);

  const newFeeInfo = useMemo(() => {
    if (!feeInfo) return;
    const selectedFeeInfo = {
      common: feeInfo.common,
      gasEIP1559:
        replaceFeeInfo.maxFeePerGas && replaceFeeInfo.maxPriorityFeePerGas
          ? {
              baseFeePerGas: new BigNumber(replaceFeeInfo.maxFeePerGas)
                .minus(replaceFeeInfo.maxPriorityFeePerGas)
                .toFixed(),
              maxFeePerGas: replaceFeeInfo.maxFeePerGas,
              maxPriorityFeePerGas: replaceFeeInfo.maxPriorityFeePerGas,
              gasLimit: replaceFeeInfo.gasLimit as string,
              gasLimitForDisplay: replaceFeeInfo.gasLimit as string,
            }
          : undefined,
      gas: replaceFeeInfo.gasPrice
        ? {
            gasPrice: replaceFeeInfo.gasPrice,
            gasLimit: replaceFeeInfo.gasLimit as string,
          }
        : undefined,
    };

    const {
      total,
      totalNative,
      totalFiat,
      totalNativeForDisplay,
      totalFiatForDisplay,
    } = calculateFeeForSend({
      feeInfo: selectedFeeInfo,
      nativeTokenPrice: feeInfo.common.nativeTokenPrice ?? 0,
    });

    return {
      selectedFeeInfo,
      total,
      totalNative,
      totalFiat,
      totalNativeForDisplay,
      totalFiatForDisplay,
    };
  }, [
    feeInfo,
    replaceFeeInfo.gasLimit,
    replaceFeeInfo.gasPrice,
    replaceFeeInfo.maxFeePerGas,
    replaceFeeInfo.maxPriorityFeePerGas,
  ]);

  const isInsufficientNativeBalance = useMemo(() => {
    if (!nativeTokenDetails || !newFeeInfo) return false;

    const nativeTokenTransferAmount =
      historyTx.decodedTx.nativeAmount ??
      calculateNativeAmountInActions(historyTx.decodedTx.actions)
        .nativeAmount ??
      0;

    return new BigNumber(nativeTokenTransferAmount)
      .plus(newFeeInfo.totalNative)
      .isGreaterThan(nativeTokenDetails.balanceParsed);
  }, [
    historyTx.decodedTx.actions,
    historyTx.decodedTx.nativeAmount,
    nativeTokenDetails,
    newFeeInfo,
  ]);

  const shouldShowResetButton = useMemo(
    () =>
      replaceFeeInfo.gasLimit !== feeInfoUsedAsRestBase.gasLimit ||
      replaceFeeInfo.maxFeePerGas !== feeInfoUsedAsRestBase.maxFeePerGas ||
      replaceFeeInfo.maxPriorityFeePerGas !==
        feeInfoUsedAsRestBase.maxPriorityFeePerGas ||
      replaceFeeInfo.gasPrice !== feeInfoUsedAsRestBase.gasPrice,
    [
      feeInfoUsedAsRestBase.gasLimit,
      feeInfoUsedAsRestBase.gasPrice,
      feeInfoUsedAsRestBase.maxFeePerGas,
      feeInfoUsedAsRestBase.maxPriorityFeePerGas,
      replaceFeeInfo.gasLimit,
      replaceFeeInfo.gasPrice,
      replaceFeeInfo.maxFeePerGas,
      replaceFeeInfo.maxPriorityFeePerGas,
    ],
  );

  const { checkFeeInfoIsOverflow, showFeeInfoOverflowConfirm } =
    usePreCheckFeeInfo({
      accountId,
      networkId,
    });

  const renderOriginalFee = useCallback(
    () => (
      <XStack space="$2">
        <NumberSizeableText
          formatter="balance"
          formatterOptions={{
            tokenSymbol: network?.symbol,
          }}
          size="$bodyLg"
        >
          {historyTx.decodedTx.totalFeeInNative}
        </NumberSizeableText>
        <NumberSizeableText
          formatter="value"
          formatterOptions={{
            currency: settings.currencyInfo.symbol,
          }}
          size="$bodyLg"
          color="$textSubdued"
        >
          {historyTx.decodedTx.totalFeeFiatValue}
        </NumberSizeableText>
      </XStack>
    ),
    [
      historyTx.decodedTx.totalFeeFiatValue,
      historyTx.decodedTx.totalFeeInNative,
      network?.symbol,
      settings.currencyInfo.symbol,
    ],
  );

  const renderNewFee = useCallback(
    () => (
      <XStack space="$2">
        <NumberSizeableText
          formatter="balance"
          formatterOptions={{
            tokenSymbol: network?.symbol,
          }}
          size="$bodyLg"
        >
          {newFeeInfo?.totalNative}
        </NumberSizeableText>
        <NumberSizeableText
          formatter="value"
          formatterOptions={{
            currency: settings.currencyInfo.symbol,
          }}
          size="$bodyLg"
          color="$textSubdued"
        >
          {newFeeInfo?.totalFiat}
        </NumberSizeableText>
      </XStack>
    ),
    [
      network?.symbol,
      newFeeInfo?.totalFiat,
      newFeeInfo?.totalNative,
      settings.currencyInfo.symbol,
    ],
  );

  useEffect(() => {
    if (!network) return;

    // Increase replacement transaction fee by 10% by default

    const targetFeeInfo = {
      gasLimit,
      maxFeePerGas: !isNil(originalMaxFeePerGas)
        ? new BigNumber(originalMaxFeePerGas)
            .times(REPLACE_TX_FEE_UP_RATIO)
            .toFixed()
        : undefined,
      maxPriorityFeePerGas: !isNil(originalMaxPriorityFeePerGas)
        ? new BigNumber(originalMaxPriorityFeePerGas)
            .times(REPLACE_TX_FEE_UP_RATIO)
            .toFixed()
        : undefined,
      gasPrice: !isNil(originalGasPrice)
        ? new BigNumber(originalGasPrice)
            .times(REPLACE_TX_FEE_UP_RATIO)
            .toFixed()
        : undefined,
    };

    setReplaceFeeInfo(targetFeeInfo);
    setFeeInfoUsedAsRestBase(targetFeeInfo);
    setIsInit(true);
  }, [
    gasLimit,
    gasPrice,
    maxFeePerGas,
    maxPriorityFeePerGas,
    network,
    originalGasPrice,
    originalMaxFeePerGas,
    originalMaxPriorityFeePerGas,
  ]);

  const handleApplyFeeInfo = useCallback(
    ({ customFeeInfo }: { customFeeInfo: IFeeInfoUnit }) => {
      if (customFeeInfo.gasEIP1559) {
        setReplaceFeeInfo({
          gasLimit: customFeeInfo.gasEIP1559.gasLimit,
          maxFeePerGas: customFeeInfo.gasEIP1559.maxFeePerGas,
          maxPriorityFeePerGas: customFeeInfo.gasEIP1559.maxPriorityFeePerGas,
          gasPrice: undefined,
        });
      } else if (customFeeInfo.gas) {
        setReplaceFeeInfo({
          gasLimit: customFeeInfo.gas.gasLimit,
          gasPrice: customFeeInfo.gas.gasPrice,
          maxFeePerGas: undefined,
          maxPriorityFeePerGas: undefined,
        });
      }
    },
    [],
  );

  const handleEditReplaceTxFeeInfo = useCallback(() => {
    if (!feeInfo) return;
    const sendSelectedFee = {
      feeType: EFeeType.Custom,
      presetIndex: 0,
    };

    const replaceTxOriginalFeeInfo: IFeeInfoUnit = {
      common: feeInfo?.common,
      gasEIP1559:
        originalMaxFeePerGas && originalMaxPriorityFeePerGas
          ? {
              baseFeePerGas: new BigNumber(originalMaxFeePerGas)
                .minus(originalMaxPriorityFeePerGas)
                .toFixed(),
              maxFeePerGas: originalMaxFeePerGas,
              maxPriorityFeePerGas: originalMaxPriorityFeePerGas,
              gasLimit: gasLimit as string,
              gasLimitForDisplay: gasLimit as string,
            }
          : undefined,
      gas: originalGasPrice
        ? {
            gasPrice: originalGasPrice,
            gasLimit: gasLimit as string,
          }
        : undefined,
    };

    const customFee: IFeeInfoUnit = {
      common: feeInfo?.common,
      gasEIP1559:
        replaceFeeInfo.maxFeePerGas && replaceFeeInfo.maxPriorityFeePerGas
          ? {
              baseFeePerGas: new BigNumber(replaceFeeInfo.maxFeePerGas)
                .minus(replaceFeeInfo.maxPriorityFeePerGas)
                .toFixed(),
              maxFeePerGas: replaceFeeInfo.maxFeePerGas,
              maxPriorityFeePerGas: replaceFeeInfo.maxPriorityFeePerGas,
              gasLimit: replaceFeeInfo.gasLimit as string,
              gasLimitForDisplay: replaceFeeInfo.gasLimit as string,
            }
          : undefined,
      gas: replaceFeeInfo.gasPrice
        ? {
            gasPrice: replaceFeeInfo.gasPrice,
            gasLimit: replaceFeeInfo.gasLimit as string,
          }
        : undefined,
    };

    const feeSelectorItems = [
      {
        label: '',
        icon: '',
        value: 0,
        type: EFeeType.Custom,
        feeInfo: customFee,
      },
    ];

    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.swap_history_detail_network_fee,
      }),
      showFooter: false,
      renderContent: (
        <FeeEditor
          selectedFee={undefined}
          feeSelectorItems={feeSelectorItems}
          networkId={networkId}
          sendSelectedFee={sendSelectedFee}
          unsignedTxs={[]}
          originalCustomFee={customFee}
          onApplyFeeInfo={handleApplyFeeInfo}
          replaceTxMode
          replaceTxOriginalFeeInfo={replaceTxOriginalFeeInfo}
        />
      ),
    });
  }, [
    feeInfo,
    gasLimit,
    handleApplyFeeInfo,
    intl,
    networkId,
    originalGasPrice,
    originalMaxFeePerGas,
    originalMaxPriorityFeePerGas,
    replaceFeeInfo.gasLimit,
    replaceFeeInfo.gasPrice,
    replaceFeeInfo.maxFeePerGas,
    replaceFeeInfo.maxPriorityFeePerGas,
  ]);

  const handleResetFeeInfo = useCallback(() => {
    setReplaceFeeInfo(feeInfoUsedAsRestBase);
  }, [feeInfoUsedAsRestBase]);

  const renderContent = useCallback(() => {
    if (isLoadingFeeInfo || isLoadingTokenDetails)
      return (
        <Stack flex={1} justifyContent="center" alignContent="center">
          <Spinner size="large" />
        </Stack>
      );
    return (
      <>
        {isInsufficientNativeBalance ? (
          <Alert
            fullBleed
            icon="ErrorOutline"
            type="critical"
            mb="$5"
            title={intl.formatMessage(
              {
                id: ETranslations.msg__str_is_required_for_network_fees_top_up_str_to_make_tx,
              },
              {
                crypto: network?.symbol ?? '',
              },
            )}
          />
        ) : null}
        <Stack px="$5">
          <Stack
            p="$5"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$borderSubdued"
            borderRadius="$3"
            borderCurve="continuous"
          >
            <SizableText size="$headingMd" mb="$2">
              {intl.formatMessage({ id: ETranslations.fee_original_fee })}
            </SizableText>
            {renderOriginalFee()}
          </Stack>
          <Icon
            my="$2"
            alignSelf="center"
            name="ChevronDoubleDownOutline"
            color="$iconSubdued"
          />
          <XStack
            bg="$bgSubdued"
            userSelect="none"
            alignItems="center"
            p="$5"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$borderStrong"
            borderRadius="$3"
            borderCurve="continuous"
            elevation={10}
          >
            <Stack flex={1}>
              <SizableText size="$headingMd" mb="$2">
                {intl.formatMessage({ id: ETranslations.fee_new_fee })}
              </SizableText>
              {renderNewFee()}
            </Stack>
            <IconButton
              title={intl.formatMessage({ id: ETranslations.global_edit })}
              icon="PencilOutline"
              onPress={handleEditReplaceTxFeeInfo}
            />
            {/* Show only after customizing the fee */}
            {shouldShowResetButton ? (
              <IconButton
                title={intl.formatMessage({ id: ETranslations.global_reset })}
                ml="$2"
                icon="UndoOutline"
                onPress={handleResetFeeInfo}
              />
            ) : null}
          </XStack>
        </Stack>
      </>
    );
  }, [
    handleEditReplaceTxFeeInfo,
    handleResetFeeInfo,
    intl,
    isInsufficientNativeBalance,
    isLoadingFeeInfo,
    isLoadingTokenDetails,
    network?.symbol,
    renderNewFee,
    renderOriginalFee,
    shouldShowResetButton,
  ]);

  const handleOnConfirm = useCallback(async () => {
    if (!newFeeInfo) return;
    const {
      selectedFeeInfo,
      total,
      totalNative,
      totalFiat,
      totalFiatForDisplay,
      totalNativeForDisplay,
    } = newFeeInfo;

    setIsSubmitting(true);

    try {
      const sendSelectedFeeInfo: ISendSelectedFeeInfo = {
        feeInfo: selectedFeeInfo,
        total,
        totalNative,
        totalFiat,
        totalNativeForDisplay,
        totalFiatForDisplay,
      };

      const unsignedTx = await backgroundApiProxy.serviceSend.buildUnsignedTx({
        accountId,
        networkId,
        encodedTx: replaceEncodedTx,
      });

      const newUnsignedTxs =
        await backgroundApiProxy.serviceSend.updateUnSignedTxBeforeSend({
          accountId,
          networkId,
          unsignedTxs: [unsignedTx],
          feeInfo: sendSelectedFeeInfo,
        });

      // fee info pre-check
      if (sendSelectedFeeInfo) {
        const isFeeInfoOverflow = await checkFeeInfoIsOverflow({
          feeAmount: sendSelectedFeeInfo.totalNative,
          feeSymbol: sendSelectedFeeInfo.feeInfo.common.nativeSymbol,
          encodedTx: newUnsignedTxs[0].encodedTx,
        });

        if (isFeeInfoOverflow) {
          const isConfirmed = await showFeeInfoOverflowConfirm();
          if (!isConfirmed) {
            setIsSubmitting(false);
            return;
          }
        }
      }

      await backgroundApiProxy.serviceSend.batchSignAndSendTransaction({
        accountId,
        networkId,
        feeInfo: sendSelectedFeeInfo,
        unsignedTxs: newUnsignedTxs,
        replaceTxInfo: {
          replaceHistoryId: historyTx.id,
          replaceType,
        },
        transferPayload: undefined,
      });
      setIsSubmitting(false);
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.feedback_transaction_submitted,
        }),
      });
      navigation.popStack();
    } catch (e: any) {
      setIsSubmitting(false);
      throw e;
    }
  }, [
    accountId,
    checkFeeInfoIsOverflow,
    historyTx.id,
    intl,
    navigation,
    networkId,
    newFeeInfo,
    replaceEncodedTx,
    replaceType,
    showFeeInfoOverflowConfirm,
  ]);

  const handleOnCancel = useCallback((close: () => void) => {
    close();
  }, []);

  return (
    <Page>
      <Page.Header
        title={
          replaceType === EReplaceTxType.SpeedUp
            ? intl.formatMessage({ id: ETranslations.global_speed_up })
            : intl.formatMessage({ id: ETranslations.global_cancel })
        }
      />
      <Page.Body testID="replace-tx-modal">{renderContent()}</Page.Body>
      <Page.Footer
        confirmButtonProps={{
          disabled:
            isLoadingFeeInfo ||
            isLoadingTokenDetails ||
            isSubmitting ||
            isInsufficientNativeBalance,
          loading: isSubmitting,
        }}
        cancelButtonProps={{
          disabled: isSubmitting,
        }}
        onConfirmText={intl.formatMessage({ id: ETranslations.global_confirm })}
        onConfirm={handleOnConfirm}
        onCancel={handleOnCancel}
      />
    </Page>
  );
}

export { SendReplaceTxContainer };
