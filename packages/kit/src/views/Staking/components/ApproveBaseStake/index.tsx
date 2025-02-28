import type { PropsWithChildren, ReactElement } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { useDebouncedCallback } from 'use-debounce';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  Accordion,
  Alert,
  Dialog,
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
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useEarnActions } from '@onekeyhq/kit/src/states/jotai/contexts/earn/actions';
import {
  formatApy,
  formatStakingDistanceToNowStrict,
} from '@onekeyhq/kit/src/views/Staking/components/utils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
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
import { CalculationListItem } from '../CalculationList';
import {
  EstimateNetworkFee,
  useShowStakeEstimateGasAlert,
} from '../EstimateNetworkFee';
import { MorphoApy } from '../ProtocolDetails/MorphoApy';
import { EStakeProgressStep, StakeProgress } from '../StakeProgress';
import { StakingAmountInput } from '../StakingAmountInput';
import StakingFormWrapper from '../StakingFormWrapper';
import { TradeOrBuy } from '../TradeOrBuy';

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

  const [estimateFeeResp, setEstimateFeeResp] = useState<
    undefined | IEarnEstimateFeeResp
  >();

  const { getPermitSignature } = useEarnPermitApprove();
  const { getPermitCache, updatePermitCache } = useEarnActions().current;

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
  const permitSignatureAmountRef = useRef<string | undefined>(undefined);
  const permitSignatureRef = useRef<string | undefined>(undefined);

  const isFocus = useIsFocused();
  const approveOnThisTx = useRef(false);

  const shouldApprove = useMemo(() => {
    if (!isFocus) {
      return true;
    }
    const amountValueBN = BigNumber(amountValue);
    const allowanceBN = new BigNumber(allowance);

    if (earnUtils.isUSDTonETHNetwork(token)) {
      if (allowanceBN.isZero()) {
        return true;
      }

      if (
        allowanceBN.gt(0) &&
        (!approveOnThisTx.current || amountValueBN.gt(allowanceBN))
      ) {
        return true;
      }
    }

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
        permitSignatureAmountRef.current = amountValue;
        return false;
      }
    }

    return !amountValueBN.isNaN() && allowanceBN.lt(amountValue);
  }, [
    isFocus,
    token,
    amountValue,
    allowance,
    usePermit2Approve,
    getPermitCache,
    approveTarget.accountId,
    approveTarget.networkId,
  ]);

  const fetchEstimateFeeResp = useDebouncedCallback(async (amount?: string) => {
    if (!amount) {
      setEstimateFeeResp(undefined);
      return;
    }
    const amountNumber = BigNumber(amount);
    if (amountNumber.isZero() || amountNumber.isNaN()) {
      return;
    }

    const permitParams: {
      approveType?: 'permit';
      permitSignature?: string;
    } = {};

    if (usePermit2Approve) {
      if (shouldApprove) {
        setEstimateFeeResp(undefined);
        return;
      }

      permitParams.approveType = 'permit';

      if (permitSignatureRef.current) {
        const amountBN = BigNumber(amount);
        if (permitSignatureAmountRef.current) {
          const allowanceBN = BigNumber(permitSignatureAmountRef.current);
          if (amountBN.gt(allowanceBN)) {
            permitParams.permitSignature = permitSignatureRef.current;
          }
        }
      }
    }

    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId: approveTarget.accountId,
      networkId: approveTarget.networkId,
    });
    const resp = await backgroundApiProxy.serviceStaking.estimateFee({
      networkId: approveTarget.networkId,
      provider: details.provider.name,
      symbol: details.token.info.symbol,
      action: 'stake',
      amount: amountNumber.toFixed(),
      morphoVault: details.provider.vault,
      accountAddress: account?.address,
      ...permitParams,
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

  const currentValue = useMemo<string | undefined>(() => {
    const amountValueBn = new BigNumber(amountValue);
    if (amountValueBn.isNaN()) return undefined;
    return amountValueBn.multipliedBy(price).toFixed();
  }, [amountValue, price]);

  const onConfirmText = useMemo(() => {
    if (shouldApprove) {
      return intl.formatMessage(
        { id: ETranslations.earn_approve_deposit },
        { amount: amountValue, symbol: token.symbol },
      );
    }
    return intl.formatMessage({ id: ETranslations.earn_deposit });
  }, [shouldApprove, token, amountValue, intl]);

  const onMax = useCallback(() => {
    onChangeAmountValue(balance);
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
    if (estimateFeeResp?.coverFeeSeconds) {
      return formatStakingDistanceToNowStrict(estimateFeeResp.coverFeeSeconds);
    }
  }, [estimateFeeResp?.coverFeeSeconds]);

  const checkEstimateGasAlert = useCallback(
    async (onNext: () => Promise<void>) => {
      if (!totalAnnualRewardsFiatValue || !estimateFeeResp) {
        return onNext();
      }

      const daySpent =
        Number(estimateFeeResp?.coverFeeSeconds || 0) / 3600 / 24;

      if (!daySpent || daySpent <= 5) {
        return onNext();
      }

      showEstimateGasAlert({
        daysConsumed: formatStakingDistanceToNowStrict(
          estimateFeeResp.coverFeeSeconds,
        ),
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

  const resetUSDTApproveValue = useCallback(async () => {
    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId: approveTarget.accountId,
      networkId: approveTarget.networkId,
    });
    const approveResetInfo: IApproveInfo = {
      owner: account.address,
      spender: approveTarget.spenderAddress,
      amount: '0',
      isMax: false,
      tokenInfo: {
        ...token,
        isNative: !!token.isNative,
        name: token.name ?? token.symbol,
      },
    };
    const approvesInfo = [approveResetInfo];
    await navigationToTxConfirm({
      approvesInfo,

      onSuccess(data) {
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
    approveTarget.accountId,
    approveTarget.networkId,
    approveTarget.spenderAddress,
    navigationToTxConfirm,
    token,
  ]);

  const showResetUSDTApproveValueDialog = useCallback(() => {
    Dialog.confirm({
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_continue,
      }),
      onClose: () => {
        setApproving(false);
      },
      onConfirm: () => {
        void resetUSDTApproveValue();
      },
      showCancelButton: true,
      title: intl.formatMessage({
        id: ETranslations.swap_page_provider_approve_usdt_dialog_title,
      }),
      description: intl.formatMessage({
        id: ETranslations.swap_page_provider_approve_usdt_dialog_content,
      }),
      icon: 'ErrorOutline',
    });
  }, [intl, resetUSDTApproveValue]);

  const onApprove = useCallback(async () => {
    setApproving(true);
    permitSignatureRef.current = undefined;
    permitSignatureAmountRef.current = undefined;
    showStakeProgressRef.current[amountValue] = true;

    const allowanceBN = BigNumber(allowance);
    const amountBN = BigNumber(amountValue);

    if (earnUtils.isUSDTonETHNetwork(token)) {
      if (
        allowanceBN.gt(0) &&
        (!approveOnThisTx.current || amountBN.gt(allowanceBN))
      ) {
        showResetUSDTApproveValueDialog();
        return;
      }
    }

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
            permitSignatureAmountRef.current = amountValue;
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
          permitSignatureAmountRef.current = amountValue;
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

          setTimeout(() => {
            void fetchEstimateFeeResp(amountValue);
          }, 200);

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
        approveOnThisTx.current = true;
        setTimeout(() => {
          void fetchEstimateFeeResp(amountValue);
        }, 200);
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
    allowance,
    token,
    usePermit2Approve,
    approveTarget.accountId,
    approveTarget.networkId,
    approveTarget.spenderAddress,
    approveTarget.token,
    navigationToTxConfirm,
    showResetUSDTApproveValueDialog,
    checkEstimateGasAlert,
    getPermitCache,
    getPermitSignature,
    details,
    updatePermitCache,
    onSubmit,
    trackAllowance,
    fetchEstimateFeeResp,
  ]);

  const placeholderTokens = useMemo(
    () => (
      <>
        {details.token.info ? (
          <NumberSizeableText
            color="$textPlaceholder"
            size="$bodyLgMedium"
            formatter="balance"
            formatterOptions={{ tokenSymbol: details.token.info.symbol }}
          >
            0
          </NumberSizeableText>
        ) : null}
        {details.provider.apys?.rewards
          ? Object.entries(details.provider.apys.rewards).map(
              ([tokenAddress, apy]) =>
                details.rewardAssets?.[tokenAddress] ? (
                  <NumberSizeableText
                    key={tokenAddress}
                    color="$textPlaceholder"
                    size="$bodyLgMedium"
                    formatter="balance"
                    formatterOptions={{
                      tokenSymbol:
                        details.rewardAssets?.[tokenAddress].info.symbol,
                    }}
                  >
                    0
                  </NumberSizeableText>
                ) : null,
            )
          : null}
      </>
    ),
    [details.provider.apys?.rewards, details.rewardAssets, details.token.info],
  );

  const isShowStakeProgress =
    !!amountValue &&
    (shouldApprove || showStakeProgressRef.current[amountValue]);

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
          labelTextProps={{
            size: '$bodyMd',
          }}
          valueTextProps={{
            size: '$bodyMdMedium',
          }}
          estimateFeeResp={estimateFeeResp}
          isVisible={!!totalAnnualRewardsFiatValue}
          onPress={() => {
            showEstimateGasAlert({
              daysConsumed: daysSpent,
              estFiatValue: estimateFeeResp.feeFiatValue,
            });
          }}
        />,
      );
    }
    return items;
  }, [
    amountValue,
    daysSpent,
    estReceiveToken,
    estReceiveTokenRate,
    estimateFeeResp,
    intl,
    showEstReceive,
    showEstimateGasAlert,
    totalAnnualRewardsFiatValue,
  ]);
  const isAccordionTriggerDisabled = accordionContent.length === 0;
  return (
    <StakingFormWrapper>
      <StakingAmountInput
        title={intl.formatMessage({ id: ETranslations.earn_deposit })}
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
        onSelectPercentageStage={onSelectPercentageStage}
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
      <YStack
        p="$3.5"
        pt="$5"
        borderRadius="$3"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
      >
        {apr && Number(apr) > 0 ? (
          <XStack gap="$1" ai="center">
            <SizableText color="$textSuccess" size="$headingLg">
              {`${formatApy(apr)}% APY`}
            </SizableText>
            {details.provider.apys ? (
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
                renderContent={
                  <MorphoApy
                    apys={details.provider.apys}
                    rewardAssets={details.rewardAssets}
                    poolFee={
                      earnUtils.isMorphoProvider({
                        providerName: providerName || '',
                      })
                        ? details.provider.poolFee
                        : undefined
                    }
                  />
                }
                placement="top"
              />
            ) : null}
          </XStack>
        ) : null}
        <YStack pt="$3.5" gap="$2">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.earn_est_annual_rewards,
            })}
          </SizableText>
          {estimatedAnnualRewards.length
            ? estimatedAnnualRewards.map((reward) => (
                <SizableText key={reward.token.address}>
                  <NumberSizeableText
                    size="$bodyLgMedium"
                    formatter="balance"
                    formatterOptions={{ tokenSymbol: reward.token.symbol }}
                  >
                    {reward.amount}
                  </NumberSizeableText>
                  {reward.fiatValue ? (
                    <SizableText color="$textSubdued">
                      <SizableText color="$textSubdued">{' ('}</SizableText>
                      <NumberSizeableText
                        size="$bodyLgMedium"
                        formatter="value"
                        color="$textSubdued"
                        formatterOptions={{ currency: symbol }}
                      >
                        {reward.fiatValue}
                      </NumberSizeableText>
                      <SizableText color="$textSubdued">)</SizableText>
                    </SizableText>
                  ) : null}
                </SizableText>
              ))
            : placeholderTokens}
        </YStack>
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
          token={details.token.info}
          accountId={approveTarget.accountId}
          networkId={approveTarget.networkId}
        />
      </YStack>
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
        <PercentageStageOnKeyboard
          onSelectPercentageStage={onSelectPercentageStage}
        />
      </Page.Footer>
    </StakingFormWrapper>
  );
}
