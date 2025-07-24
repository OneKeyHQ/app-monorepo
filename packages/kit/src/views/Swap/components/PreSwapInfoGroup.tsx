import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  Image,
  Select,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ESwapNetworkFeeLevel,
  type ESwapSlippageSegmentKey,
  type ISwapPreSwapData,
} from '@onekeyhq/shared/types/swap/types';

import PreSwapInfoItem from './PreSwapInfoItem';

interface IPreSwapInfoGroupProps {
  preSwapData: ISwapPreSwapData;
  slippageItem: {
    key: ESwapSlippageSegmentKey;
    value: number;
  };
  onSelectNetworkFeeLevel: (value: ESwapNetworkFeeLevel) => void;
}

const PreSwapInfoGroup = ({
  preSwapData,
  slippageItem,
  onSelectNetworkFeeLevel,
}: IPreSwapInfoGroupProps) => {
  const intl = useIntl();
  const networkFeeLevelArray = useMemo(() => {
    const feeArray = [
      ESwapNetworkFeeLevel.LOW,
      ESwapNetworkFeeLevel.MEDIUM,
      ESwapNetworkFeeLevel.HIGH,
    ];
    const selectItems = feeArray.map((item) => {
      let label = '';
      if (item === ESwapNetworkFeeLevel.LOW) {
        label = intl.formatMessage({
          id: ETranslations.transaction_slow,
        });
      }
      if (item === ESwapNetworkFeeLevel.MEDIUM) {
        label = intl.formatMessage({
          id: ETranslations.transaction_normal,
        });
      }
      if (item === ESwapNetworkFeeLevel.HIGH) {
        label = intl.formatMessage({
          id: ETranslations.transaction_fast,
        });
      }
      return {
        label,
        value: item,
      };
    });
    return selectItems;
  }, [intl]);
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
        <Badge badgeSize="sm" badgeType="info">
          {intl.formatMessage({
            id: ETranslations.swap_stablecoin_0_fee,
          })}
        </Badge>
      );
    }
    return `${preSwapData?.fee?.percentageFee ?? '-'}%`;
  }, [intl, preSwapData?.fee?.percentageFee]);

  const networkFeeLevelLabel = useMemo(() => {
    if (preSwapData.netWorkFee?.feeLevel === ESwapNetworkFeeLevel.LOW) {
      return intl.formatMessage({
        id: ETranslations.transaction_slow,
      });
    }
    if (preSwapData.netWorkFee?.feeLevel === ESwapNetworkFeeLevel.MEDIUM) {
      return intl.formatMessage({
        id: ETranslations.transaction_normal,
      });
    }
    if (preSwapData.netWorkFee?.feeLevel === ESwapNetworkFeeLevel.HIGH) {
      return intl.formatMessage({
        id: ETranslations.transaction_fast,
      });
    }
    return '-';
  }, [intl, preSwapData.netWorkFee?.feeLevel]);

  const networkFeeSelect = useMemo(() => {
    return (
      <Select
        onChange={onSelectNetworkFeeLevel}
        renderTrigger={() => (
          <XStack cursor="pointer" gap="$1" alignItems="center">
            <Icon name="ChevronGrabberVerOutline" size="$4" />
            <SizableText size="$bodyMd" color="$text">
              {networkFeeLevelLabel}
            </SizableText>
          </XStack>
        )}
        title={intl.formatMessage({
          id: ETranslations.swap_review_transaction_speed,
        })}
        items={networkFeeLevelArray}
      />
    );
  }, [
    intl,
    networkFeeLevelArray,
    networkFeeLevelLabel,
    onSelectNetworkFeeLevel,
  ]);

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
      {preSwapData.netWorkFee?.feeLevel ? (
        <PreSwapInfoItem
          title={intl.formatMessage({
            id: ETranslations.swap_review_transaction_speed,
          })}
          value={networkFeeSelect}
        />
      ) : null}
    </YStack>
  );
};

export default PreSwapInfoGroup;
