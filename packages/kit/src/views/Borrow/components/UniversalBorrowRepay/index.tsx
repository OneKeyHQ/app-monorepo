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
  onConfirm?: (amount: string) => Promise<void>;
};

const isAmountInvalid = (amount: string) =>
  BigNumber(amount).isNaN() ||
  (typeof amount === 'string' && amount.endsWith('.'));

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
  onConfirm,
}: IUniversalBorrowRepayProps) {
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

  const {
    transactionConfirmation,
    checkAmountMessage,
    checkAmountAlerts,
    checkAmountLoading,
    isCheckAmountMessageError,
  } = useUniversalBorrowAction({
    action: 'repay',
    accountId,
    networkId,
    provider: providerName,
    marketAddress: borrowMarketAddress,
    reserveAddress: borrowReserveAddress,
    amount: amountValue,
    isDisabled,
  });

  const actionLabel = useMemo(
    () => intl.formatMessage({ id: ETranslations.global_withdraw }),
    [intl],
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
    const formattedMaxAmount =
      typeof decimals === 'number'
        ? new BigNumber(balance).toFixed(decimals, BigNumber.ROUND_DOWN)
        : balance;
    onChangeAmountValue(formattedMaxAmount);
  }, [balance, decimals, onChangeAmountValue]);

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
      checkAmountAlerts.length > 0 ||
      checkAmountLoading,
    [
      amountValue,
      checkAmountAlerts.length,
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
            {transactionConfirmation?.mySupply ? (
              <BorrowInfoItem
                title={
                  <EarnText
                    text={{ text: 'My Supply' }}
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
              <BorrowInfoItem title="Supply APY">
                <YStack ai="flex-end">
                  <EarnActionIcon
                    title={transactionConfirmation.apyDetail.title.text}
                    actionIcon={transactionConfirmation.apyDetail.button}
                  />
                </YStack>
              </BorrowInfoItem>
            ) : null}
          </YStack>
          <Divider my="$5" />
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
