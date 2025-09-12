import { memo, useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Accordion,
  Divider,
  Icon,
  LottieView,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import {
  useSwapFromTokenAmountAtom,
  useSwapLimitExpirationTimeAtom,
  useSwapLimitPartiallyFillAtom,
  useSwapProviderSupportReceiveAddressAtom,
  useSwapQuoteListAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapTokenMetadataAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import {
  useInAppNotificationAtom,
  useSettingsAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  EProtocolOfExchange,
  ESwapLimitOrderExpiryStep,
  ESwapQuoteKind,
  ESwapTabSwitchType,
  type IFetchQuoteResult,
  type ISwapToken,
  type ISwapTokenMetadata,
} from '@onekeyhq/shared/types/swap/types';

import LimitExpirySelect from '../../components/LimitExpirySelect';
import LimitPartialFillSelect from '../../components/LimitPartialFillSelect';
import SwapApprovingItem from '../../components/SwapApprovingItem';
import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';
import SwapProviderInfoItem from '../../components/SwapProviderInfoItem';
import SwapQuoteResultRate from '../../components/SwapQuoteResultRate';
import { useSwapRecipientAddressInfo } from '../../hooks/useSwapAccount';
import { useSwapSlippageActions } from '../../hooks/useSwapSlippageActions';
import {
  useSwapQuoteEventFetching,
  useSwapQuoteLoading,
} from '../../hooks/useSwapState';

import SwapApproveAllowanceSelectContainer from './SwapApproveAllowanceSelectContainer';
import SwapSlippageTriggerContainer from './SwapSlippageTriggerContainer';

interface ISwapQuoteResultProps {
  quoteResult?: IFetchQuoteResult;
  onOpenProviderList?: () => void;
  onOpenRecipient?: () => void;
  refreshAction: (manual?: boolean) => void;
}

const SwapQuoteResult = ({
  onOpenProviderList,
  quoteResult,
  refreshAction,
  onOpenRecipient,
}: ISwapQuoteResultProps) => {
  const [openResult, setOpenResult] = useState(false);
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const [swapTokenMetadata] = useSwapTokenMetadataAtom();
  const [swapQuoteList] = useSwapQuoteListAtom();

  const [
    { swapApprovingTransaction, swapApprovingLoading },
    setInAppNotificationAtom,
  ] = useInAppNotificationAtom();
  const [swapLimitExpirySelect, setSwapLimitExpirySelect] =
    useSwapLimitExpirationTimeAtom();
  const [swapProviderSupportReceiveAddress] =
    useSwapProviderSupportReceiveAddressAtom();
  const [swapLimitPartiallyFill, setSwapLimitPartiallyFill] =
    useSwapLimitPartiallyFillAtom();
  const [{ swapEnableRecipientAddress }] = useSettingsAtom();
  const swapQuoteLoading = useSwapQuoteLoading();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const intl = useIntl();
  const { onSlippageHandleClick, slippageItem } = useSwapSlippageActions();
  const isFreeOneKeyFee = useMemo(() => {
    if (
      (quoteResult?.toAmount && quoteResult.kind === ESwapQuoteKind.SELL) ||
      (quoteResult?.fromAmount && quoteResult.kind === ESwapQuoteKind.BUY)
    ) {
      return (
        new BigNumber(quoteResult?.fee?.percentageFee ?? '0').isZero() ||
        new BigNumber(quoteResult?.fee?.percentageFee ?? '0').isNaN()
      );
    }
    return false;
  }, [
    quoteResult?.fee?.percentageFee,
    quoteResult?.fromAmount,
    quoteResult?.toAmount,
    quoteResult?.kind,
  ]);
  const swapRecipientAddress = useSwapRecipientAddressInfo(
    swapEnableRecipientAddress,
  );

  const calculateTaxItem = useCallback(
    (
      tokenBuyTaxBps: BigNumber,
      tokenSellTaxBps: BigNumber,
      tokenInfo?: ISwapToken,
    ) => {
      const showTax = BigNumber.maximum(tokenBuyTaxBps, tokenSellTaxBps);
      const finalShowTax = showTax.dividedBy(100).toNumber();
      return (
        <SwapCommonInfoItem
          title={intl.formatMessage(
            {
              id: ETranslations.swap_page_buy_sell_tax,
            },
            { token: `${tokenInfo?.symbol ?? ''}` },
          )}
          isLoading={swapQuoteLoading}
          valueComponent={
            <SizableText size="$bodyMdMedium">{`${finalShowTax}%`}</SizableText>
          }
        />
      );
    },
    [intl, swapQuoteLoading],
  );

  const tokenMetadataParse = useCallback(
    (
      tokenMetadata: ISwapTokenMetadata,
      fromTokenInfo?: ISwapToken,
      toTokenInfo?: ISwapToken,
    ) => {
      const buyToken = tokenMetadata?.buyToken;
      const sellToken = tokenMetadata?.sellToken;
      let buyTaxItem = null;
      let sellTaxItem = null;
      const buyTokenBuyTaxBps = new BigNumber(
        buyToken?.buyTaxBps ? buyToken?.buyTaxBps : 0,
      );
      const buyTokenSellTaxBps = new BigNumber(
        buyToken?.sellTaxBps ? buyToken?.sellTaxBps : 0,
      );
      const sellTokenBuyTaxBps = new BigNumber(
        sellToken?.buyTaxBps ? sellToken?.buyTaxBps : 0,
      );
      const sellTokenSellTaxBps = new BigNumber(
        sellToken?.sellTaxBps ? sellToken?.sellTaxBps : 0,
      );
      if (buyTokenBuyTaxBps.gt(0) || buyTokenSellTaxBps.gt(0)) {
        buyTaxItem = calculateTaxItem(
          buyTokenBuyTaxBps,
          buyTokenSellTaxBps,
          toTokenInfo,
        );
      }
      if (sellTokenBuyTaxBps.gt(0) || sellTokenSellTaxBps.gt(0)) {
        sellTaxItem = calculateTaxItem(
          sellTokenBuyTaxBps,
          sellTokenSellTaxBps,
          fromTokenInfo,
        );
      }
      return (
        <>
          {sellTaxItem}
          {buyTaxItem}
        </>
      );
    },
    [calculateTaxItem],
  );

  const quoting = useSwapQuoteEventFetching();

  const limitOrderExpiryStepMap = useMemo(
    () => [
      {
        label: `5 ${intl.formatMessage({
          id: ETranslations.Limit_expire_minutes,
        })}`,
        value: ESwapLimitOrderExpiryStep.FIVE_MINUTES.toString(),
      },
      {
        label: `30 ${intl.formatMessage({
          id: ETranslations.Limit_expire_minutes,
        })}`,
        value: ESwapLimitOrderExpiryStep.THIRTY_MINUTES.toString(),
      },
      {
        label: `1 ${intl.formatMessage({
          id: ETranslations.Limit_expire_hour,
        })}`,
        value: ESwapLimitOrderExpiryStep.ONE_HOUR.toString(),
      },
      {
        label: `1 ${intl.formatMessage({
          id: ETranslations.Limit_expire_day,
        })}`,
        value: ESwapLimitOrderExpiryStep.ONE_DAY.toString(),
      },
      {
        label: `3 ${intl.formatMessage({
          id: ETranslations.Limit_expire_days,
        })}`,
        value: ESwapLimitOrderExpiryStep.THREE_DAYS.toString(),
      },
      {
        label: `7 ${intl.formatMessage({
          id: ETranslations.Limit_expire_days,
        })}`,
        value: ESwapLimitOrderExpiryStep.ONE_WEEK.toString(),
      },
      {
        label: `1 ${intl.formatMessage({
          id: ETranslations.Limit_expire_month,
        })}`,
        value: ESwapLimitOrderExpiryStep.ONE_MONTH.toString(),
      },
    ],
    [intl],
  );
  const limitOrderPartiallyFillStepMap = useMemo(
    () => [
      {
        label: intl.formatMessage({
          id: ETranslations.Limit_info_partial_fill_enable,
        }),
        value: true,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.Limit_info_partial_fill_disable,
        }),
        value: false,
      },
    ],
    [intl],
  );

  const allCostFeeFormatValue = useMemo(() => {
    const oneKeyFeeAmountBN = new BigNumber(
      quoteResult?.oneKeyFeeExtraInfo?.oneKeyFeeAmount ?? '0',
    );
    const tokenPriceBN = new BigNumber(
      quoteResult?.kind === ESwapQuoteKind.SELL
        ? toToken?.price ?? '0'
        : fromToken?.price ?? '0',
    );
    const oneKeyFeeFiatValue = oneKeyFeeAmountBN.multipliedBy(tokenPriceBN);
    const estimatedFeeFiatValue = new BigNumber(
      quoteResult?.fee?.estimatedFeeFiatValue ?? '0',
    );
    const allFeeFiatValue = estimatedFeeFiatValue.plus(oneKeyFeeFiatValue);
    const allFeeFiatValueFormat = numberFormat(allFeeFiatValue.toFixed(), {
      formatter: 'value',
      formatterOptions: { currency: settingsPersistAtom.currencyInfo.symbol },
    });
    return `${allFeeFiatValueFormat as string}`;
  }, [
    quoteResult?.fee?.estimatedFeeFiatValue,
    quoteResult?.oneKeyFeeExtraInfo,
    toToken?.price,
    quoteResult?.kind,
    fromToken?.price,
    settingsPersistAtom.currencyInfo.symbol,
  ]);

  const limitNetworkFeeMarkQuestContent = useMemo(() => {
    const networkCostBuyAmountFormat = numberFormat(
      quoteResult?.networkCostBuyAmount ?? '0',
      { formatter: 'balance' },
    );
    const oneKeyFeeCostFormat = numberFormat(
      quoteResult?.oneKeyFeeExtraInfo?.oneKeyFeeAmount ?? '0',
      {
        formatter: 'balance',
      },
    );

    return (
      <YStack gap="$2" p="$4">
        <XStack justifyContent="space-between">
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.limit_order_info_network_cost,
            })}
          </SizableText>
          <SizableText size="$bodyMdMedium">{`${
            networkCostBuyAmountFormat as string
          } ${quoteResult?.toTokenInfo?.symbol ?? ''}`}</SizableText>
        </XStack>
        <XStack justifyContent="space-between">
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.provider_ios_popover_onekey_fee,
            })}
          </SizableText>
          <SizableText size="$bodyMdMedium">{`${
            oneKeyFeeCostFormat as string
          } ${
            quoteResult?.oneKeyFeeExtraInfo?.oneKeyFeeSymbol ?? ''
          }`}</SizableText>
        </XStack>
        <Divider />
        <XStack justifyContent="space-between">
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.limit_est_fee,
            })}
          </SizableText>
          <SizableText size="$bodyMdMedium">
            {allCostFeeFormatValue}
          </SizableText>
        </XStack>
      </YStack>
    );
  }, [
    quoteResult?.oneKeyFeeExtraInfo,
    quoteResult?.networkCostBuyAmount,
    quoteResult?.toTokenInfo?.symbol,
    intl,
    allCostFeeFormatValue,
  ]);
  const fromAmountDebounce = useDebounce(fromTokenAmount, 500, {
    leading: true,
  });
  if (
    !fromToken ||
    !toToken ||
    new BigNumber(fromTokenAmount.value).isNaN() ||
    new BigNumber(fromTokenAmount.value).isZero()
  ) {
    return null;
  }
  if (swapApprovingTransaction && swapApprovingLoading) {
    return (
      <SwapApprovingItem
        approvingTransaction={swapApprovingTransaction}
        onComplete={() => {
          setInAppNotificationAtom((pre) => ({
            ...pre,
            swapApprovingLoading: false,
          }));
        }}
      />
    );
  }
  if (swapTypeSwitch === ESwapTabSwitchType.LIMIT) {
    if (quoting || swapQuoteLoading) {
      return (
        <XStack alignItems="center">
          <XStack gap="$2">
            <SizableText size="$bodyMd" color="$text">
              {intl.formatMessage({
                id: ETranslations.swap_loading_content,
              })}
            </SizableText>
          </XStack>
          <XStack flex={1} justifyContent="flex-end">
            <LottieView
              source={require('@onekeyhq/kit/assets/animations/swap_loading.json')}
              autoPlay
              loop
              style={{
                width: 48,
                height: 20,
              }}
            />
          </XStack>
        </XStack>
      );
    }
    if (
      quoteResult?.protocol === EProtocolOfExchange.LIMIT &&
      !quoteResult?.isWrapped
    ) {
      return !quoteResult?.shouldWrappedToken && quoteResult?.info.provider ? (
        <YStack gap="$3">
          <SwapProviderInfoItem
            providerIcon={quoteResult?.info.providerLogo ?? ''}
            providerName={quoteResult?.info.providerName ?? ''}
            isFreeOneKeyFee={isFreeOneKeyFee ?? false}
            // isLoading={swapQuoteLoading}
            fromToken={fromToken}
            onekeyFee={quoteResult?.fee?.percentageFee}
            toToken={toToken}
            showLock={!!quoteResult?.allowanceResult}
            onPress={
              quoteResult?.info.provider && swapQuoteList?.length > 1
                ? () => {
                    onOpenProviderList?.();
                  }
                : undefined
            }
          />
          {quoteResult?.fee?.estimatedFeeFiatValue &&
          quoteResult?.networkCostBuyAmount ? (
            <SwapCommonInfoItem
              title={intl.formatMessage({
                id: ETranslations.limit_est_fee,
              })}
              questionMarkContent={limitNetworkFeeMarkQuestContent}
              // isLoading={swapQuoteLoading}
              value={allCostFeeFormatValue}
            />
          ) : null}
          <LimitExpirySelect
            currentSelectExpiryValue={swapLimitExpirySelect}
            onSelectExpiryValue={setSwapLimitExpirySelect}
            selectItems={limitOrderExpiryStepMap}
          />
          <LimitPartialFillSelect
            currentSelectPartiallyFillValue={swapLimitPartiallyFill}
            onSelectPartiallyFillValue={setSwapLimitPartiallyFill}
            selectItems={limitOrderPartiallyFillStepMap}
          />
        </YStack>
      ) : null;
    }
  }
  if (
    (swapTypeSwitch !== ESwapTabSwitchType.LIMIT || quoteResult?.isWrapped) &&
    fromToken &&
    toToken &&
    !new BigNumber(fromAmountDebounce.value).isZero() &&
    !new BigNumber(fromAmountDebounce.value).isNaN()
  ) {
    return (
      <Accordion type="single" collapsible>
        <Accordion.Item value="1">
          <Accordion.Trigger
            unstyled
            borderWidth={0}
            bg="$transparent"
            p="$0"
            cursor="pointer"
            disabled={!quoteResult?.info.provider || swapQuoteLoading}
          >
            {({ open }: { open: boolean }) => (
              <SwapQuoteResultRate
                rate={quoteResult?.instantRate}
                quoting={quoting}
                fromToken={fromToken}
                isFreeOneKeyFee={isFreeOneKeyFee ?? false}
                toToken={toToken}
                isBest={quoteResult?.isBest}
                providerIcon={quoteResult?.info.providerLogo ?? ''}
                isLoading={swapQuoteLoading}
                refreshAction={refreshAction}
                onOpenResult={
                  quoteResult?.info.provider && !swapQuoteLoading
                    ? () => setOpenResult(!openResult)
                    : undefined
                }
                openResult={open}
              />
            )}
          </Accordion.Trigger>
          <Accordion.HeightAnimator animation="quick">
            <Accordion.Content
              gap="$4"
              p="$0"
              animation="quick"
              enterStyle={{ opacity: 0 }}
              exitStyle={{ opacity: 0 }}
            >
              <Divider mt="$4" />
              {swapProviderSupportReceiveAddress &&
              swapEnableRecipientAddress ? (
                <SwapCommonInfoItem
                  title={intl.formatMessage({
                    id: ETranslations.global_recipient,
                  })}
                  isLoading={swapQuoteLoading}
                  onPress={onOpenRecipient}
                  valueComponent={
                    <XStack gap="$1">
                      {!swapRecipientAddress?.showAddress ? (
                        <Icon name="AddPeopleOutline" w={18} h={18} />
                      ) : null}
                      <SizableText size="$bodyMdMedium">
                        {swapRecipientAddress?.showAddress ??
                          intl.formatMessage({
                            id: ETranslations.swap_page_recipient_edit,
                          })}
                      </SizableText>
                    </XStack>
                  }
                  questionMarkContent={
                    <SizableText
                      p="$4"
                      $gtMd={{
                        size: '$bodyMd',
                      }}
                    >
                      {intl.formatMessage({
                        id: ETranslations.swap_review_recipient_popover,
                      })}
                    </SizableText>
                  }
                />
              ) : null}
              {quoteResult?.allowanceResult ? (
                <SwapApproveAllowanceSelectContainer
                  allowanceResult={quoteResult?.allowanceResult}
                  fromTokenSymbol={fromToken?.symbol ?? ''}
                  isLoading={swapQuoteLoading}
                />
              ) : null}
              {quoteResult?.info.provider ? (
                <SwapProviderInfoItem
                  providerIcon={quoteResult?.info.providerLogo ?? ''} // TODO default logo
                  providerName={quoteResult?.info.providerName ?? ''}
                  isLoading={swapQuoteLoading}
                  isBest={quoteResult.isBest}
                  isFreeOneKeyFee={isFreeOneKeyFee ?? false}
                  fromToken={fromToken}
                  onekeyFee={quoteResult?.fee?.percentageFee}
                  toToken={toToken}
                  showLock={!!quoteResult?.allowanceResult}
                  onPress={
                    quoteResult?.info.provider
                      ? () => {
                          onOpenProviderList?.();
                        }
                      : undefined
                  }
                />
              ) : null}
              {quoteResult?.toAmount &&
              !quoteResult?.unSupportSlippage &&
              !quoteResult.isWrapped ? (
                <SwapSlippageTriggerContainer
                  isLoading={swapQuoteLoading}
                  onPress={onSlippageHandleClick}
                  slippageItem={slippageItem}
                />
              ) : null}
              {(quoteResult?.fee?.estimatedFeeFiatValue ||
                quoteResult?.fee?.isFreeNetworkFee) &&
              !quoteResult?.allowanceResult ? (
                <SwapCommonInfoItem
                  title={intl.formatMessage({
                    id: ETranslations.swap_page_provider_est_network_fee,
                  })}
                  isLoading={swapQuoteLoading}
                  valueComponent={
                    quoteResult?.fee?.isFreeNetworkFee ? (
                      <XStack gap="$1" alignItems="center">
                        <Icon
                          name="PartyCelebrateSolid"
                          color="$iconSuccess"
                          w={15}
                          h={15}
                        />
                        <SizableText size="$bodyMdMedium" color="$textSuccess">
                          {intl.formatMessage({
                            id: ETranslations.prime_status_free,
                          })}
                        </SizableText>
                      </XStack>
                    ) : (
                      <NumberSizeableText
                        size="$bodyMdMedium"
                        formatter="value"
                        formatterOptions={{
                          currency: settingsPersistAtom.currencyInfo.symbol,
                        }}
                      >
                        {quoteResult.fee?.estimatedFeeFiatValue}
                      </NumberSizeableText>
                    )
                  }
                  questionMarkContent={
                    <SizableText
                      p="$4"
                      $gtMd={{
                        size: '$bodyMd',
                      }}
                    >
                      {intl.formatMessage({
                        id: ETranslations.swap_review_network_cost_popover_content,
                      })}
                    </SizableText>
                  }
                />
              ) : null}
              {swapTokenMetadata?.swapTokenMetadata
                ? tokenMetadataParse(
                    swapTokenMetadata?.swapTokenMetadata,
                    fromToken,
                    toToken,
                  )
                : null}
            </Accordion.Content>
          </Accordion.HeightAnimator>
        </Accordion.Item>
      </Accordion>
    );
  }
};

export default memo(SwapQuoteResult);
