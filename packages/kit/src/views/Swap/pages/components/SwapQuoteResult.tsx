import { memo, useCallback, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  Accordion,
  Dialog,
  Divider,
  Icon,
  NumberSizeableText,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import {
  useSwapFromTokenAmountAtom,
  useSwapProviderSupportReceiveAddressAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSlippageDialogOpeningAtom,
  useSwapSlippagePercentageAtom,
  useSwapSlippagePercentageCustomValueAtom,
  useSwapSlippagePercentageModeAtom,
  useSwapTokenMetadataAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';
import type {
  IFetchQuoteResult,
  ISwapSlippageSegmentItem,
  ISwapToken,
  ISwapTokenMetadata,
} from '@onekeyhq/shared/types/swap/types';

import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';
import SwapProviderInfoItem from '../../components/SwapProviderInfoItem';
import SwapQuoteResultRate from '../../components/SwapQuoteResultRate';
import { useSwapRecipientAddressInfo } from '../../hooks/useSwapAccount';
import { useSwapQuoteLoading } from '../../hooks/useSwapState';

import SwapApproveAllowanceSelectContainer from './SwapApproveAllowanceSelectContainer';
import SwapSlippageContentContainer from './SwapSlippageContentContainer';
import SwapSlippageTriggerContainer from './SwapSlippageTriggerContainer';

interface ISwapQuoteResultProps {
  quoteResult?: IFetchQuoteResult;
  onOpenProviderList?: () => void;
  onOpenRecipient?: () => void;
}

const SwapQuoteResult = ({
  onOpenProviderList,
  quoteResult,
  onOpenRecipient,
}: ISwapQuoteResultProps) => {
  const [openResult, setOpenResult] = useState(false);
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const [swapTokenMetadata] = useSwapTokenMetadataAtom();
  const [swapProviderSupportReceiveAddress] =
    useSwapProviderSupportReceiveAddressAtom();
  const swapQuoteLoading = useSwapQuoteLoading();
  const intl = useIntl();
  const [, setSwapSlippageDialogOpening] = useSwapSlippageDialogOpeningAtom();
  const [{ slippageItem, autoValue }] = useSwapSlippagePercentageAtom();
  const [, setSwapSlippageCustomValue] =
    useSwapSlippagePercentageCustomValueAtom();
  const [, setSwapSlippageMode] = useSwapSlippagePercentageModeAtom();
  const dialogRef = useRef<ReturnType<typeof Dialog.show> | null>(null);
  const slippageOnSave = useCallback(
    (item: ISwapSlippageSegmentItem, close: IDialogInstance['close']) => {
      setSwapSlippageMode(item.key);
      if (item.key === ESwapSlippageSegmentKey.CUSTOM) {
        setSwapSlippageCustomValue(item.value);
      }
      void close({ flag: 'save' });
    },
    [setSwapSlippageCustomValue, setSwapSlippageMode],
  );

  const swapRecipientAddress = useSwapRecipientAddressInfo(
    settingsPersistAtom.swapEnableRecipientAddress,
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

  const slippageHandleClick = useCallback(() => {
    dialogRef.current = Dialog.show({
      title: intl.formatMessage({ id: ETranslations.slippage_tolerance_title }),
      renderContent: (
        <SwapSlippageContentContainer
          swapSlippage={slippageItem}
          autoValue={autoValue}
          onSave={slippageOnSave}
        />
      ),
      onOpen: () => {
        setSwapSlippageDialogOpening({ status: true });
      },
      onClose: (extra) => {
        setSwapSlippageDialogOpening({ status: false, flag: extra?.flag });
      },
    });
  }, [
    intl,
    slippageItem,
    autoValue,
    slippageOnSave,
    setSwapSlippageDialogOpening,
  ]);

  const fromAmountDebounce = useDebounce(fromTokenAmount, 500, {
    leading: true,
  });
  if (
    !fromToken ||
    !toToken ||
    new BigNumber(fromTokenAmount).isNaN() ||
    new BigNumber(fromTokenAmount).isZero()
  ) {
    return null;
  }
  if (
    fromToken &&
    toToken &&
    !new BigNumber(fromAmountDebounce).isZero() &&
    !new BigNumber(fromAmountDebounce).isNaN()
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
                fromToken={fromToken}
                toToken={toToken}
                isBest={quoteResult?.isBest}
                providerIcon={quoteResult?.info.providerLogo ?? ''}
                providerName={quoteResult?.info.providerName ?? ''}
                isLoading={swapQuoteLoading}
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
              settingsPersistAtom.swapEnableRecipientAddress ? (
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
              {quoteResult?.toAmount && !quoteResult?.unSupportSlippage ? (
                <SwapSlippageTriggerContainer
                  isLoading={swapQuoteLoading}
                  onPress={slippageHandleClick}
                />
              ) : null}
              {quoteResult?.fee?.estimatedFeeFiatValue ? (
                <SwapCommonInfoItem
                  title={intl.formatMessage({
                    id: ETranslations.swap_page_provider_est_network_fee,
                  })}
                  isLoading={swapQuoteLoading}
                  valueComponent={
                    <NumberSizeableText
                      size="$bodyMdMedium"
                      formatter="value"
                      formatterOptions={{
                        currency: settingsPersistAtom.currencyInfo.symbol,
                      }}
                    >
                      {quoteResult.fee?.estimatedFeeFiatValue}
                    </NumberSizeableText>
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
