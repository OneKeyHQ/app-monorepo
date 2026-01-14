import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { Keyboard, StyleSheet } from 'react-native';

import {
  Alert,
  Divider,
  Icon,
  Page,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  PercentageStageOnKeyboard,
  calcPercentBalance,
} from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { validateAmountInputForStaking } from '@onekeyhq/kit/src/utils/validateAmountInput';
import {
  StakingAmountInput,
  useOnBlurAmountValue,
} from '@onekeyhq/kit/src/views/Staking/components/StakingAmountInput';
import StakingFormWrapper from '@onekeyhq/kit/src/views/Staking/components/StakingFormWrapper';
import { countDecimalPlaces } from '@onekeyhq/kit/src/views/Staking/utils/utils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type {
  IBorrowAsset,
  IBorrowReserveItem,
  IEarnTokenInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { EarnText } from '../../../Staking/components/ProtocolDetails/EarnText';
import { EarnTooltip } from '../../../Staking/components/ProtocolDetails/EarnTooltip';
import { BorrowInfoItem } from '../BorrowInfoItem';
import { BorrowSwapOrBridge } from '../BorrowSwapOrBridge';
import { ApyTextV2 } from '../BorrowTableList/ApyTextV2';
import { useUniversalBorrowAction } from '../UniversalBorrowAction';

type IUniversalBorrowSupplyProps = {
  accountId: string;
  networkId: string;
  providerName: string;
  borrowMarketAddress: string;
  borrowReserveAddress: string;
  balance: string;
  // Max balance for max button. If provided, balance is for display only.
  maxBalance?: string;
  tokenSymbol?: string;
  tokenImageUri?: string;
  decimals?: number;
  price?: string;
  tokenInfo?: IEarnTokenInfo;
  borrowReserves?: IBorrowReserveItem;
  isDisabled?: boolean;
  beforeFooter?: ReactElement | null;
  showApyDetail?: boolean;
  actionLabel?: string;
  onConfirm?: (amount: string) => Promise<void>;
};

const isAmountInvalid = (amount: string) =>
  BigNumber(amount).isNaN() ||
  (typeof amount === 'string' && amount.endsWith('.'));

type IBorrowSelectAsset = IBorrowAsset;

export function UniversalBorrowSupply({
  accountId,
  networkId,
  providerName,
  borrowMarketAddress,
  borrowReserveAddress,
  balance,
  maxBalance,
  tokenSymbol,
  tokenImageUri,
  decimals,
  price: inputPrice,
  tokenInfo,
  isDisabled,
  beforeFooter,
  showApyDetail = false,
  actionLabel: actionLabelProp,
  onConfirm,
}: IUniversalBorrowSupplyProps) {
  const intl = useIntl();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalStakingParamList>>();
  const { gtMd } = useMedia();
  const { handleOpenWebSite } = useBrowserAction().current;
  const [amountValue, setAmountValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const price = Number(inputPrice) > 0 ? inputPrice : '0';
  const amountInputDisabled = !!isDisabled;
  const tokenSelectorDisabled =
    !accountId || !networkId || !providerName || !borrowMarketAddress;

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

  const {
    transactionConfirmation,
    checkAmountMessage,
    checkAmountAlerts,
    checkAmountLoading,
    isCheckAmountMessageError,
    checkAmountResult,
  } = useUniversalBorrowAction({
    action: 'supply',
    accountId,
    networkId,
    provider: providerName,
    marketAddress: borrowMarketAddress,
    reserveAddress: borrowReserveAddress,
    amount: amountValue,
    isDisabled,
  });

  const actionLabel = useMemo(
    () =>
      actionLabelProp || intl.formatMessage({ id: ETranslations.defi_supply }),
    [actionLabelProp, intl],
  );

  const onChangeAmountValue = useCallback(
    (value: string) => {
      if (!validateAmountInputForStaking(value, decimals)) {
        return;
      }

      const valueBN = new BigNumber(value);
      if (valueBN.isNaN()) {
        if (value === '') {
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
        return;
      }

      setAmountValue(value);
    },
    [decimals],
  );

  const onBlurAmountValue = useOnBlurAmountValue(amountValue, setAmountValue);

  const maxAmountValue = useMemo(() => {
    // Use maxBalance for max button if provided, otherwise use balance
    const valueForMax = maxBalance ?? balance;
    const valueBN = new BigNumber(valueForMax);
    if (valueBN.isNaN()) {
      return '0';
    }
    if (typeof decimals === 'number') {
      return valueBN.decimalPlaces(decimals, BigNumber.ROUND_DOWN).toFixed();
    }
    return valueForMax;
  }, [balance, maxBalance, decimals]);

  const onMax = useCallback(() => {
    onChangeAmountValue(maxAmountValue);
  }, [maxAmountValue, onChangeAmountValue]);

  const onSelectPercentageStage = useCallback(
    (percent: number) => {
      onChangeAmountValue(
        calcPercentBalance({
          balance: maxBalance ?? balance,
          percent,
          decimals,
        }),
      );
    },
    [balance, maxBalance, decimals, onChangeAmountValue],
  );

  const currentValue = useMemo<string | undefined>(() => {
    if (Number(amountValue) > 0 && Number(price) > 0) {
      return BigNumber(amountValue)
        .multipliedBy(price ?? '0')
        .toFixed();
    }
    return undefined;
  }, [amountValue, price]);

  const isInsufficientBalance = useMemo(() => {
    const amountBN = new BigNumber(amountValue);
    const balanceBN = new BigNumber(balance);

    if (amountBN.isNaN() || balanceBN.isNaN()) {
      return false;
    }

    return amountBN.gt(balanceBN);
  }, [amountValue, balance]);

  const isDisable = useMemo(
    () =>
      isDisabled ||
      isAmountInvalid(amountValue) ||
      BigNumber(amountValue).isLessThanOrEqualTo(0) ||
      isInsufficientBalance ||
      isCheckAmountMessageError ||
      checkAmountResult === false ||
      checkAmountLoading,
    [
      amountValue,
      checkAmountResult,
      checkAmountLoading,
      isCheckAmountMessageError,
      isDisabled,
      isInsufficientBalance,
    ],
  );

  const handleSubmit = useCallback(async () => {
    if (!onConfirm) {
      return;
    }

    try {
      Keyboard.dismiss();
      setSubmitting(true);
      await onConfirm(amountValue);
      setAmountValue('');
    } finally {
      setSubmitting(false);
    }
  }, [amountValue, onConfirm]);

  const token = useMemo(
    () => tokenInfo?.token as IToken | undefined,
    [tokenInfo?.token],
  );

  useEffect(() => {
    setAmountValue('');
  }, [borrowReserveAddress]);

  const handleOpenTokenSelector = useCallback(() => {
    if (tokenSelectorDisabled) return;
    navigation.push(EModalStakingRoutes.BorrowTokenSelect, {
      accountId,
      networkId,
      provider: providerName,
      marketAddress: borrowMarketAddress,
      action: 'supply',
      currentReserveAddress: borrowReserveAddress,
      onSelect: (item: IBorrowSelectAsset) => {
        if (item.reserveAddress === borrowReserveAddress) return;
        navigation.setParams({
          reserveAddress: item.reserveAddress,
          symbol: item.token.symbol,
          logoURI: item.token.logoURI,
        });
      },
    });
  }, [
    accountId,
    borrowReserveAddress,
    borrowMarketAddress,
    navigation,
    networkId,
    providerName,
    tokenSelectorDisabled,
  ]);

  const balanceIconText = useMemo(
    () => intl.formatMessage({ id: ETranslations.global_available }),
    [intl],
  );

  const inputProps = useMemo(
    () => ({
      placeholder: '0',
      autoFocus: !amountInputDisabled,
    }),
    [amountInputDisabled],
  );

  const balanceProps = useMemo(
    () => ({
      value: balance,
      // When maxBalance is provided, balance is for display only, show wallet icon instead of "Available" text
      iconText: maxBalance ? undefined : balanceIconText,
      onPress: amountInputDisabled ? undefined : onMax,
    }),
    [balance, maxBalance, balanceIconText, amountInputDisabled, onMax],
  );

  const valueProps = useMemo(
    () => ({
      value: currentValue,
      currency: currentValue ? symbol : undefined,
    }),
    [currentValue, symbol],
  );

  return (
    <StakingFormWrapper>
      <Stack position="relative" opacity={amountInputDisabled ? 0.7 : 1}>
        <StakingAmountInput
          title={actionLabel}
          disabled={amountInputDisabled}
          hasError={isInsufficientBalance || isCheckAmountMessageError}
          value={amountValue}
          onChange={onChangeAmountValue}
          onBlur={onBlurAmountValue}
          tokenSelectorTriggerProps={{
            selectedTokenImageUri: tokenImageUri,
            selectedTokenSymbol: tokenSymbol?.toUpperCase(),
            selectedNetworkImageUri: network?.logoURI,
            onPress: handleOpenTokenSelector,
            disabled: tokenSelectorDisabled,
          }}
          inputProps={inputProps}
          balanceProps={balanceProps}
          valueProps={valueProps}
          enableMaxAmount
          onSelectPercentageStage={onSelectPercentageStage}
        />
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
              renderTitle={() => (
                <YStack>
                  <EarnText text={alert?.title} size="$bodyMdMedium" />
                  <EarnText text={alert.text} size="$bodyMdMedium" />
                  <EarnText text={alert?.description} size="$bodyMdMedium" />
                </YStack>
              )}
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

      <YStack
        p="$3.5"
        pt="$5"
        borderRadius="$3"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
      >
        <YStack gap="$6">
          {transactionConfirmation?.healthFactor ? (
            <BorrowInfoItem
              title={intl.formatMessage({
                id: ETranslations.defi_health_factor,
              })}
              variant="highlight"
            >
              <YStack ai="flex-end">
                <XStack ai="center" gap="$3">
                  <EarnText
                    text={transactionConfirmation.healthFactor.current?.title}
                    color="$textText"
                    size="$bodyLg"
                    opacity={
                      transactionConfirmation.healthFactor.latest ? 0.5 : 1
                    }
                  />
                  {transactionConfirmation.healthFactor.latest ? (
                    <>
                      <Icon
                        name="ArrowRightSolid"
                        size="$4"
                        color="$iconDisabled"
                      />
                      <EarnText
                        text={
                          transactionConfirmation.healthFactor.latest?.title
                        }
                        size="$headingMd"
                      />
                    </>
                  ) : null}
                </XStack>
                <EarnText
                  text={
                    transactionConfirmation.liquidationAt?.description ?? {
                      text: intl.formatMessage({
                        id: ETranslations.defi_liquidation_at_less_than_1_00,
                      }),
                    }
                  }
                  size="$bodySmMedium"
                  color="$textSubdued"
                />
              </YStack>
            </BorrowInfoItem>
          ) : null}
          {transactionConfirmation?.mySupply ? (
            <BorrowInfoItem
              title={intl.formatMessage({
                id: ETranslations.defi_my_supply,
              })}
              variant="highlight"
            >
              <YStack ai="flex-end">
                <EarnText
                  text={transactionConfirmation.mySupply.current?.title}
                  size="$headingMd"
                  opacity={transactionConfirmation.mySupply.latest ? 0.5 : 1}
                />
                <EarnText
                  text={transactionConfirmation.mySupply.current?.description}
                  size="$bodySmMedium"
                  opacity={transactionConfirmation.mySupply.latest ? 0.5 : 1}
                />
              </YStack>
              {transactionConfirmation.mySupply.latest ? (
                <Icon name="ArrowRightSolid" size="$4" color="$iconDisabled" />
              ) : null}
              {transactionConfirmation.mySupply.latest ? (
                <YStack ai="flex-end">
                  <EarnText
                    text={transactionConfirmation.mySupply.latest?.title}
                    size="$headingMd"
                  />
                  <EarnText
                    text={transactionConfirmation.mySupply.latest?.description}
                    size="$bodySmMedium"
                  />
                </YStack>
              ) : null}
            </BorrowInfoItem>
          ) : null}
        </YStack>
        {token &&
        (transactionConfirmation?.healthFactor ||
          transactionConfirmation?.mySupply ||
          (showApyDetail && transactionConfirmation?.apyDetail) ||
          transactionConfirmation?.refundableFee ||
          transactionConfirmation?.canBeCollateral) ? (
          <Divider my="$5" />
        ) : null}
        <YStack gap="$6">
          {showApyDetail && transactionConfirmation?.apyDetail ? (
            <BorrowInfoItem
              title={intl.formatMessage({
                id: ETranslations.defi_supply_apy,
              })}
            >
              <ApyTextV2
                apyDetail={transactionConfirmation.apyDetail}
                triggerMode="icon"
              />
            </BorrowInfoItem>
          ) : null}
          {transactionConfirmation?.refundableFee ? (
            <BorrowInfoItem
              title={
                <XStack ai="center" gap="$1.5">
                  <EarnText
                    text={{
                      text: intl.formatMessage({
                        id: ETranslations.defi_refundable_fee,
                      }),
                      size: '$bodyMd',
                      color: '$textSubdued',
                    }}
                  />
                  <EarnTooltip
                    tooltip={transactionConfirmation?.refundableFee?.tooltip}
                  />
                </XStack>
              }
            >
              <XStack>
                <EarnText
                  text={transactionConfirmation?.refundableFee?.title}
                />
                <EarnText
                  text={transactionConfirmation?.refundableFee?.description}
                />
              </XStack>
            </BorrowInfoItem>
          ) : null}
          {transactionConfirmation?.canBeCollateral ? (
            <BorrowInfoItem
              gap="$1"
              title={intl.formatMessage({
                id: ETranslations.defi_use_as_collateral,
              })}
            >
              <Icon
                name="Checkmark2SmallOutline"
                size="$5"
                color="$textSuccess"
              />
              <EarnText
                text={{
                  text: intl.formatMessage({
                    id: ETranslations.global_enabled,
                  }),
                  color: '$textSuccess',
                  size: '$bodyMdMedium',
                }}
              />
            </BorrowInfoItem>
          ) : null}
          {token ? (
            <BorrowSwapOrBridge
              token={token}
              accountId={accountId}
              networkId={networkId}
              containerStyle={{
                pt: '$0',
              }}
            />
          ) : null}
        </YStack>
      </YStack>

      {beforeFooter}

      <Page.Footer>
        <Page.FooterActions
          onConfirmText={actionLabel}
          confirmButtonProps={{
            onPress: handleSubmit,
            loading: submitting || checkAmountLoading,
            disabled: isDisable,
          }}
        />
        <PercentageStageOnKeyboard
          onSelectPercentageStage={onSelectPercentageStage}
        />
      </Page.Footer>
    </StakingFormWrapper>
  );
}
