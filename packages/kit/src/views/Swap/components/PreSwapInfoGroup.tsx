import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Badge,
  Dialog,
  Icon,
  Image,
  NumberSizeableText,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ESwapNetworkFeeLevel,
  type ESwapSlippageSegmentKey,
  type ISwapPreSwapData,
} from '@onekeyhq/shared/types/swap/types';

import PreSwapInfoItem from './PreSwapInfoItem';
import PreSwapNetFeeSelectContent from './PreSwapNetFeeSelectContent';

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
  const [settings] = useSettingsPersistAtom();
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

  const handleNetWorkFeeSelect = useCallback(() => {
    console.log('handleNetWorkFeeSelect');
    Dialog.confirm({
      title: intl.formatMessage({
        id: ETranslations.provider_network_fee,
      }),
      renderContent: <PreSwapNetFeeSelectContent />,
      onConfirm: () => {
        console.log('onConfirm');
      },
      onConfirmText: intl.formatMessage({
        id: ETranslations.action_save,
      }),
      showCancelButton: false,
    });
  }, [intl]);

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
    if (preSwapData.netWorkFeeLoading) {
      return <Skeleton w="$30" h="$5" />;
    }
    if (preSwapData.netWorkFee) {
      return (
        <XStack gap="$1" onPress={handleNetWorkFeeSelect} alignItems="center">
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            {networkFeeLevelLabel}
          </SizableText>
          <Icon name="ChevronGrabberHorOutline" size="$4" />
          <NumberSizeableText
            size="$bodyMd"
            formatter="value"
            formatterOptions={{
              currency: settings.currencyInfo.symbol,
            }}
          >
            {preSwapData.netWorkFee.feeFiatValue ?? '0'}
          </NumberSizeableText>
        </XStack>
      );
    }
    return '-';
  }, [
    preSwapData.netWorkFeeLoading,
    preSwapData.netWorkFee,
    handleNetWorkFeeSelect,
    networkFeeLevelLabel,
    settings.currencyInfo.symbol,
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
      <PreSwapInfoItem
        title={intl.formatMessage({
          id: ETranslations.provider_network_fee,
        })}
        value={networkFeeSelect}
      />
    </YStack>
  );
};

export default PreSwapInfoGroup;
