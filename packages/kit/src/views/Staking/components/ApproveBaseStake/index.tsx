import type { PropsWithChildren } from 'react';
import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Alert,
  Dialog,
  Image,
  NumberSizeableText,
  Page,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { useSendConfirm } from '@onekeyhq/kit/src/hooks/useSendConfirm';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IEarnEstimateFeeResp,
  IStakeProtocolDetails,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { useTrackTokenAllowance } from '../../hooks/useUtilsHooks';
import { capitalizeString, countDecimalPlaces } from '../../utils/utils';
import { CalculationList, CalculationListItem } from '../CalculationList';
import { StakeShouldUnderstand } from '../EarnShouldUnderstand';
import {
  EstimateNetworkFee,
  calcDaysSpent,
  useShowStakeEstimateGasAlert,
} from '../EstimateNetworkFee';
import StakingFormWrapper from '../StakingFormWrapper';
import { TradeOrBuy } from '../TradeOrBuy';
import { ValuePriceListItem } from '../ValuePriceListItem';

type IApproveBaseStakeProps = {
  details: IStakeProtocolDetails;

  price: string;
  balance: string;
  token: IToken;
  approveTarget: {
    accountId: string;
    networkId: string;
    spenderAddress: string;
    token: IToken;
  };

  providerLabel?: string;

  currentAllowance?: string;
  apr?: string;
  minAmount?: string;
  decimals?: number;

  showEstReceive?: boolean;
  estReceiveToken?: string;
  estReceiveTokenRate?: string;

  estimateFeeResp?: IEarnEstimateFeeResp;

  providerName?: string;
  providerLogo?: string;
  onConfirm?: (amount: string) => Promise<void>;
};

export const ApproveBaseStake = ({
  details,

  price,
  balance,
  token,
  apr,
  decimals,
  minAmount = '0',
  currentAllowance = '0',
  providerName,
  providerLogo,
  onConfirm,
  approveTarget,

  providerLabel,
  estimateFeeResp,
  showEstReceive,
  estReceiveToken,
  estReceiveTokenRate = '1',
}: PropsWithChildren<IApproveBaseStakeProps>) => {
  const intl = useIntl();
  const showEstimateGasAlert = useShowStakeEstimateGasAlert();
  const { navigationToSendConfirm } = useSendConfirm({
    accountId: approveTarget.accountId,
    networkId: approveTarget.networkId,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [approving, setApproving] = useState<boolean>(false);
  const {
    allowance,
    loading: loadingAllowance,
    trackAllowance,
  } = useTrackTokenAllowance({
    accountId: approveTarget.accountId,
    networkId: approveTarget.networkId,
    tokenAddress: approveTarget.token.address,
    spenderAddress: approveTarget.spenderAddress,
    initialValue: currentAllowance,
  });
  const [amountValue, setAmountValue] = useState('');
  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();

  const onChangeAmountValue = useCallback(
    (value: string) => {
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
    },
    [decimals],
  );

  const currentValue = useMemo<string | undefined>(() => {
    const amountValueBn = new BigNumber(amountValue);
    if (amountValueBn.isNaN()) return undefined;
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

  const isDisable = useMemo(() => {
    const amountValueBN = BigNumber(amountValue);
    return (
      amountValueBN.isNaN() ||
      amountValueBN.lte(0) ||
      isInsufficientBalance ||
      isLessThanMinAmount
    );
  }, [amountValue, isInsufficientBalance, isLessThanMinAmount]);

  const isApprove = useMemo(() => {
    const amountValueBN = BigNumber(amountValue);
    const allowanceBN = new BigNumber(allowance);
    return !amountValueBN.isNaN() && allowanceBN.lt(amountValue);
  }, [amountValue, allowance]);

  const onConfirmText = useMemo(() => {
    if (isApprove) {
      return intl.formatMessage(
        { id: ETranslations.form__approve_str },
        { amount: amountValue, symbol: token.symbol.toUpperCase() },
      );
    }
    return intl.formatMessage({ id: ETranslations.earn_stake });
  }, [isApprove, token, amountValue, intl]);

  const onApprove = useCallback(async () => {
    setApproving(true);
    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId: approveTarget.accountId,
      networkId: approveTarget.networkId,
    });
    await navigationToSendConfirm({
      approvesInfo: [
        {
          owner: account.address,
          spender: approveTarget.spenderAddress,
          amount: amountValue,
          tokenInfo: approveTarget.token,
        },
      ],
      onSuccess(data) {
        trackAllowance(data[0].decodedTx.txid);
        setApproving(false);
      },
      onFail() {
        setApproving(false);
      },
      onCancel() {
        setApproving(false);
      },
    });
  }, [amountValue, approveTarget, navigationToSendConfirm, trackAllowance]);

  const onMax = useCallback(() => {
    onChangeAmountValue(balance);
  }, [onChangeAmountValue, balance]);

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

  const daysSpent = useMemo(() => {
    if (estAnnualRewardsState?.fiatValue && estimateFeeResp?.feeFiatValue) {
      return calcDaysSpent(
        estAnnualRewardsState?.fiatValue,
        estimateFeeResp.feeFiatValue,
      );
    }
  }, [estimateFeeResp?.feeFiatValue, estAnnualRewardsState?.fiatValue]);

  const onSubmit = useCallback(async () => {
    const showDialog = () => {
      Dialog.show({
        renderIcon: (
          <Image width="$14" height="$14" src={details.token.info.logoURI} />
        ),
        title: intl.formatMessage(
          { id: ETranslations.earn_provider_asset_staking },
          {
            'provider': capitalizeString(details.provider.name.toLowerCase()),
            'asset': details.token.info.symbol.toUpperCase(),
          },
        ),
        renderContent: (
          <StakeShouldUnderstand
            provider={details.provider.name.toLowerCase()}
            symbol={details.token.info.symbol.toLowerCase()}
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
    };
    if (estAnnualRewardsState?.fiatValue && estimateFeeResp) {
      const daySpent = calcDaysSpent(
        estAnnualRewardsState.fiatValue,
        estimateFeeResp.feeFiatValue,
      );
      if (daySpent && daySpent > 5) {
        showEstimateGasAlert({
          daysConsumed: daySpent,
          estFiatValue: estimateFeeResp.feeFiatValue,
          onConfirm: showDialog,
        });
        return;
      }
    }
    showDialog();
  }, [
    onConfirm,
    amountValue,
    estAnnualRewardsState,
    estimateFeeResp,
    showEstimateGasAlert,
    details,
    intl,
  ]);

  return (
    <StakingFormWrapper>
      <AmountInput
        hasError={isInsufficientBalance || isLessThanMinAmount}
        value={amountValue}
        onChange={onChangeAmountValue}
        tokenSelectorTriggerProps={{
          selectedTokenImageUri: token.logoURI,
          selectedTokenSymbol: token.symbol.toUpperCase(),
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
      {isLessThanMinAmount ? (
        <Alert
          icon="InfoCircleOutline"
          type="critical"
          title={intl.formatMessage(
            { id: ETranslations.earn_minimum_amount },
            { number: `${minAmount} ${token.symbol}` },
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
      <CalculationList>
        {estAnnualRewardsState ? (
          <CalculationListItem>
            <CalculationListItem.Label>
              {intl.formatMessage({
                id: ETranslations.earn_est_annual_rewards,
              })}
            </CalculationListItem.Label>
            <CalculationListItem.Value>
              <ValuePriceListItem
                tokenSymbol={token.symbol}
                fiatSymbol={symbol}
                amount={estAnnualRewardsState.amount}
                fiatValue={estAnnualRewardsState.fiatValue}
              />
            </CalculationListItem.Value>
          </CalculationListItem>
        ) : null}
        {showEstReceive && estReceiveToken && Number(amountValue) > 0 ? (
          <CalculationListItem>
            <CalculationListItem.Label>
              {intl.formatMessage({ id: ETranslations.earn_est_receive })}
            </CalculationListItem.Label>
            <CalculationListItem.Value>
              <SizableText>
                <NumberSizeableText
                  formatter="balance"
                  size="$bodyLgMedium"
                  formatterOptions={{ tokenSymbol: estReceiveToken }}
                >
                  {BigNumber(amountValue)
                    .multipliedBy(estReceiveTokenRate)
                    .toFixed()}
                </NumberSizeableText>
              </SizableText>
            </CalculationListItem.Value>
          </CalculationListItem>
        ) : null}
        {apr && Number(apr) > 0 ? (
          <CalculationListItem>
            <CalculationListItem.Label>
              {intl.formatMessage({ id: ETranslations.global_apr })}
            </CalculationListItem.Label>
            <CalculationListItem.Value color="$textSuccess">{`${apr}%`}</CalculationListItem.Value>
          </CalculationListItem>
        ) : null}
        {providerName && providerLogo ? (
          <CalculationListItem>
            <CalculationListItem.Label>
              {providerLabel ??
                intl.formatMessage({ id: ETranslations.global_protocol })}
            </CalculationListItem.Label>
            <CalculationListItem.Value>
              <XStack gap="$2" alignItems="center">
                <Image
                  width="$5"
                  height="$5"
                  src={providerLogo}
                  borderRadius="$2"
                />
                <SizableText size="$bodyLgMedium">
                  {capitalizeString(providerName)}
                </SizableText>
              </XStack>
            </CalculationListItem.Value>
          </CalculationListItem>
        ) : null}
        {estimateFeeResp ? (
          <EstimateNetworkFee
            estimateFeeResp={estimateFeeResp}
            isVisible={!!estAnnualRewardsState?.fiatValue}
            onPress={() => {
              showEstimateGasAlert({
                daysConsumed: daysSpent,
                estFiatValue: estimateFeeResp.feeFiatValue,
              });
            }}
          />
        ) : null}
      </CalculationList>
      <TradeOrBuy
        token={details.token.info}
        accountId={approveTarget.accountId}
        networkId={approveTarget.networkId}
      />
      <Page.Footer
        onConfirmText={onConfirmText}
        confirmButtonProps={{
          onPress: isApprove ? onApprove : onSubmit,
          loading: loading || loadingAllowance || approving,
          disabled: isDisable,
        }}
      />
    </StakingFormWrapper>
  );
};
