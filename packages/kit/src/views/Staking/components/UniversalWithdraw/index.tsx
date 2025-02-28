import type { PropsWithChildren, ReactElement } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { useDebouncedCallback } from 'use-debounce';

import {
  Accordion,
  Alert,
  Divider,
  Icon,
  IconButton,
  Image,
  NumberSizeableText,
  Page,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  PercentageStageOnKeyboard,
  calcPercentBalance,
} from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IEarnEstimateFeeResp } from '@onekeyhq/shared/types/staking';

import { validateAmountInput } from '../../../Swap/utils/utils';
import { capitalizeString, countDecimalPlaces } from '../../utils/utils';
import { CalculationList, CalculationListItem } from '../CalculationList';
import { EstimateNetworkFee } from '../EstimateNetworkFee';
import { StakingAmountInput } from '../StakingAmountInput';
import StakingFormWrapper from '../StakingFormWrapper';
import { ValuePriceListItem } from '../ValuePriceListItem';

type IUniversalWithdrawProps = {
  balance: string;
  price: string;

  accountId?: string;
  networkId?: string;

  providerLogo?: string;
  providerName?: string;

  providerLabel?: string;

  decimals?: number;

  initialAmount?: string;
  tokenImageUri?: string;
  tokenSymbol?: string;

  minAmount?: string;
  showDetailWithdrawalRequested: boolean;
  unstakingPeriod?: number;

  showPayWith?: boolean;
  payWithToken?: string;
  payWithTokenRate?: string;

  hideReceived?: boolean;

  estimateFeeResp?: IEarnEstimateFeeResp;

  morphoVault?: string;

  onConfirm?: ({
    amount,
    withdrawAll,
  }: {
    amount: string;
    withdrawAll: boolean;
  }) => Promise<void>;
};

const isNaN = (num: string) =>
  BigNumber(num).isNaN() || (typeof num === 'string' && num.endsWith('.'));

const WITHDRAW_ACCORDION_KEY = 'withdraw-accordion-content';

export const UniversalWithdraw = ({
  balance,
  price: inputPrice,
  accountId,
  networkId,
  tokenImageUri,
  tokenSymbol,
  providerLogo,
  providerName,
  initialAmount,
  minAmount = '0',
  showDetailWithdrawalRequested,
  unstakingPeriod,
  providerLabel,
  decimals,
  morphoVault,
  // pay with
  showPayWith,
  payWithToken,
  payWithTokenRate = '1',

  hideReceived,
  estimateFeeResp,

  onConfirm,
}: PropsWithChildren<IUniversalWithdrawProps>) => {
  const price = Number(inputPrice) > 0 ? inputPrice : '0';
  const [loading, setLoading] = useState<boolean>(false);
  const withdrawAllRef = useRef(false);
  const [amountValue, setAmountValue] = useState(initialAmount ?? '');
  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();

  const intl = useIntl();

  const isMorphoProvider = earnUtils.isMorphoProvider({
    providerName: providerName ?? '',
  });

  const network = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getNetwork({
        networkId,
      }),
    [networkId],
  ).result;

  const onPress = useCallback(async () => {
    try {
      setLoading(true);
      await onConfirm?.({
        amount: amountValue,
        withdrawAll: withdrawAllRef.current,
      });
    } finally {
      setLoading(false);
    }
  }, [amountValue, onConfirm]);

  const [checkAmountMessage, setCheckoutAmountMessage] = useState('');
  const checkAmount = useDebouncedCallback(async (amount: string) => {
    if (isNaN(amount)) {
      return;
    }
    const message = await backgroundApiProxy.serviceStaking.checkAmount({
      accountId,
      networkId,
      symbol: tokenSymbol,
      provider: providerName,
      action: 'unstake',
      amount,
      morphoVault,
      withdrawAll: withdrawAllRef.current,
    });
    setCheckoutAmountMessage(message);
  }, 300);

  const onChangeAmountValue = useCallback(
    (value: string, isMax = false) => {
      if (!validateAmountInput(value, decimals)) {
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
        setAmountValue((oldValue) => oldValue);
      } else {
        setAmountValue(value);
      }
      withdrawAllRef.current = !!isMax;
      void checkAmount(value);
    },
    [checkAmount, decimals],
  );

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

  const isDisable = useMemo(
    () =>
      isNaN(amountValue) ||
      BigNumber(amountValue).isLessThanOrEqualTo(0) ||
      isCheckAmountMessageError,
    [amountValue, isCheckAmountMessageError],
  );

  const editable = initialAmount === undefined;

  const fiatValue = useMemo(
    () =>
      amountValue ? BigNumber(amountValue).multipliedBy(price).toFixed() : 0,
    [amountValue, price],
  );
  const accordionContent = useMemo(() => {
    const items: ReactElement[] = [];
    if (Number(amountValue) <= 0) {
      return items;
    }
    if (estimateFeeResp) {
      items.push(
        <EstimateNetworkFee
          estimateFeeResp={estimateFeeResp}
          isVisible={Number(amountValue) > 0}
        />,
      );
    }
    return items;
  }, [amountValue, estimateFeeResp]);
  const isAccordionTriggerDisabled = !amountValue;

  return (
    <StakingFormWrapper>
      <Stack position="relative" opacity={editable ? 1 : 0.7}>
        <StakingAmountInput
          title={intl.formatMessage({ id: ETranslations.global_withdraw })}
          disabled={!editable}
          hasError={isCheckAmountMessageError}
          value={amountValue}
          onChange={onChangeAmountValue}
          tokenSelectorTriggerProps={{
            selectedTokenImageUri: tokenImageUri,
            selectedTokenSymbol: tokenSymbol,
            selectedNetworkImageUri: network?.logoURI,
          }}
          inputProps={{
            placeholder: '0',
            autoFocus: editable,
          }}
          balanceProps={{
            value: balance,
            iconText: intl.formatMessage({ id: ETranslations.global_withdraw }),
            onPress: onMax,
          }}
          valueProps={{
            value: currentValue,
            currency: currentValue ? symbol : undefined,
          }}
          enableMaxAmount
          onSelectPercentageStage={onSelectPercentageStage}
        />
        {!editable ? (
          <Stack position="absolute" w="100%" h="100%" zIndex={1} />
        ) : null}
      </Stack>

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
      <YStack
        p="$3.5"
        pt="$5"
        borderRadius="$3"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
      >
        <YStack gap="$2">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.earn_receive,
            })}
          </SizableText>
          <SizableText>
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="balance"
              formatterOptions={{ tokenSymbol: tokenSymbol ?? '' }}
            >
              {amountValue || 0}
            </NumberSizeableText>
            {fiatValue ? (
              <SizableText color="$textSubdued">
                <SizableText color="$textSubdued">{' ('}</SizableText>
                <NumberSizeableText
                  size="$bodyLgMedium"
                  formatter="value"
                  color="$textSubdued"
                  formatterOptions={{ currency: symbol }}
                >
                  {fiatValue}
                </NumberSizeableText>
                <SizableText color="$textSubdued">)</SizableText>
              </SizableText>
            ) : null}
          </SizableText>
        </YStack>
        {unstakingPeriod ? (
          <XStack pt="$3.5" gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.earn_unstaking_period,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium">
              {intl.formatMessage(
                {
                  id: showDetailWithdrawalRequested
                    ? ETranslations.earn_claim_available_in_number_days
                    : ETranslations.earn_up_to_number_days,
                },
                { number: unstakingPeriod },
              )}
            </SizableText>
            <Popover.Tooltip
              iconSize="$5"
              title={intl.formatMessage({
                id: ETranslations.earn_unstaking_period,
              })}
              tooltip={intl.formatMessage({
                id: ETranslations.earn_unstaking_period_tooltip,
              })}
              placement="top"
            />
          </XStack>
        ) : null}
        <Divider my="$5" />
        <Accordion
          overflow="hidden"
          width="100%"
          type="single"
          collapsible
          defaultValue={WITHDRAW_ACCORDION_KEY}
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
              cursor={isAccordionTriggerDisabled ? 'not-allowed' : 'pointer'}
              disabled={isAccordionTriggerDisabled}
            >
              {({ open }: { open: boolean }) => (
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
                  <XStack>
                    {isAccordionTriggerDisabled ? undefined : (
                      <SizableText color="$textSubdued" size="$bodyMd">
                        {intl.formatMessage({
                          id: ETranslations.global_details,
                        })}
                      </SizableText>
                    )}
                    <YStack
                      animation="quick"
                      rotate={
                        open && !isAccordionTriggerDisabled ? '180deg' : '0deg'
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
                  </XStack>
                </>
              )}
            </Accordion.Trigger>
            <Accordion.HeightAnimator animation="quick">
              <Accordion.Content
                animation="quick"
                exitStyle={{ opacity: 0 }}
                px={0}
                pb={0}
                pt="$3.5"
                gap="$2.5"
              >
                {accordionContent}
              </Accordion.Content>
            </Accordion.HeightAnimator>
          </Accordion.Item>
        </Accordion>
      </YStack>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_withdraw,
        })}
        confirmButtonProps={{
          onPress,
          loading,
          disabled: isDisable,
        }}
      />

      <Page.Footer>
        <Page.FooterActions
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_withdraw,
          })}
          confirmButtonProps={{
            onPress,
            loading,
            disabled: isDisable,
          }}
        />
        <PercentageStageOnKeyboard
          onSelectPercentageStage={onSelectPercentageStage}
        />
      </Page.Footer>
    </StakingFormWrapper>
  );
};
