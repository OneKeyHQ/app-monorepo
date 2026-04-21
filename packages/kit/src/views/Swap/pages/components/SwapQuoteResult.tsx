import { memo, useCallback, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Accordion,
  Divider,
  Icon,
  Keyboard,
  LottieView,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import {
  useSwapFromTokenAmountAtom,
  useSwapLimitExpirationTimeAtom,
  useSwapLimitPartiallyFillAtom,
  useSwapQuoteListAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapTokenMetadataAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import {
  useInAppNotificationAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EProtocolOfExchange,
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
import { useSwapLimitConfigMaps } from '../../hooks/useSwapGlobal';
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
  refreshAction: (manual?: boolean) => void;
}

const SWAP_ACCORDION_VALUE = 'swap_accordion_value';

const SwapQuoteResult = ({
  onOpenProviderList,
  quoteResult,
  refreshAction,
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
  const [swapLimitPartiallyFill, setSwapLimitPartiallyFill] =
    useSwapLimitPartiallyFillAtom();
  const swapQuoteLoading = useSwapQuoteLoading();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const intl = useIntl();
  const { onSlippageHandleClick, slippageItem } = useSwapSlippageActions();

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
            { token: tokenInfo?.symbol ?? '' },
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

  const { limitOrderExpiryStepMap, limitOrderPartiallyFillStepMap } =
    useSwapLimitConfigMaps();

  const onValueChange = useCallback((value: string) => {
    if (value === SWAP_ACCORDION_VALUE) {
      Keyboard.dismiss();
    }
  }, []);

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
            isBest={quoteResult?.isBest}
            // isLoading={swapQuoteLoading}
            fromToken={fromToken}
            toToken={toToken}
            showLock={!!quoteResult?.allowanceResult}
            percentageFee={quoteResult?.fee?.percentageFee}
            percentOriginFee={quoteResult?.fee?.percentOriginFee}
            onPress={
              quoteResult?.info.provider &&
              swapQuoteList?.length > 1 &&
              onOpenProviderList
                ? () => {
                    onOpenProviderList();
                  }
                : undefined
            }
          />

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
      <Accordion type="single" collapsible onValueChange={onValueChange}>
        <Accordion.Item value={SWAP_ACCORDION_VALUE}>
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
              animateOnly={ANIMATE_ONLY_OPACITY}
              exitStyle={{ opacity: 0 }}
            >
              <Divider mt="$4" />
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
                  isBest={quoteResult?.isBest}
                  isLoading={swapQuoteLoading}
                  fromToken={fromToken}
                  toToken={toToken}
                  showLock={!!quoteResult?.allowanceResult}
                  percentageFee={quoteResult?.fee?.percentageFee}
                  percentOriginFee={quoteResult?.fee?.percentOriginFee}
                  onPress={
                    quoteResult?.info.provider && onOpenProviderList
                      ? () => {
                          onOpenProviderList();
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
