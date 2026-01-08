import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { Keyboard, StyleSheet } from 'react-native';

import {
  Alert,
  Icon,
  Page,
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
import type {
  IBorrowAsset,
  IEarnTokenInfo,
} from '@onekeyhq/shared/types/staking';

import { EarnActionIcon } from '../../../Staking/components/ProtocolDetails/EarnActionIcon';
import { EarnText } from '../../../Staking/components/ProtocolDetails/EarnText';
import { createBorrowAssetSelectPopoverContent } from '../BorrowAssetSelectPopover';
import { BorrowInfoItem } from '../BorrowInfoItem';
import { useUniversalBorrowAction } from '../UniversalBorrowAction';

type IUniversalBorrowWithdrawProps = {
  accountId: string;
  networkId: string;
  providerName: string;
  borrowMarketAddress: string;
  borrowReserveAddress: string;
  balance: string;
  tokenSymbol?: string;
  tokenImageUri?: string;
  decimals?: number;
  price?: string;
  tokenInfo?: IEarnTokenInfo;
  isDisabled?: boolean;
  beforeFooter?: ReactElement | null;
  showApyDetail?: boolean;
  actionLabel?: string;
  selectableAssets?: IBorrowAsset[];
  selectableAssetsLoading?: boolean;
  onTokenSelect?: (item: IBorrowAsset) => void;
  onConfirm?: (params: {
    amount: string;
    withdrawAll?: boolean;
    repayAll?: boolean;
  }) => Promise<void>;
};

const isAmountInvalid = (amount: string) =>
  BigNumber(amount).isNaN() ||
  (typeof amount === 'string' && amount.endsWith('.'));

export function UniversalBorrowWithdraw({
  accountId,
  networkId,
  providerName,
  borrowMarketAddress,
  borrowReserveAddress,
  balance,
  tokenSymbol,
  tokenImageUri,
  decimals,
  price: inputPrice,
  tokenInfo,
  isDisabled,
  beforeFooter,
  showApyDetail = false,
  actionLabel: actionLabelProp,
  selectableAssets,
  selectableAssetsLoading,
  onTokenSelect,
  onConfirm,
}: IUniversalBorrowWithdrawProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const { handleOpenWebSite } = useBrowserAction().current;
  const [amountValue, setAmountValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const price = Number(inputPrice) > 0 ? inputPrice : '0';
  const amountInputDisabled = !!isDisabled;

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

  const maxAmountValue = useMemo(() => {
    const balanceBN = new BigNumber(balance);
    if (balanceBN.isNaN()) {
      return '0';
    }
    if (typeof decimals === 'number') {
      return balanceBN.decimalPlaces(decimals, BigNumber.ROUND_DOWN).toFixed();
    }
    return balance;
  }, [balance, decimals]);

  const isWithdrawAll = useMemo(() => {
    const amountBN = new BigNumber(amountValue);
    const maxAmountBN = new BigNumber(maxAmountValue);
    if (amountBN.isNaN() || maxAmountBN.isNaN()) {
      return false;
    }
    return amountBN.gt(0) && amountBN.eq(maxAmountBN);
  }, [amountValue, maxAmountValue]);

  const {
    transactionConfirmation,
    checkAmountMessage,
    checkAmountAlerts,
    checkAmountLoading,
    isCheckAmountMessageError,
    checkAmountResult,
  } = useUniversalBorrowAction({
    action: 'withdraw',
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
      actionLabelProp ||
      intl.formatMessage({ id: ETranslations.global_withdraw }),
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

  const onMax = useCallback(() => {
    onChangeAmountValue(maxAmountValue);
  }, [maxAmountValue, onChangeAmountValue]);

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
      await onConfirm({
        amount: amountValue,
        withdrawAll: isWithdrawAll,
      });
      setAmountValue('');
    } finally {
      setSubmitting(false);
    }
  }, [amountValue, isWithdrawAll, onConfirm]);

  // Wrap onTokenSelect to clear amount when token changes
  const handleTokenSelectInternal = useCallback(
    (item: IBorrowAsset) => {
      setAmountValue(''); // Clear input value when switching token
      onTokenSelect?.(item);
    },
    [onTokenSelect],
  );

  // Memoize popover content to avoid re-creating on every render
  const popoverContent = useMemo(() => {
    if (!selectableAssets || selectableAssets.length <= 1) {
      return undefined;
    }
    return createBorrowAssetSelectPopoverContent({
      assets: selectableAssets,
      isLoading: selectableAssetsLoading,
      selectedReserveAddress: borrowReserveAddress,
      action: 'withdraw',
      onSelect: handleTokenSelectInternal,
    });
  }, [
    selectableAssets,
    selectableAssetsLoading,
    borrowReserveAddress,
    handleTokenSelectInternal,
  ]);

  const popoverTitle = useMemo(
    () => intl.formatMessage({ id: ETranslations.token_selector_title }),
    [intl],
  );

  const tokenSelectorTriggerProps = useMemo(
    () => ({
      selectedTokenImageUri: tokenImageUri,
      selectedTokenSymbol: tokenSymbol?.toUpperCase(),
      selectedNetworkImageUri: network?.logoURI,
      disabled:
        !selectableAssets ||
        selectableAssets.length <= 1 ||
        selectableAssetsLoading,
      popover: popoverContent
        ? {
            title: popoverTitle,
            content: popoverContent,
          }
        : undefined,
    }),
    [
      tokenImageUri,
      tokenSymbol,
      network?.logoURI,
      selectableAssets,
      selectableAssetsLoading,
      popoverContent,
      popoverTitle,
    ],
  );

  const inputProps = useMemo(
    () => ({
      placeholder: '0',
      autoFocus: !amountInputDisabled,
    }),
    [amountInputDisabled],
  );

  const balanceIconText = useMemo(
    () => intl.formatMessage({ id: ETranslations.global_available }),
    [intl],
  );

  const balanceProps = useMemo(
    () => ({
      value: balance,
      iconText: balanceIconText,
      onPress: onMax,
    }),
    [balance, balanceIconText, onMax],
  );

  const valueProps = useMemo(
    () => ({
      value: currentValue,
      currency: currentValue ? symbol : undefined,
    }),
    [currentValue, symbol],
  );

  const maxAmountText = useMemo(
    () => intl.formatMessage({ id: ETranslations.defi_safe_max }),
    [intl],
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
          tokenSelectorTriggerProps={tokenSelectorTriggerProps}
          inputProps={inputProps}
          balanceProps={balanceProps}
          valueProps={valueProps}
          enableMaxAmount
          maxAmountText={maxAmountText}
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

      {!isDisabled ? (
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
                  <XStack ai="center" gap="$1">
                    <EarnText
                      text={transactionConfirmation.healthFactor.current?.title}
                      size="$headingLg"
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
                          size="$headingLg"
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
                    size="$headingLg"
                  />
                  <EarnText
                    text={transactionConfirmation.mySupply.current?.description}
                    size="$bodySmMedium"
                  />
                </YStack>
                {transactionConfirmation.mySupply.latest ? (
                  <Icon
                    name="ArrowRightSolid"
                    size="$4"
                    color="$iconDisabled"
                  />
                ) : null}
                {transactionConfirmation.mySupply.latest ? (
                  <YStack ai="flex-end">
                    <EarnText
                      text={transactionConfirmation.mySupply.latest?.title}
                      size="$headingLg"
                    />
                    <EarnText
                      text={
                        transactionConfirmation.mySupply.latest?.description
                      }
                      size="$bodySmMedium"
                    />
                  </YStack>
                ) : null}
              </BorrowInfoItem>
            ) : null}
            {showApyDetail && transactionConfirmation?.apyDetail ? (
              <BorrowInfoItem
                title={intl.formatMessage({
                  id: ETranslations.defi_supply_apy,
                })}
              >
                <YStack ai="flex-end">
                  <EarnActionIcon
                    title={transactionConfirmation.apyDetail.title.text}
                    actionIcon={transactionConfirmation.apyDetail.button}
                  />
                </YStack>
              </BorrowInfoItem>
            ) : null}
          </YStack>
        </YStack>
      ) : null}

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
