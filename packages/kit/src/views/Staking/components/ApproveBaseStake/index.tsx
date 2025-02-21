import type { PropsWithChildren } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
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
import { useEarnActions } from '@onekeyhq/kit/src/states/jotai/contexts/earn/actions';
import { formatApy } from '@onekeyhq/kit/src/views/Staking/components/utils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EApproveType } from '@onekeyhq/shared/types/staking';
import type {
  IApproveConfirmFnParams,
  IEarnEstimateFeeResp,
  IStakeProtocolDetails,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { validateAmountInput } from '../../../Swap/utils/utils';
import { useEarnPermitApprove } from '../../hooks/useEarnPermitApprove';
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
    approveType: details.provider.approveType ?? EApproveType.Legacy,
  });
  const [amountValue, setAmountValue] = useState('');
  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();

  const { getPermitSignature } = useEarnPermitApprove();
  const { getPermitCache, updatePermitCache } = useEarnActions().current;

  const onChangeAmountValue = useCallback(
    (value: string) => {
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
  const permitSignatureRef = useRef<string | undefined>(undefined);

  const shouldApprove = useMemo(() => {
    const amountValueBN = BigNumber(amountValue);
    const allowanceBN = new BigNumber(allowance);

    if (usePermit2Approve) {
      // Check permit cache first
      const permitCache = getPermitCache({
        accountId: approveTarget.accountId,
        networkId: approveTarget.networkId,
        tokenAddress: token.address,
        amount: amountValue,
      });
      if (permitCache) {
        permitSignatureRef.current = permitCache.signature;
        return false;
      }
    }

    return !amountValueBN.isNaN() && allowanceBN.lt(amountValue);
  }, [
    amountValue,
    allowance,
    usePermit2Approve,
    getPermitCache,
    approveTarget,
    token,
  ]);

  const onConfirmText = useMemo(() => {
    if (shouldApprove) {
      return intl.formatMessage(
        { id: ETranslations.form__approve_str },
        { amount: amountValue, symbol: token.symbol },
      );
    }
    return intl.formatMessage({ id: ETranslations.earn_deposit });
  }, [shouldApprove, token, amountValue, intl]);

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

  const checkEstimateGasAlert = useCallback(
    async (onNext: () => Promise<void>) => {
      if (!totalAnnualRewardsFiatValue || !estimateFeeResp) {
        return onNext();
      }

      const daySpent = calcDaysSpent(
        totalAnnualRewardsFiatValue,
        estimateFeeResp.feeFiatValue,
      );

      if (!daySpent || daySpent <= 5) {
        return onNext();
      }

      showEstimateGasAlert({
        daysConsumed: daySpent,
        estFiatValue: estimateFeeResp.feeFiatValue,
        onConfirm: async (dialogInstance: IDialogInstance) => {
          await dialogInstance.close();
          await onNext();
        },
        onCancel: () => {
          setApproving(false);
        },
      });
    },
    [totalAnnualRewardsFiatValue, estimateFeeResp, showEstimateGasAlert],
  );

  const onSubmit = useCallback(async () => {
    const handleConfirm = async () => {
      try {
        await onConfirm?.({
          amount: amountValue,
          approveType: details.provider.approveType,
          permitSignature: permitSignatureRef.current,
        });
      } catch (error) {
        console.error('Transaction error:', error);
      }
    };

    if (!usePermit2Approve || (usePermit2Approve && !shouldApprove)) {
      await checkEstimateGasAlert(handleConfirm);
      return;
    }

    void handleConfirm();
  }, [
    shouldApprove,
    usePermit2Approve,
    onConfirm,
    amountValue,
    checkEstimateGasAlert,
    details.provider.approveType,
  ]);

  const showStakeProgressRef = useRef<Record<string, boolean>>({});

  const onApprove = useCallback(async () => {
    setApproving(true);
    permitSignatureRef.current = undefined;
    showStakeProgressRef.current[amountValue] = true;

    if (usePermit2Approve) {
      const handlePermit2Approve = async () => {
        try {
          // Check permit cache first
          const permitCache = getPermitCache({
            accountId: approveTarget.accountId,
            networkId: approveTarget.networkId,
            tokenAddress: token.address,
            amount: amountValue,
          });

          if (permitCache) {
            permitSignatureRef.current = permitCache.signature;
            void onSubmit();
            setApproving(false);
            return;
          }

          const permitBundlerAction = await getPermitSignature({
            networkId: approveTarget.networkId,
            accountId: approveTarget.accountId,
            token,
            amountValue,
            details,
          });
          permitSignatureRef.current = permitBundlerAction;

          // Update permit cache
          updatePermitCache({
            accountId: approveTarget.accountId,
            networkId: approveTarget.networkId,
            tokenAddress: token.address,
            amount: amountValue,
            signature: permitBundlerAction,
            expiredAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
          });

          void onSubmit();
          setApproving(false);
        } catch (error: unknown) {
          console.error('Permit sign error:', error);
          defaultLogger.staking.page.permitSignError({
            error: error instanceof Error ? error.message : String(error),
          });
          setApproving(false);
        }
      };

      void checkEstimateGasAlert(handlePermit2Approve);
      return;
    }

    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId: approveTarget.accountId,
      networkId: approveTarget.networkId,
    });

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
    token,
    details,
    usePermit2Approve,
    getPermitSignature,
    onSubmit,
    checkEstimateGasAlert,
    getPermitCache,
    updatePermitCache,
  ]);

  const isShowStakeProgress =
    !!amountValue &&
    (shouldApprove || showStakeProgressRef.current[amountValue]);
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
      {platformEnv.isDev ? (
        <SizableText>{`allowance: ${allowance}, shouldApprove: ${
          shouldApprove ? 'true' : 'false'
        }`}</SizableText>
      ) : null}
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
            <CalculationListItem.Value color="$textSuccess">{`${formatApy(
              apr,
            )}%`}</CalculationListItem.Value>
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
          <Stack pl="$5" $md={{ pt: '$5' }}>
            {isShowStakeProgress ? (
              <StakeProgress
                approveType={
                  details.provider.approveType ?? EApproveType.Legacy
                }
                currentStep={
                  isDisable || shouldApprove
                    ? EStakeProgressStep.approve
                    : EStakeProgressStep.deposit
                }
              />
            ) : null}
          </Stack>

          <Page.FooterActions
            onConfirmText={onConfirmText}
            confirmButtonProps={{
              onPress: shouldApprove ? onApprove : onSubmit,
              loading: loadingAllowance || approving,
              disabled: isDisable,
            }}
          />
        </Stack>
      </Page.Footer>
    </StakingFormWrapper>
  );
}
