import { type ReactNode, memo, useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Accordion,
  Divider,
  HeightTransition,
  Icon,
  Keyboard,
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
  useSwapQuoteListAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapTokenMetadataAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import {
  ESwapQuoteUiPhase,
  isSwapQuoteActionable,
  resolveSwapQuoteForDisplay,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap/quoteProgress';
import {
  useInAppNotificationAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { formatSwapQuoteDuration } from '@onekeyhq/shared/src/utils/swapQuoteDurationUtils';
import {
  SWAP_QUOTE_INPUT_DEBOUNCE_MS,
  swapSlippageDecimal,
  swapSlippageWillAheadMinValue,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  EProtocolOfExchange,
  ESwapSlippageSegmentKey,
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
  useSwapQuoteLoading,
  useSwapQuoteProgressState,
} from '../../hooks/useSwapState';
import { SwapTestIDs } from '../../testIDs';

import SwapApproveAllowanceSelectContainer from './SwapApproveAllowanceSelectContainer';
import SwapSlippageTriggerContainer from './SwapSlippageTriggerContainer';

interface ISwapQuoteResultProps {
  quoteResult?: IFetchQuoteResult;
  onOpenProviderList?: () => void;
  refreshAction: (manual?: boolean) => void;
}

const SWAP_ACCORDION_VALUE = 'swap_accordion_value';

function SwapQuoteResultAccordion({
  children,
  disabled,
  renderTrigger,
}: {
  children: ReactNode;
  disabled: boolean;
  renderTrigger: (open: boolean) => ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const onValueChange = useCallback((value: string) => {
    const nextIsOpen = value === SWAP_ACCORDION_VALUE;
    setIsOpen(nextIsOpen);
    if (nextIsOpen) {
      Keyboard.dismiss();
    }
  }, []);

  return (
    <Accordion
      type="single"
      collapsible
      value={isOpen ? SWAP_ACCORDION_VALUE : ''}
      onValueChange={onValueChange}
    >
      <Accordion.Item value={SWAP_ACCORDION_VALUE}>
        <Accordion.Trigger
          unstyled
          testID={SwapTestIDs.quoteDetailsToggle}
          borderWidth={0}
          bg="$transparent"
          p="$0"
          cursor="pointer"
          disabled={disabled}
        >
          {({ open }: { open: boolean }) => renderTrigger(open)}
        </Accordion.Trigger>
        <HeightTransition hide={!isOpen}>
          <Accordion.Content
            forceMount
            gap="$4"
            p="$0"
            pointerEvents={isOpen ? 'auto' : 'none'}
            aria-hidden={!isOpen}
            accessibilityElementsHidden={!isOpen}
            importantForAccessibility={isOpen ? 'auto' : 'no-hide-descendants'}
            {...(platformEnv.isNative ? {} : { inert: !isOpen })}
          >
            {children}
          </Accordion.Content>
        </HeightTransition>
      </Accordion.Item>
    </Accordion>
  );
}

const SwapQuoteResult = ({
  onOpenProviderList,
  quoteResult,
  refreshAction,
}: ISwapQuoteResultProps) => {
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
  const {
    displayQuote,
    isQuotePresentationLoading,
    phase: quoteUiPhase,
  } = useSwapQuoteProgressState();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const intl = useIntl();
  const { onSlippageHandleClick, slippageItem } = useSwapSlippageActions();
  const quoteResultForDisplay = resolveSwapQuoteForDisplay({
    quoteResult,
    displayQuote,
    phase: quoteUiPhase,
  });
  const hasQuoteResultForDisplay = isSwapQuoteActionable(quoteResultForDisplay);
  const quoteDuration = formatSwapQuoteDuration({
    estTime: quoteResultForDisplay?.estTime,
    estimatedTime: quoteResultForDisplay?.estimatedTime,
  });
  const mobileCustomSlippageInfo = useMemo(() => {
    if (
      !platformEnv.isNative ||
      slippageItem.key !== ESwapSlippageSegmentKey.CUSTOM
    ) {
      return undefined;
    }

    const displaySlippage = new BigNumber(slippageItem.value)
      .decimalPlaces(swapSlippageDecimal, BigNumber.ROUND_DOWN)
      .toFixed();
    const isCaution = slippageItem.value > swapSlippageWillAheadMinValue;

    return {
      value: `${displaySlippage}%`,
      textColor: isCaution ? ('$textCaution' as const) : ('$text' as const),
      iconColor: isCaution
        ? ('$iconCaution' as const)
        : ('$iconSubdued' as const),
    };
  }, [slippageItem.key, slippageItem.value]);

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
          isLoading={isQuotePresentationLoading}
          valueComponent={
            <SizableText size="$bodyMdMedium">{`${finalShowTax}%`}</SizableText>
          }
        />
      );
    },
    [intl, isQuotePresentationLoading],
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

  const quoting = isQuotePresentationLoading;

  const { limitOrderExpiryStepMap, limitOrderPartiallyFillStepMap } =
    useSwapLimitConfigMaps();
  const isWaitingForQuote =
    quoteUiPhase === ESwapQuoteUiPhase.Waiting && !hasQuoteResultForDisplay;
  const isStaleRefreshing = quoteUiPhase === ESwapQuoteUiPhase.StaleRefreshing;
  // OK-58690: a quote event error without any displayable result used to
  // render nothing at all here, which removed the manual refresh entry and
  // made this row pop in/out around auto refreshes. Keep the row mounted;
  // with no rate available it falls into the "failed to fetch the quote"
  // copy — an event failure is not a liquidity problem, so it must not
  // reuse the no-provider presentation.
  const isQuoteEventErrorWithoutResult =
    quoteUiPhase === ESwapQuoteUiPhase.Error && !quoteResultForDisplay;
  const showNoProvider =
    quoteUiPhase === ESwapQuoteUiPhase.ZeroProvider &&
    !hasQuoteResultForDisplay;

  const fromAmountDebounce = useDebounce(
    fromTokenAmount,
    SWAP_QUOTE_INPUT_DEBOUNCE_MS,
    {
      leading: true,
    },
  );
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
        testID={SwapTestIDs.approveButton}
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
  if (isWaitingForQuote) {
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
  if (swapTypeSwitch === ESwapTabSwitchType.LIMIT) {
    if (
      quoteResultForDisplay?.protocol === EProtocolOfExchange.LIMIT &&
      !quoteResultForDisplay?.isWrapped
    ) {
      return !quoteResultForDisplay?.shouldWrappedToken &&
        quoteResultForDisplay?.info.provider ? (
        <YStack gap="$3">
          <SwapProviderInfoItem
            testID={SwapTestIDs.providerSelector}
            providerIcon={quoteResultForDisplay?.info.providerLogo ?? ''}
            providerName={quoteResultForDisplay?.info.providerName ?? ''}
            isBest={quoteResultForDisplay?.isBest}
            // isLoading={swapQuoteLoading}
            fromToken={fromToken}
            toToken={toToken}
            percentageFee={quoteResultForDisplay?.fee?.percentageFee}
            percentOriginFee={quoteResultForDisplay?.fee?.percentOriginFee}
            onPress={
              quoteResultForDisplay?.info.provider &&
              swapQuoteList?.length > 1 &&
              onOpenProviderList
                ? () => {
                    onOpenProviderList();
                  }
                : undefined
            }
          />
          {quoteDuration ? (
            <SwapCommonInfoItem
              title={intl.formatMessage({
                id: ETranslations.provider_swap_duration,
              })}
              isLoading={isQuotePresentationLoading}
              value={quoteDuration}
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
    (swapTypeSwitch !== ESwapTabSwitchType.LIMIT ||
      quoteResultForDisplay?.isWrapped ||
      showNoProvider ||
      isQuoteEventErrorWithoutResult) &&
    fromToken &&
    toToken &&
    !new BigNumber(fromAmountDebounce.value).isZero() &&
    !new BigNumber(fromAmountDebounce.value).isNaN()
  ) {
    return (
      <SwapQuoteResultAccordion
        disabled={
          !quoteResultForDisplay?.info.provider ||
          swapQuoteLoading ||
          isStaleRefreshing
        }
        renderTrigger={(open) => (
          <SwapQuoteResultRate
            rate={quoteResultForDisplay?.instantRate}
            quoting={quoting}
            fromToken={fromToken}
            toToken={toToken}
            isBest={quoteResultForDisplay?.isBest}
            showBestBadge={!platformEnv.isNative}
            customSlippageValue={mobileCustomSlippageInfo?.value}
            customSlippageTextColor={mobileCustomSlippageInfo?.textColor}
            customSlippageIconColor={mobileCustomSlippageInfo?.iconColor}
            providerIcon={quoteResultForDisplay?.info.providerLogo ?? ''}
            isLoading={isQuotePresentationLoading}
            showNoProvider={showNoProvider}
            refreshAction={refreshAction}
            canOpenResult={Boolean(quoteResultForDisplay?.info.provider)}
            openResult={open}
          />
        )}
      >
        <Divider mt="$4" />
        {quoteResultForDisplay?.allowanceResult ? (
          <SwapApproveAllowanceSelectContainer
            allowanceResult={quoteResultForDisplay?.allowanceResult}
            fromTokenSymbol={fromToken?.symbol ?? ''}
            isLoading={isQuotePresentationLoading}
          />
        ) : null}
        {quoteResultForDisplay?.info.provider ? (
          <SwapProviderInfoItem
            providerIcon={quoteResultForDisplay?.info.providerLogo ?? ''} // TODO default logo
            providerName={quoteResultForDisplay?.info.providerName ?? ''}
            isBest={quoteResultForDisplay?.isBest}
            isLoading={isQuotePresentationLoading}
            fromToken={fromToken}
            toToken={toToken}
            percentageFee={quoteResultForDisplay?.fee?.percentageFee}
            percentOriginFee={quoteResultForDisplay?.fee?.percentOriginFee}
            onPress={
              quoteResultForDisplay?.info.provider && onOpenProviderList
                ? () => {
                    onOpenProviderList();
                  }
                : undefined
            }
          />
        ) : null}
        {quoteDuration ? (
          <SwapCommonInfoItem
            title={intl.formatMessage({
              id: ETranslations.provider_swap_duration,
            })}
            isLoading={isQuotePresentationLoading}
            value={quoteDuration}
          />
        ) : null}
        {quoteResultForDisplay?.toAmount &&
        !quoteResultForDisplay?.unSupportSlippage &&
        !quoteResultForDisplay.isWrapped ? (
          <SwapSlippageTriggerContainer
            isLoading={isQuotePresentationLoading}
            onPress={onSlippageHandleClick}
            slippageItem={slippageItem}
          />
        ) : null}
        {(quoteResultForDisplay?.fee?.estimatedFeeFiatValue ||
          quoteResultForDisplay?.fee?.isFreeNetworkFee) &&
        !quoteResultForDisplay?.allowanceResult ? (
          <SwapCommonInfoItem
            title={intl.formatMessage({
              id: ETranslations.swap_page_provider_est_network_fee,
            })}
            isLoading={isQuotePresentationLoading}
            valueComponent={
              quoteResultForDisplay?.fee?.isFreeNetworkFee ? (
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
                  {quoteResultForDisplay?.fee?.estimatedFeeFiatValue}
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
      </SwapQuoteResultAccordion>
    );
  }
};

export default memo(SwapQuoteResult);
