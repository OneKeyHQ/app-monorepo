import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Image,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  ESwapSlippageSegmentKey,
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import PreSwapInfoItem from '../../components/PreSwapInfoItem';
import PreSwapTokenItem from '../../components/PreSwapTokenItem';

interface IPreSwapDialogContentProps {
  quoteResult: IFetchQuoteResult;
  fromTokenInfo?: ISwapToken;
  toTokenInfo?: ISwapToken;
  onConfirm: () => void;
  slippageItem: {
    key: ESwapSlippageSegmentKey;
    value: number;
  };
}

const PreSwapDialogContent = ({
  onConfirm,
  quoteResult,
  slippageItem,
  fromTokenInfo,
  toTokenInfo,
}: IPreSwapDialogContentProps) => {
  const intl = useIntl();

  const fromAmount = quoteResult?.fromAmount || '0';
  const toAmount = quoteResult?.toAmount || '0';

  const slippage = useMemo(() => {
    if (!quoteResult?.unSupportSlippage) {
      return slippageItem.value;
    }
    return undefined;
  }, [quoteResult?.unSupportSlippage, slippageItem.value]);
  const fee = useMemo(() => {
    if (quoteResult?.fee?.percentageFee) {
      return `${quoteResult?.fee?.percentageFee ?? '-'}%`;
    }
    return '-';
  }, [quoteResult?.fee?.percentageFee]);

  const handleConfirm = () => {
    // 处理确认逻辑
    console.log('Confirm swap');
    onConfirm();
  };

  return (
    <YStack gap="$4">
      {/* You pay */}
      <SizableText size="$bodyLg" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.swap_page_from })}
      </SizableText>

      {/* From token item */}
      <PreSwapTokenItem token={fromTokenInfo} amount={fromAmount} />

      {/* You received */}
      <SizableText size="$bodyLg" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.swap_page_to })}
      </SizableText>

      {/* To token item */}
      <PreSwapTokenItem token={toTokenInfo} amount={toAmount} />

      {/* Divider */}
      <Divider />

      {/* Info items */}
      <YStack gap="$3">
        <PreSwapInfoItem
          title={intl.formatMessage({
            id: ETranslations.swap_page_provider_provider,
          })}
          value={
            <XStack gap="$1">
              <Image
                source={{ uri: quoteResult?.info.providerLogo ?? '' }}
                size="$5"
                borderRadius="$1"
              />
              <SizableText size="$bodyMd">
                {quoteResult?.info?.providerName ?? ''}
              </SizableText>
            </XStack>
          }
        />
        {slippage ? (
          <PreSwapInfoItem
            title={intl.formatMessage({
              id: ETranslations.swap_page_provider_slippage_tolerance,
            })}
            value={`${slippage.toFixed(2)}%`}
          />
        ) : null}
        <PreSwapInfoItem
          title={intl.formatMessage({
            id: ETranslations.fee_fee,
          })}
          value={fee}
        />
      </YStack>

      {/* Primary button */}
      <Button variant="primary" onPress={handleConfirm} size="large">
        {intl.formatMessage({ id: ETranslations.transaction_confirm })}
      </Button>
    </YStack>
  );
};

export default PreSwapDialogContent;
