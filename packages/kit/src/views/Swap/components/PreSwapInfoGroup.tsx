import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Badge,
  Image,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  ESwapSlippageSegmentKey,
  IFetchQuoteResult,
  ISwapPreSwapData,
} from '@onekeyhq/shared/types/swap/types';

import PreSwapInfoItem from './PreSwapInfoItem';

interface IPreSwapInfoGroupProps {
  preSwapData: ISwapPreSwapData;
  slippageItem: {
    key: ESwapSlippageSegmentKey;
    value: number;
  };
}

const PreSwapInfoGroup = ({
  preSwapData,
  slippageItem,
}: IPreSwapInfoGroupProps) => {
  const intl = useIntl();
  const slippage = useMemo(() => {
    if (!preSwapData?.unSupportSlippage) {
      return new BigNumber(slippageItem.value)
        .decimalPlaces(2, BigNumber.ROUND_DOWN)
        .toNumber();
    }
    return undefined;
  }, [preSwapData?.unSupportSlippage, slippageItem.value]);
  const fee = useMemo(() => {
    if (
      new BigNumber(preSwapData?.fee?.percentageFee ?? '0').isZero() ||
      new BigNumber(preSwapData?.fee?.percentageFee ?? '0').isNaN()
    ) {
      return (
        <Badge badgeSize="sm" marginRight="$2" badgeType="info">
          {intl.formatMessage({
            id: ETranslations.swap_stablecoin_0_fee,
          })}
        </Badge>
      );
    }
    return `${preSwapData?.fee?.percentageFee ?? '-'}%`;
  }, [intl, preSwapData?.fee?.percentageFee]);
  return (
    <YStack gap="$3">
      <PreSwapInfoItem
        title={intl.formatMessage({
          id: ETranslations.swap_page_provider_provider,
        })}
        value={
          <XStack gap="$2">
            <Image
              source={{ uri: preSwapData?.providerInfo?.providerLogo ?? '' }}
              size="$5"
              borderRadius="$1"
            />
            <SizableText size="$bodyMd">
              {preSwapData?.providerInfo?.providerName ?? ''}
            </SizableText>
          </XStack>
        }
      />
      {!isNil(slippage) ? (
        <PreSwapInfoItem
          title={intl.formatMessage({
            id: ETranslations.swap_page_provider_slippage_tolerance,
          })}
          value={`${slippage}%`}
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
