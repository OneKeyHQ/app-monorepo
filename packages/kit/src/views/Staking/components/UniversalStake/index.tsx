import type { PropsWithChildren, ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { Keyboard, StyleSheet } from 'react-native';
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
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import type { IFeeUTXO } from '@onekeyhq/shared/types/fee';
import type {
  IEarnEstimateFeeResp,
  IEarnTokenInfo,
  IProtocolInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { capitalizeString, countDecimalPlaces } from '../../utils/utils';
import { BtcFeeRateInput } from '../BtcFeeRateInput';
import { CalculationListItem } from '../CalculationList';
import {
  EstimateNetworkFee,
  useShowStakeEstimateGasAlert,
} from '../EstimateNetworkFee';
import { StakingAmountInput } from '../StakingAmountInput';
import StakingFormWrapper from '../StakingFormWrapper';
import { TradeOrBuy } from '../TradeOrBuy';
import { formatApy, formatStakingDistanceToNowStrict } from '../utils';

type IUniversalStakeProps = {
  accountId: string;
  networkId: string;
  price: string;
  balance: string;

  providerLabel?: string;

  tokenImageUri?: string;
  tokenSymbol?: string;

  decimals?: number;

  minAmount?: string;
  maxAmount?: string;

  providerName?: string;
  providerLogo?: string;

  minTransactionFee?: string;
  apr?: string;

  showEstReceive?: boolean;
  estReceiveToken?: string;
  estReceiveTokenRate?: string;

  minStakeBlocks?: number;
  minStakeTerm?: number;

  isReachBabylonCap?: boolean;
  isDisabled?: boolean;

  estimateFeeUTXO?: Required<Pick<IFeeUTXO, 'feeRate'>>[];

  onConfirm?: (amount: string) => Promise<void>;
  onFeeRateChange?: (rate: string) => void;

  stakingTime?: number;
  nextLaunchLeft?: string;
  rewardToken?: string;
  updateFrequency?: string;

  tokenInfo?: IEarnTokenInfo;
  protocolInfo?: IProtocolInfo;
};

export function UniversalStake({
  accountId,
  networkId,
  price,
  balance,
  apr,
  decimals,
  minAmount = '0',
  minTransactionFee = '0',
  providerLabel,
  minStakeTerm,
  minStakeBlocks,
  tokenImageUri,
  tokenSymbol,
  providerName = '',
  providerLogo,
  isReachBabylonCap,
  showEstReceive,
  estReceiveToken,
  estReceiveTokenRate = '1',
  estimateFeeUTXO,
  isDisabled,
  maxAmount,
  onConfirm,
  onFeeRateChange,
  stakingTime,
  nextLaunchLeft,
  rewardToken,
  updateFrequency,
  protocolInfo,
  tokenInfo,
}: PropsWithChildren<IUniversalStakeProps>) {
  const intl = useIntl();
  const showEstimateGasAlert = useShowStakeEstimateGasAlert();
  const [amountValue, setAmountValue] = useState('');
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

  const [estimateFeeResp, setEstimateFeeResp] = useState<
    undefined | IEarnEstimateFeeResp
  >();

  const fetchEstimateFeeResp = useDebouncedCallback(async (amount?: string) => {
    if (!amount) {
      setEstimateFeeResp(undefined);
      return;
    }
    const amountNumber = BigNumber(amount);
    if (amountNumber.isZero() || amountNumber.isNaN()) {
      return;
    }
    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId,
      networkId,
    });
    const resp = await backgroundApiProxy.serviceStaking.estimateFee({
      networkId,
      provider: providerName,
      symbol: tokenInfo?.token.symbol || '',
      action: 'stake',
      amount: amountNumber.toFixed(),
      morphoVault: earnUtils.isMorphoProvider({ providerName })
        ? protocolInfo?.approve?.approveTarget
        : undefined,
      accountAddress: account?.address,
    });
    setEstimateFeeResp(resp);
  }, 350);

  const onChangeAmountValue = useCallback(
    (value: string) => {
      if (!validateAmountInput(value, decimals)) {
        return;
      }
      const valueBN = new BigNumber(value);
      if (valueBN.isNaN()) {
        if (value === '') {
          setAmountValue('');
          void fetchEstimateFeeResp();
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
        void fetchEstimateFeeResp(value);
      }
    },
    [decimals, fetchEstimateFeeResp],
  );

  const onMax = useCallback(() => {
    const balanceBN = new BigNumber(balance);
    const remainBN = balanceBN.minus(minTransactionFee);
    if (remainBN.gt(0)) {
      onChangeAmountValue(remainBN.toFixed());
    } else {
      onChangeAmountValue(balance);
    }
  }, [onChangeAmountValue, balance, minTransactionFee]);

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
      const amountValueBn = new BigNumber(amountValue);
      return amountValueBn.multipliedBy(price).toFixed();
    }
    return undefined;
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
      isLessThanMinAmount ||
      isGreaterThanMaxAmount ||
      isReachBabylonCap
    );
  }, [
    amountValue,
    isInsufficientBalance,
    isLessThanMinAmount,
    isGreaterThanMaxAmount,
    isReachBabylonCap,
  ]);

  const estAnnualRewardsState = useMemo(() => {
    if (Number(amountValue) > 0 && Number(apr) > 0) {
      const amountBN = BigNumber(amountValue)
        .multipliedBy(apr ?? 0)
        .dividedBy(100);
      return {
        amount: amountBN.toFixed(),
        fiatValue:
          Number(price) > 0
            ? amountBN.multipliedBy(price).toFixed()
            : undefined,
      };
    }
  }, [amountValue, apr, price]);

  const btcStakeTerm = useMemo(() => {
    if (minStakeTerm && Number(minStakeTerm) > 0 && minStakeBlocks) {
      const days = Math.ceil(minStakeTerm / (1000 * 60 * 60 * 24));
      return (
        <SizableText size="$bodyLgMedium">
          {intl.formatMessage(
            { id: ETranslations.earn_term_number_days },
            { number_days: days },
          )}
          <SizableText size="$bodyLgMedium" color="$textSubdued">
            {intl.formatMessage(
              { id: ETranslations.earn_term_number_block },
              { number: minStakeBlocks },
            )}
          </SizableText>
        </SizableText>
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

  const daysSpent = useMemo(() => {
    if (estimateFeeResp?.coverFeeSeconds) {
      return formatStakingDistanceToNowStrict(estimateFeeResp.coverFeeSeconds);
    }
  }, [estimateFeeResp?.coverFeeSeconds]);

  const onPress = useCallback(async () => {
    Keyboard.dismiss();
    const handleConfirm = () => onConfirm?.(amountValue);
    if (estAnnualRewardsState?.fiatValue && estimateFeeResp) {
      const daySpent =
        Number(estimateFeeResp?.coverFeeSeconds || 0) / 3600 / 24;

      if (daySpent && daySpent > 5) {
        showEstimateGasAlert({
          daysConsumed: formatStakingDistanceToNowStrict(
            estimateFeeResp.coverFeeSeconds,
          ),
          estFiatValue: estimateFeeResp.feeFiatValue,
          onConfirm: handleConfirm,
        });
        return;
      }
    }
    await handleConfirm();
  }, [
    onConfirm,
    amountValue,
    estAnnualRewardsState?.fiatValue,
    estimateFeeResp,
    showEstimateGasAlert,
  ]);
  const accordionContent = useMemo(() => {
    const items: ReactElement[] = [];
    if (Number(amountValue) <= 0) {
      return items;
    }
    if (showEstReceive && estReceiveToken) {
      items.push(
        <CalculationListItem>
          <CalculationListItem.Label
            size="$bodyMd"
            tooltip={intl.formatMessage({
              id: ETranslations.earn_est_receive_tooltip,
            })}
          >
            {intl.formatMessage({
              id: ETranslations.earn_est_receive,
            })}
          </CalculationListItem.Label>
          <CalculationListItem.Value>
            <NumberSizeableText
              formatter="balance"
              size="$bodyMdMedium"
              formatterOptions={{ tokenSymbol: estReceiveToken }}
            >
              {BigNumber(amountValue)
                .multipliedBy(estReceiveTokenRate)
                .toFixed()}
            </NumberSizeableText>
          </CalculationListItem.Value>
        </CalculationListItem>,
      );
    }
    if (estimateFeeResp) {
      items.push(
        <EstimateNetworkFee
          estimateFeeResp={estimateFeeResp}
          isVisible={!!estAnnualRewardsState?.fiatValue}
          onPress={() => {
            showEstimateGasAlert({
              daysConsumed: daysSpent,
              estFiatValue: estimateFeeResp.feeFiatValue,
            });
          }}
        />,
      );
    }

    if (
      providerName?.toLowerCase() === EEarnProviderEnum.Babylon.toLowerCase() &&
      estimateFeeUTXO
    ) {
      items.push(
        <BtcFeeRateInput
          estimateFeeUTXO={estimateFeeUTXO}
          onFeeRateChange={onFeeRateChange}
        />,
      );
    }
    return items;
  }, [
    amountValue,
    daysSpent,
    estAnnualRewardsState?.fiatValue,
    estReceiveToken,
    estReceiveTokenRate,
    estimateFeeResp,
    estimateFeeUTXO,
    intl,
    onFeeRateChange,
    providerName,
    showEstReceive,
    showEstimateGasAlert,
  ]);
  const isAccordionTriggerDisabled = !amountValue;
  return (
    <StakingFormWrapper>
      <Stack position="relative" opacity={isDisabled ? 0.7 : 1}>
        <StakingAmountInput
          title={intl.formatMessage({ id: ETranslations.earn_deposit })}
          disabled={isDisabled}
          hasError={isInsufficientBalance || isLessThanMinAmount}
          value={amountValue}
          onChange={onChangeAmountValue}
          tokenSelectorTriggerProps={{
            selectedTokenImageUri: tokenImageUri,
            selectedTokenSymbol: tokenSymbol?.toUpperCase(),
            selectedNetworkImageUri: network?.logoURI,
          }}
          balanceProps={{
            value: balance,
            onPress: onMax,
          }}
          inputProps={{
            placeholder: '0',
            autoFocus: !isDisabled,
          }}
          valueProps={{
            value: currentValue,
            currency: currentValue ? symbol : undefined,
          }}
          enableMaxAmount
          onSelectPercentageStage={onSelectPercentageStage}
        />
        {isDisabled ? (
          <Stack position="absolute" w="100%" h="100%" zIndex={1} />
        ) : null}
      </Stack>

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
      {isReachBabylonCap ? (
        <Alert
          icon="InfoCircleOutline"
          type="critical"
          title={intl.formatMessage({
            id: ETranslations.earn_reaching_staking_cap,
          })}
        />
      ) : null}

      <YStack
        p="$3.5"
        pt="$5"
        borderRadius="$3"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
      >
        {!btcStakeTerm && apr && Number(apr) > 0 ? (
          <XStack gap="$1" ai="center">
            <SizableText color="$textSuccess" size="$headingLg">
              {`${formatApy(apr)}% APY`}
            </SizableText>
            {protocolInfo?.apys ? (
              <Popover
                floatingPanelProps={{
                  w: 320,
                }}
                title={intl.formatMessage({
                  id: ETranslations.earn_rewards,
                })}
                renderTrigger={
                  <IconButton
                    icon="CoinsAddOutline"
                    size="small"
                    variant="tertiary"
                  />
                }
                renderContent={null}
                placement="top"
              />
            ) : null}
          </XStack>
        ) : null}
        {!btcStakeTerm ? (
          <YStack pt="$3.5" gap="$2">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.earn_est_annual_rewards,
              })}
            </SizableText>
            <SizableText>
              <NumberSizeableText
                size="$bodyLgMedium"
                formatter="balance"
                formatterOptions={{ tokenSymbol: tokenSymbol ?? '' }}
              >
                {estAnnualRewardsState?.amount || 0}
              </NumberSizeableText>
              {estAnnualRewardsState?.fiatValue ? (
                <SizableText color="$textSubdued">
                  <SizableText color="$textSubdued">{' ('}</SizableText>
                  <NumberSizeableText
                    size="$bodyLgMedium"
                    formatter="value"
                    color="$textSubdued"
                    formatterOptions={{ currency: symbol }}
                  >
                    {estAnnualRewardsState?.fiatValue}
                  </NumberSizeableText>
                  <SizableText color="$textSubdued">)</SizableText>
                </SizableText>
              ) : null}
            </SizableText>
          </YStack>
        ) : null}
        {btcStakeTerm ? (
          <YStack gap="$2">
            <XStack gap="$1">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.earn_term,
                })}
              </SizableText>
              <Popover.Tooltip
                iconSize="$5"
                title={intl.formatMessage({
                  id: ETranslations.earn_term,
                })}
                tooltip={intl.formatMessage({
                  id: ETranslations.earn_term_tooltip,
                })}
                placement="top"
              />
            </XStack>
            {btcStakeTerm}
          </YStack>
        ) : null}
        {stakingTime ? (
          <XStack pt="$3.5" gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.earn_earnings_start })}
            </SizableText>
            <SizableText size="$bodyMdMedium">
              {intl.formatMessage(
                { id: ETranslations.earn_in_number },
                {
                  number: formatStakingDistanceToNowStrict(stakingTime),
                },
              )}
            </SizableText>
          </XStack>
        ) : null}
        {nextLaunchLeft && rewardToken ? (
          <XStack pt="$3.5" gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.earn_until_next_launch,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium">
              {intl.formatMessage(
                { id: ETranslations.earn_number_symbol_left },
                {
                  number: Number(nextLaunchLeft).toFixed(2),
                  symbol: rewardToken,
                },
              )}
            </SizableText>
            <Popover.Tooltip
              iconSize="$5"
              title={intl.formatMessage({
                id: ETranslations.earn_until_next_launch,
              })}
              tooltip={intl.formatMessage({
                id: ETranslations.earn_until_next_launch_tooltip,
              })}
              placement="top"
            />
          </XStack>
        ) : null}
        {btcUnlockTime ? (
          <XStack pt="$3.5" gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.earn_unlock_time,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium">{btcUnlockTime}</SizableText>
          </XStack>
        ) : null}
        <Divider my="$5" />
        <Accordion
          overflow="hidden"
          width="100%"
          type="single"
          collapsible
          defaultValue=""
        >
          <Accordion.Item value="staking-accordion-content">
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
        <TradeOrBuy
          token={tokenInfo?.token as IToken}
          accountId={accountId}
          networkId={networkId}
        />
      </YStack>
      <Page.Footer>
        <Page.FooterActions
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_continue,
          })}
          confirmButtonProps={{
            onPress,
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
