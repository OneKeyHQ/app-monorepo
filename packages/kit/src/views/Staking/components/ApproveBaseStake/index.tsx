import type { PropsWithChildren } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { BundlerAction } from '@morpho-org/bundler-sdk-ethers';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethersV6';
import { useIntl } from 'react-intl';

import {
  Alert,
  Image,
  NumberSizeableText,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import { EApproveType } from '@onekeyhq/shared/types/staking';
import type {
  IApproveConfirmFnParams,
  IEarnEstimateFeeResp,
  IStakeProtocolDetails,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { useTrackTokenAllowance } from '../../hooks/useUtilsHooks';
import { capitalizeString, countDecimalPlaces } from '../../utils/utils';
import { CalculationList, CalculationListItem } from '../CalculationList';
import {
  EstimateNetworkFee,
  calcDaysSpent,
  useShowStakeEstimateGasAlert,
} from '../EstimateNetworkFee';
import { EStakeProgressStep, StakeProgress } from '../StakeProgress';
import StakingFormWrapper from '../StakingFormWrapper';
import { TradeOrBuy } from '../TradeOrBuy';
import { renderStakeText } from '../utils';
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
  onConfirm?: (params: IApproveConfirmFnParams) => Promise<void>;
};

type ITokenAnnualReward = {
  amount: string;
  fiatValue?: string;
  token: IToken;
};

export function ApproveBaseStake({
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
}: PropsWithChildren<IApproveBaseStakeProps>) {
  const intl = useIntl();
  const showEstimateGasAlert = useShowStakeEstimateGasAlert();
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId: approveTarget.accountId,
    networkId: approveTarget.networkId,
  });
  const network = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getNetwork({
        networkId: approveTarget.networkId,
      }),
    [approveTarget.networkId],
  ).result;
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

  const usePermit2Approve =
    details.provider?.approveType === EApproveType.Permit;
  const [isFinishPermit2Approve, setIsFinishPermit2Approve] = useState(false);
  const permitSignatureRef = useRef<string | undefined>(undefined);

  const shouldApprove = useMemo(() => {
    if (usePermit2Approve && !isFinishPermit2Approve) {
      return true;
    }
    const amountValueBN = BigNumber(amountValue);
    const allowanceBN = new BigNumber(allowance);
    return !amountValueBN.isNaN() && allowanceBN.lt(amountValue);
  }, [amountValue, allowance, usePermit2Approve, isFinishPermit2Approve]);

  const onConfirmText = useMemo(() => {
    if (shouldApprove) {
      return intl.formatMessage(
        { id: ETranslations.form__approve_str },
        { amount: amountValue, symbol: token.symbol },
      );
    }
    return intl.formatMessage({ id: renderStakeText(details.provider.name) });
  }, [shouldApprove, intl, details.provider.name, amountValue, token.symbol]);

  const onMax = useCallback(() => {
    onChangeAmountValue(balance);
  }, [onChangeAmountValue, balance]);

  const estimatedAnnualRewards = useMemo<ITokenAnnualReward[]>(() => {
    const amountBN = new BigNumber(amountValue);
    if (amountBN.isNaN() || amountBN.lte(0)) return [];

    const rewards: ITokenAnnualReward[] = [];

    if (details.provider.apys) {
      // handle base token reward
      const baseRateBN = new BigNumber(details.provider.apys.rate);
      if (baseRateBN.gt(0)) {
        const baseAmount = amountBN.multipliedBy(baseRateBN).dividedBy(100);

        rewards.push({
          amount: baseAmount.toFixed(),
          fiatValue: new BigNumber(price).gt(0)
            ? baseAmount.multipliedBy(price).toFixed()
            : undefined,
          token: details.token.info,
        });
      }

      // handle extra token reward
      const { rewards: extraRewards } = details.provider.apys;
      if (extraRewards && details.rewardAssets) {
        Object.entries(extraRewards).forEach(([tokenAddress, apy]) => {
          const rewardToken = details.rewardAssets?.[tokenAddress];
          const apyBN = new BigNumber(apy);
          if (rewardToken && apyBN.gt(0)) {
            const rewardAmount = amountBN
              .multipliedBy(price)
              .multipliedBy(apyBN)
              .dividedBy(100)
              .dividedBy(rewardToken.price);

            rewards.push({
              amount: rewardAmount.toFixed(),
              token: rewardToken.info,
              fiatValue: new BigNumber(rewardToken.price).gt(0)
                ? rewardAmount.multipliedBy(rewardToken.price).toFixed()
                : undefined,
            });
          }
        });
      }
    } else {
      // handle single token reward
      const aprBN = new BigNumber(apr ?? 0);
      if (aprBN.gt(0)) {
        const rewardAmount = amountBN.multipliedBy(aprBN).dividedBy(100);

        rewards.push({
          amount: rewardAmount.toFixed(),
          fiatValue: new BigNumber(price).gt(0)
            ? rewardAmount.multipliedBy(price).toFixed()
            : undefined,
          token,
        });
      }
    }

    return rewards;
  }, [amountValue, apr, price, details, token]);

  const totalAnnualRewardsFiatValue = useMemo(() => {
    if (!estimatedAnnualRewards.length) return undefined;

    return estimatedAnnualRewards
      .reduce((total, reward) => {
        if (reward.fiatValue) {
          return total.plus(reward.fiatValue);
        }
        return total;
      }, new BigNumber(0))
      .toFixed();
  }, [estimatedAnnualRewards]);

  const daysSpent = useMemo(() => {
    if (totalAnnualRewardsFiatValue && estimateFeeResp?.feeFiatValue) {
      return calcDaysSpent(
        totalAnnualRewardsFiatValue,
        estimateFeeResp.feeFiatValue,
      );
    }
  }, [estimateFeeResp?.feeFiatValue, totalAnnualRewardsFiatValue]);

  const onSubmit = useCallback(async () => {
    const handleConfirm = () =>
      onConfirm?.({
        amount: amountValue,
        usePermit2Approve,
        permitSignature: permitSignatureRef.current,
      });
    if (totalAnnualRewardsFiatValue && estimateFeeResp) {
      const daySpent = calcDaysSpent(
        totalAnnualRewardsFiatValue,
        estimateFeeResp.feeFiatValue,
      );
      if (daySpent && daySpent > 5) {
        showEstimateGasAlert({
          daysConsumed: daySpent,
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
    totalAnnualRewardsFiatValue,
    estimateFeeResp,
    showEstimateGasAlert,
    usePermit2Approve,
    permitSignatureRef,
  ]);

  const onApprove = useCallback(async () => {
    setApproving(true);
    permitSignatureRef.current = undefined;
    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId: approveTarget.accountId,
      networkId: approveTarget.networkId,
    });

    if (usePermit2Approve) {
      if (isFinishPermit2Approve) {
        return;
      }

      const permit2Data =
        await backgroundApiProxy.serviceStaking.buildPermit2ApproveSignData({
          networkId: approveTarget.networkId,
          provider: details.provider.name,
          symbol: token.symbol,
          accountAddress: account.address,
          vault: details.provider.vault ?? '',
          amount: new BigNumber(amountValue).toFixed(),
        });

      console.log('permit2Data: ', permit2Data);

      const unsignedMessage = JSON.stringify(permit2Data);

      console.log('unsignedMessage: ', unsignedMessage);

      const signHash =
        (await backgroundApiProxy.serviceDApp.openSignMessageModal({
          accountId: approveTarget.accountId,
          networkId: approveTarget.networkId,
          request: { origin: 'https://app.morpho.org/', scope: 'ethereum' },
          unsignedMessage: {
            type: EMessageTypesEth.TYPED_DATA_V4,
            message: unsignedMessage,
            payload: [account.address, unsignedMessage],
          },
          walletInternalSign: true,
        })) as string;

      console.log('signHash: ', signHash);
      let permitBundlerAction;
      if (token.symbol === 'USDC') {
        permitBundlerAction = BundlerAction.permit(
          permit2Data.domain.verifyingContract,
          permit2Data.message.value,
          permit2Data.message.deadline,
          // @ts-expect-error
          ethers.Signature.from(signHash),
          true,
        );
      } else if (token.symbol === 'DAI') {
        if (!permit2Data.message.expiry) {
          throw new Error('Expiry is required for DAI');
        }
        permitBundlerAction = BundlerAction.permitDai(
          permit2Data.message.nonce,
          permit2Data.message.expiry,
          true,
          // @ts-expect-error
          ethers.Signature.from(signHash),
          false,
        );
      } else {
        throw new Error('Unsupported token');
      }
      permitSignatureRef.current = permitBundlerAction;
      void onSubmit();
      return;
    }

    await navigationToTxConfirm({
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
  }, [
    amountValue,
    approveTarget,
    navigationToTxConfirm,
    trackAllowance,
    details.provider.name,
    details.provider.vault,
    token.symbol,
    usePermit2Approve,
    isFinishPermit2Approve,
    onSubmit,
  ]);

  return (
    <StakingFormWrapper>
      <AmountInput
        hasError={isInsufficientBalance || isLessThanMinAmount}
        value={amountValue}
        onChange={onChangeAmountValue}
        tokenSelectorTriggerProps={{
          selectedTokenImageUri: token.logoURI,
          selectedTokenSymbol: token.symbol,
          selectedNetworkImageUri: network?.logoURI,
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
        {estimatedAnnualRewards.length > 0 ? (
          <CalculationListItem
            alignItems={
              estimatedAnnualRewards.length > 1 ? 'flex-start' : 'center'
            }
          >
            <Stack flex={1}>
              <CalculationListItem.Label whiteSpace="nowrap">
                {intl.formatMessage({
                  id: ETranslations.earn_est_annual_rewards,
                })}
              </CalculationListItem.Label>
            </Stack>
            <YStack gap="$2" ai="flex-end" flex={1} $gtMd={{ flex: 4 }}>
              {estimatedAnnualRewards.map((reward) => (
                <ValuePriceListItem
                  key={reward.token.address}
                  tokenSymbol={reward.token.symbol}
                  fiatSymbol={symbol}
                  amount={reward.amount}
                  fiatValue={reward.fiatValue}
                />
              ))}
            </YStack>
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
              {details.provider.rewardUnit}
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
            isVisible={!!totalAnnualRewardsFiatValue}
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
      <Page.Footer>
        <Stack
          bg="$bgApp"
          flexDirection="column"
          $gtMd={{
            flexDirection: 'row',
            alignItems: 'center',
            jc: 'space-between',
          }}
        >
          <Stack pl="$5">
            <StakeProgress
              currentStep={
                shouldApprove
                  ? EStakeProgressStep.supply
                  : EStakeProgressStep.approve
              }
            />
          </Stack>
          <Page.FooterActions
            onConfirmText={onConfirmText}
            confirmButtonProps={{
              onPress: shouldApprove ? onApprove : onSubmit,
              loading: loading || loadingAllowance || approving,
              disabled: isDisable,
            }}
          />
        </Stack>
      </Page.Footer>
    </StakingFormWrapper>
  );
}
