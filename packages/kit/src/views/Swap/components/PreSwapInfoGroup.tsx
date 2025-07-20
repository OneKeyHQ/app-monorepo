import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Image, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  ESwapSlippageSegmentKey,
  IFetchQuoteResult,
} from '@onekeyhq/shared/types/swap/types';

import PreSwapInfoItem from './PreSwapInfoItem';

interface IPreSwapInfoGroupProps {
  quoteResult: IFetchQuoteResult;
  slippageItem: {
    key: ESwapSlippageSegmentKey;
    value: number;
  };
}

const PreSwapInfoGroup = ({
  quoteResult,
  slippageItem,
}: IPreSwapInfoGroupProps) => {
  const intl = useIntl();
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
  return (
    <YStack gap="$3">
      <PreSwapInfoItem
        title={intl.formatMessage({
          id: ETranslations.swap_page_provider_provider,
        })}
        value={
          <XStack gap="$2">
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
  );
};

export default PreSwapInfoGroup;
