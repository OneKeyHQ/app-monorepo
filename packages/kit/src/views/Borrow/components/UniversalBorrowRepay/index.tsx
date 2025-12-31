import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { Keyboard, StyleSheet } from 'react-native';

import {
  Alert,
  Divider,
  Icon,
  Page,
  SegmentControl,
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
import { TradeOrBuy } from '@onekeyhq/kit/src/views/Staking/components/TradeOrBuy';
import { countDecimalPlaces } from '@onekeyhq/kit/src/views/Staking/utils/utils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnTokenInfo } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { EarnActionIcon } from '../../../Staking/components/ProtocolDetails/EarnActionIcon';
import { EarnText } from '../../../Staking/components/ProtocolDetails/EarnText';
import { BorrowInfoItem } from '../BorrowInfoItem';
import { useUniversalBorrowAction } from '../UniversalBorrowAction';

type IUniversalBorrowRepayProps = {
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
  onConfirm?: (params: {
    amount: string;
    withdrawAll?: boolean;
    repayAll?: boolean;
  }) => Promise<void>;
};

const isAmountInvalid = (amount: string) =>
  BigNumber(amount).isNaN() ||
  (typeof amount === 'string' && amount.endsWith('.'));

type IRepaySource = 'wallet' | 'collateral';

export function UniversalBorrowRepay({
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
  onConfirm,
}: IUniversalBorrowRepayProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const { handleOpenWebSite } = useBrowserAction().current;
  const [amountValue, setAmountValue] = useState('');
  const [collateralAmountValue, setCollateralAmountValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [repaySource, setRepaySource] = useState<IRepaySource>('wallet');

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

  const isRepayAll = useMemo(() => {
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
    action: 'repay',
    accountId,
    networkId,
    provider: providerName,
    marketAddress: borrowMarketAddress,
    reserveAddress: borrowReserveAddress,
    amount: amountValue,
    isDisabled,
    repayAll: isRepayAll,
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

  const onChangeCollateralAmountValue = useCallback(
    (value: string) => {
      if (!validateAmountInputForStaking(value, decimals)) {
        return;
      }

      const valueBN = new BigNumber(value);
      if (valueBN.isNaN()) {
        if (value === '') {
          setCollateralAmountValue('');
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

      setCollateralAmountValue(value);
    },
    [decimals],
  );

  const onBlurAmountValue = useOnBlurAmountValue(amountValue, setAmountValue);
  const onBlurCollateralAmountValue = useOnBlurAmountValue(
    collateralAmountValue,
    setCollateralAmountValue,
  );

  const onMax = useCallback(() => {
    onChangeAmountValue(maxAmountValue);
  }, [maxAmountValue, onChangeAmountValue]);

  const onMaxCollateral = useCallback(() => {
    onChangeCollateralAmountValue(maxAmountValue);
  }, [maxAmountValue, onChangeCollateralAmountValue]);

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

  const onSelectCollateralPercentageStage = useCallback(
    (percent: number) => {
      onChangeCollateralAmountValue(
        calcPercentBalance({
          balance,
          percent,
          decimals,
        }),
      );
    },
    [balance, decimals, onChangeCollateralAmountValue],
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
    if (repaySource !== 'wallet') {
      return false;
    }
    const amountBN = new BigNumber(amountValue);
    const balanceBN = new BigNumber(balance);

    if (amountBN.isNaN() || balanceBN.isNaN()) {
      return false;
    }

    return amountBN.gt(balanceBN);
  }, [amountValue, balance, repaySource]);

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
        repayAll: isRepayAll,
      });
      setAmountValue('');
    } finally {
      setSubmitting(false);
    }
  }, [amountValue, isRepayAll, onConfirm]);

  const token = useMemo(
    () => tokenInfo?.token as IToken | undefined,
    [tokenInfo?.token],
  );
  const onRepaySourceChange = useCallback((value: string | number) => {
    setRepaySource(value as IRepaySource);
  }, []);
  const segmentOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({
          id: ETranslations.defi_from_wallet_balance,
        }),
        value: 'wallet',
      },
      {
        label: intl.formatMessage({ id: ETranslations.defi_with_collateral }),
        value: 'collateral',
      },
    ],
    [intl],
  );

  return (
    <StakingFormWrapper>
      <YStack gap="$3">
        <SegmentControl
          fullWidth
          value={repaySource}
          options={segmentOptions}
          onChange={onRepaySourceChange}
        />
        {repaySource === 'wallet' ? (
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
              }}
              inputProps={{
                placeholder: '0',
                autoFocus: !amountInputDisabled,
              }}
              balanceProps={{
                value: balance,
                iconText: actionLabel,
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
        ) : (
          <YStack gap="$2.5">
            <Stack position="relative" opacity={amountInputDisabled ? 0.7 : 1}>
              <StakingAmountInput
                title={intl.formatMessage({ id: ETranslations.global_from })}
                disabled={amountInputDisabled}
                value={collateralAmountValue}
                onChange={onChangeCollateralAmountValue}
                onBlur={onBlurCollateralAmountValue}
                tokenSelectorTriggerProps={{
                  selectedTokenImageUri: tokenImageUri,
                  selectedTokenSymbol: tokenSymbol?.toUpperCase(),
                  selectedNetworkImageUri: network?.logoURI,
                }}
                inputProps={{
                  placeholder: '0',
                  autoFocus: !amountInputDisabled,
                }}
                balanceProps={{
                  value: balance,
                  iconText: actionLabel,
                  onPress: onMaxCollateral,
                }}
                enableMaxAmount
                onSelectPercentageStage={onSelectCollateralPercentageStage}
              />
              {amountInputDisabled ? (
                <Stack position="absolute" w="100%" h="100%" zIndex={1} />
              ) : null}
            </Stack>
            <Stack position="relative" opacity={amountInputDisabled ? 0.7 : 1}>
              <StakingAmountInput
                title={intl.formatMessage({ id: ETranslations.global_to })}
                disabled={amountInputDisabled}
                hasError={isCheckAmountMessageError}
                value={amountValue}
                onChange={onChangeAmountValue}
                onBlur={onBlurAmountValue}
                tokenSelectorTriggerProps={{
                  selectedTokenImageUri: tokenImageUri,
                  selectedTokenSymbol: tokenSymbol?.toUpperCase(),
                  selectedNetworkImageUri: network?.logoURI,
                }}
                inputProps={{
                  placeholder: '0',
                }}
                valueProps={{
                  value: currentValue,
                  currency: currentValue ? symbol : undefined,
                }}
                onSelectPercentageStage={() => {}}
              />
              {amountInputDisabled ? (
                <Stack position="absolute" w="100%" h="100%" zIndex={1} />
              ) : null}
            </Stack>
          </YStack>
        )}
      </YStack>

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
          {transactionConfirmation?.myBorrow ? (
            <BorrowInfoItem
              title={
                <EarnText
                  text={{
                    text: intl.formatMessage({
                      id: ETranslations.defi_my_borrow,
                    }),
                  }}
                  color="$textText"
                  size="$bodyLg"
                  boldTextProps={{
                    size: '$bodyMdMedium',
                  }}
                />
              }
            >
              <YStack ai="flex-end">
                <EarnText
                  text={transactionConfirmation.myBorrow.current?.title}
                  size="$headingLg"
                />
                <EarnText
                  text={transactionConfirmation.myBorrow.current?.description}
                  size="$bodySmMedium"
                />
              </YStack>
              {transactionConfirmation.myBorrow.latest ? (
                <Icon name="ArrowRightSolid" size="$4" color="$iconDisabled" />
              ) : null}
              {transactionConfirmation.myBorrow.latest ? (
                <YStack ai="flex-end">
                  <EarnText
                    text={transactionConfirmation.myBorrow.latest?.title}
                    size="$headingLg"
                  />
                  <EarnText
                    text={transactionConfirmation.myBorrow.latest?.description}
                    size="$bodySmMedium"
                  />
                </YStack>
              ) : null}
            </BorrowInfoItem>
          ) : null}
          {showApyDetail && transactionConfirmation?.apyDetail ? (
            <BorrowInfoItem
              title={intl.formatMessage({ id: ETranslations.defi_supply_apy })}
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
        {token &&
        (transactionConfirmation?.healthFactor ||
          transactionConfirmation?.myBorrow ||
          (showApyDetail && transactionConfirmation?.apyDetail)) ? (
          <Divider my="$5" />
        ) : null}
        {token ? (
          <TradeOrBuy
            token={token}
            accountId={accountId}
            networkId={networkId}
            containerStyle={{
              pt: '$0',
            }}
          />
        ) : null}
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
          onSelectPercentageStage={
            repaySource === 'collateral'
              ? onSelectCollateralPercentageStage
              : onSelectPercentageStage
          }
        />
      </Page.Footer>
    </StakingFormWrapper>
  );
}
