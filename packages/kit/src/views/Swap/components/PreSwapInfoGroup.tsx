import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  Image,
  NumberSizeableText,
  Select,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ESwapNetworkFeeLevel,
  type ISwapPreSwapData,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapStepNetFeeLevelAtom } from '../../../states/jotai/contexts/swap';

import PreSwapInfoItem from './PreSwapInfoItem';

interface IPreSwapInfoGroupProps {
  preSwapData: ISwapPreSwapData;
  onSelectNetworkFeeLevel: (value: ESwapNetworkFeeLevel) => void;
}

const PreSwapInfoGroup = ({
  preSwapData,
  onSelectNetworkFeeLevel,
}: IPreSwapInfoGroupProps) => {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const [swapStepNetFeeLevel] = useSwapStepNetFeeLevelAtom();
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
    if (
      !preSwapData?.unSupportSlippage &&
      preSwapData?.slippage !== undefined
    ) {
      return new BigNumber(preSwapData?.slippage ?? 0)
        .decimalPlaces(2, BigNumber.ROUND_DOWN)
        .toNumber();
    }
    return undefined;
  }, [preSwapData?.slippage, preSwapData?.unSupportSlippage]);
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
    if (swapStepNetFeeLevel.networkFeeLevel === ESwapNetworkFeeLevel.LOW) {
      return intl.formatMessage({
        id: ETranslations.transaction_slow,
      });
    }
    if (swapStepNetFeeLevel.networkFeeLevel === ESwapNetworkFeeLevel.MEDIUM) {
      return intl.formatMessage({
        id: ETranslations.transaction_normal,
      });
    }
    if (swapStepNetFeeLevel.networkFeeLevel === ESwapNetworkFeeLevel.HIGH) {
      return intl.formatMessage({
        id: ETranslations.transaction_fast,
      });
    }
    return '-';
  }, [intl, swapStepNetFeeLevel.networkFeeLevel]);

  const networkFeeSelect = useMemo(() => {
    return (
      <XStack alignItems="center" gap="$1">
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
          value={swapStepNetFeeLevel.networkFeeLevel}
          title={intl.formatMessage({
            id: ETranslations.swap_review_transaction_speed,
          })}
          items={networkFeeLevelArray}
        />
        {preSwapData.estimateNetworkFeeLoading ? (
          <Skeleton width="$10" height="$4" />
        ) : (
          <NumberSizeableText
            size="$bodyMd"
            color="$textSubdued"
            formatter="value"
            formatterOptions={{ currency: settings.currencyInfo.symbol }}
          >
            {preSwapData.netWorkFee?.gasFeeFiatValue ?? ''}
          </NumberSizeableText>
        )}
      </XStack>
    );
  }, [
    intl,
    networkFeeLevelArray,
    networkFeeLevelLabel,
    onSelectNetworkFeeLevel,
    preSwapData.estimateNetworkFeeLoading,
    preSwapData.netWorkFee?.gasFeeFiatValue,
    settings.currencyInfo.symbol,
    swapStepNetFeeLevel.networkFeeLevel,
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
      {preSwapData.supportNetworkFeeLevel ? (
        <PreSwapInfoItem
          title={intl.formatMessage({
            id: ETranslations.provider_network_fee,
          })}
          value={networkFeeSelect}
        />
      ) : null}
    </YStack>
  );
};

export default PreSwapInfoGroup;
