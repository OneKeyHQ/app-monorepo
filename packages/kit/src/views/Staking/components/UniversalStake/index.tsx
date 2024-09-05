import type { PropsWithChildren } from 'react';
import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Alert,
  Dialog,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  formatDate,
  formatMillisecondsToDays,
} from '@onekeyhq/shared/src/utils/dateUtils';
import type { IStakeProtocolDetails } from '@onekeyhq/shared/types/staking';

import { capitalizeString } from '../../utils/utils';
import { StakeShouldUnderstand } from '../EarnShouldUnderstand';
import { ValuePriceListItem } from '../ValuePriceListItem';

type IUniversalStakeProps = {
  price: string;
  balance: string;

  details: IStakeProtocolDetails;

  providerLabel?: string;

  tokenImageUri?: string;
  tokenSymbol?: string;

  minAmount?: string;
  maxAmount?: string;

  providerName?: string;
  providerLogo?: string;

  minTransactionFee?: string;
  apr?: number;

  minStakeBlocks?: number;
  minStakeTerm?: number;

  onConfirm?: (amount: string) => Promise<void>;
};

const fieldTitleProps = { color: '$textSubdued', size: '$bodyLg' } as const;

export const UniversalStake = ({
  price,
  balance,
  apr,
  details,
  maxAmount,
  minAmount = '0',
  minTransactionFee = '0',
  providerLabel,
  minStakeTerm,
  minStakeBlocks,
  tokenImageUri,
  tokenSymbol,
  providerName,
  providerLogo,
  onConfirm,
}: PropsWithChildren<IUniversalStakeProps>) => {
  const intl = useIntl();
  const [loading, setLoading] = useState<boolean>(false);
  const [amountValue, setAmountValue] = useState('');
  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();
  // const price = Number.isNaN(inputPrice) ? '0' : inputPrice;
  const onChangeAmountValue = useCallback((value: string) => {
    const valueBN = new BigNumber(value);
    if (valueBN.isNaN()) {
      if (value === '') {
        setAmountValue('');
      }
      return;
    }
    setAmountValue(value);
  }, []);

  const onMax = useCallback(() => {
    const balanceBN = new BigNumber(balance);
    const remainBN = balanceBN.minus(minTransactionFee);
    if (remainBN.gt(0)) {
      onChangeAmountValue(remainBN.toFixed());
    } else {
      onChangeAmountValue(balance);
    }
  }, [onChangeAmountValue, balance, minTransactionFee]);

  const currentValue = useMemo<string | undefined>(() => {
    const amountValueBn = new BigNumber(amountValue);
    if (amountValueBn.isNaN() || !price || Number.isNaN(price))
      return undefined;
    return amountValueBn.multipliedBy(price).toFixed();
  }, [amountValue, price]);

  const isInsufficientBalance = useMemo<boolean>(
    () => new BigNumber(amountValue).gt(balance),
    [amountValue, balance],
  );

  const isLessThanMinAmount = useMemo<boolean>(() => {
    const minAmountBn = new BigNumber(minAmount);
    const amountValueBn = new BigNumber(amountValue);
    if (minAmountBn.isGreaterThan(0) && amountValueBn.isGreaterThan(0)) {
      return amountValueBn.isLessThan(minAmountBn);
    }
    return false;
  }, [minAmount, amountValue]);

  const isGreaterThanMaxAmount = useMemo(() => {
    if (maxAmount && Number(maxAmount) > 0 && Number(amountValue) > 0) {
      return new BigNumber(amountValue).isGreaterThan(maxAmount);
    }
    return false;
  }, [maxAmount, amountValue]);

  const isDisable = useMemo(() => {
    const amountValueBN = BigNumber(amountValue);
    return (
      amountValueBN.isNaN() ||
      amountValueBN.isLessThanOrEqualTo(0) ||
      isInsufficientBalance ||
      isLessThanMinAmount
    );
  }, [amountValue, isInsufficientBalance, isLessThanMinAmount]);

  const estAnnualRewards = useMemo(() => {
    const bn = BigNumber(amountValue);
    if (!amountValue || bn.isNaN() || !price || Number.isNaN(price) || !apr) {
      return null;
    }
    const amountBN = BigNumber(amountValue).multipliedBy(apr).dividedBy(100);
    return (
      <ValuePriceListItem
        amount={amountBN.toFixed()}
        tokenSymbol={tokenSymbol ?? ''}
        fiatSymbol={symbol}
        fiatValue={amountBN.multipliedBy(price).toFixed()}
      />
    );
  }, [amountValue, apr, price, symbol, tokenSymbol]);

  const btcStakeTerm = useMemo(() => {
    if (minStakeTerm && minStakeBlocks) {
      const days = formatMillisecondsToDays(minStakeTerm);
      return intl.formatMessage(
        { id: ETranslations.earn_number_days_number_block },
        { 'number_days': days, 'number': minStakeBlocks },
      );
    }
    return null;
  }, [minStakeTerm, minStakeBlocks, intl]);

  const btcUnlockTime = useMemo(() => {
    if (minStakeTerm) {
      const currentDate = new Date();
      const endDate = new Date(currentDate.getTime() + minStakeTerm);
      return formatDate(endDate, { hideTimeForever: true });
    }
    return null;
  }, [minStakeTerm]);

  const onPress = useCallback(async () => {
    Dialog.show({
      renderContent: (
        <StakeShouldUnderstand
          provider={details.provider.name.toLowerCase()}
          symbol={details.token.info.symbol.toLowerCase()}
          logoURI={details.token.info.logoURI}
          apr={details.provider.apr}
          updateFrequency={details.updateFrequency}
          unstakingPeriod={details.unstakingPeriod}
          receiveSymbol={details.rewardToken}
        />
      ),
      onConfirm: async (inst) => {
        try {
          setLoading(true);
          await inst.close();
          await onConfirm?.(amountValue);
        } finally {
          setLoading(false);
        }
      },
      onConfirmText: intl.formatMessage({ id: ETranslations.earn_stake }),
      showCancelButton: false,
    });
  }, [onConfirm, amountValue, details, intl]);

  return (
    <YStack>
      <Stack mx="$2" px="$3" gap="$5">
        <AmountInput
          hasError={isInsufficientBalance || isLessThanMinAmount}
          value={amountValue}
          onChange={onChangeAmountValue}
          tokenSelectorTriggerProps={{
            selectedTokenImageUri: tokenImageUri,
            selectedTokenSymbol: tokenSymbol?.toUpperCase(),
          }}
          balanceProps={{
            value: balance,
            onPress: onMax,
          }}
          inputProps={{
            placeholder: '0',
          }}
          valueProps={{
            value: currentValue,
            currency: currentValue ? symbol : undefined,
          }}
          enableMaxAmount
        />
        <YStack gap="$1">
          {isLessThanMinAmount ? (
            <Alert
              icon="InfoCircleOutline"
              type="critical"
              title={intl.formatMessage(
                { id: ETranslations.earn_minimum_amount },
                { number: minAmount, symbol: tokenSymbol },
              )}
            />
          ) : null}
          {isInsufficientBalance ? (
            <Alert
              icon="InfoCircleOutline"
              type="critical"
              title={intl.formatMessage({
                id: ETranslations.earn_insufficient_balance,
              })}
            />
          ) : null}
          {isGreaterThanMaxAmount ? (
            <Alert
              icon="InfoCircleOutline"
              type="critical"
              title={intl.formatMessage(
                {
                  id: ETranslations.earn_maximum_staking_alert,
                },
                { number: maxAmount ?? '', symbol: tokenSymbol },
              )}
            />
          ) : null}
        </YStack>
      </Stack>
      <Stack>
        <YStack>
          {estAnnualRewards ? (
            <ListItem
              title={intl.formatMessage({
                id: ETranslations.earn_est_annual_rewards,
              })}
              titleProps={fieldTitleProps}
            >
              {estAnnualRewards}
            </ListItem>
          ) : null}
          {apr && Number(apr) > 0 ? (
            <ListItem
              title={intl.formatMessage({ id: ETranslations.global_apr })}
              titleProps={fieldTitleProps}
            >
              <ListItem.Text
                primary={`${apr}%`}
                primaryTextProps={{ color: '$textSuccess' }}
              />
            </ListItem>
          ) : null}
          {btcStakeTerm ? (
            <ListItem
              title={intl.formatMessage({ id: ETranslations.earn_term })}
              titleProps={fieldTitleProps}
            >
              <ListItem.Text primary={btcStakeTerm} />
            </ListItem>
          ) : null}
          {btcUnlockTime ? (
            <ListItem
              title={intl.formatMessage({ id: ETranslations.earn_unlock_time })}
              titleProps={fieldTitleProps}
            >
              <ListItem.Text primary={btcUnlockTime} />
            </ListItem>
          ) : null}
          {providerLogo && providerName ? (
            <ListItem
              title={
                providerLabel ??
                intl.formatMessage({ id: ETranslations.global_protocol })
              }
              titleProps={fieldTitleProps}
            >
              <XStack gap="$2" alignItems="center">
                <Token size="xs" tokenImageUri={providerLogo} />
                <SizableText size="$bodyLgMedium">
                  {capitalizeString(providerName)}
                </SizableText>
              </XStack>
            </ListItem>
          ) : null}
        </YStack>
      </Stack>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_continue,
        })}
        confirmButtonProps={{
          onPress,
          loading,
          disabled: isDisable,
        }}
      />
    </YStack>
  );
};
