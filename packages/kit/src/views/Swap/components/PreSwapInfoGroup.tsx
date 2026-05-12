import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Icon,
  Image,
  NumberSizeableText,
  Select,
  SizableText,
  Skeleton,
  Stack,
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

export const SWAP_REVIEW_CUSTOM_NETWORK_FEE_VALUE = 'CUSTOM' as const;

export type ISwapReviewNetworkFeeSelectValue =
  | ESwapNetworkFeeLevel
  | typeof SWAP_REVIEW_CUSTOM_NETWORK_FEE_VALUE;

interface IPreSwapInfoGroupProps {
  preSwapData: ISwapPreSwapData;
  onSelectNetworkFeeLevel: (value: ISwapReviewNetworkFeeSelectValue) => void;
  customNetworkFeeOptionLabel?: string;
  networkFeeSelectValue?: ISwapReviewNetworkFeeSelectValue;
}

const PreSwapInfoGroup = ({
  preSwapData,
  onSelectNetworkFeeLevel,
  customNetworkFeeOptionLabel,
  networkFeeSelectValue,
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
    const selectItems: {
      label: string;
      value: ISwapReviewNetworkFeeSelectValue;
    }[] = feeArray.map((item) => {
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
    if (customNetworkFeeOptionLabel) {
      selectItems.push({
        label: customNetworkFeeOptionLabel,
        value: SWAP_REVIEW_CUSTOM_NETWORK_FEE_VALUE,
      });
    }
    return selectItems;
  }, [customNetworkFeeOptionLabel, intl]);
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

  const activeNetworkFeeSelectValue =
    networkFeeSelectValue ??
    (swapStepNetFeeLevel.customPriorityFee
      ? SWAP_REVIEW_CUSTOM_NETWORK_FEE_VALUE
      : swapStepNetFeeLevel.networkFeeLevel);

  const networkFeeLevelLabel = useMemo(() => {
    if (activeNetworkFeeSelectValue === SWAP_REVIEW_CUSTOM_NETWORK_FEE_VALUE) {
      return (
        customNetworkFeeOptionLabel ??
        intl.formatMessage({
          id: ETranslations.transaction_custom,
        })
      );
    }
    if (activeNetworkFeeSelectValue === ESwapNetworkFeeLevel.LOW) {
      return intl.formatMessage({
        id: ETranslations.transaction_slow,
      });
    }
    if (activeNetworkFeeSelectValue === ESwapNetworkFeeLevel.MEDIUM) {
      return intl.formatMessage({
        id: ETranslations.transaction_normal,
      });
    }
    if (activeNetworkFeeSelectValue === ESwapNetworkFeeLevel.HIGH) {
      return intl.formatMessage({
        id: ETranslations.transaction_fast,
      });
    }
    return '-';
  }, [activeNetworkFeeSelectValue, customNetworkFeeOptionLabel, intl]);

  const networkFeeSelect = useMemo(() => {
    return (
      <XStack alignItems="center" gap="$2">
        <Select
          onChange={(value) =>
            onSelectNetworkFeeLevel(value as ISwapReviewNetworkFeeSelectValue)
          }
          renderTrigger={() => (
            <XStack cursor="pointer" gap="$1" alignItems="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                {networkFeeLevelLabel}
              </SizableText>
              <Icon name="ChevronGrabberVerOutline" size="$4" />
            </XStack>
          )}
          title={intl.formatMessage({
            id: ETranslations.swap_review_transaction_speed,
          })}
          value={activeNetworkFeeSelectValue}
          items={networkFeeLevelArray}
        />
        {preSwapData.stepBeforeActionsLoading ? (
          <Skeleton width="$10" height="$4" />
        ) : (
          <NumberSizeableText
            size="$bodyMd"
            color="$text"
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
    activeNetworkFeeSelectValue,
    networkFeeLevelArray,
    networkFeeLevelLabel,
    onSelectNetworkFeeLevel,
    preSwapData.netWorkFee?.gasFeeFiatValue,
    settings.currencyInfo.symbol,
    preSwapData.stepBeforeActionsLoading,
  ]);

  return (
    <YStack gap="$3">
      <PreSwapInfoItem
        title={intl.formatMessage({
          id: ETranslations.swap_page_provider_provider,
        })}
        value={
          <XStack gap="$2" alignItems="center">
            <Stack position="relative" w="$5" h="$5">
              <Image
                source={{ uri: preSwapData?.providerInfo?.providerLogo ?? '' }}
                size="$5"
                borderRadius="$1"
              />
              <Stack
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                borderRadius="$1"
                borderWidth="$px"
                borderColor="$borderSubdued"
                pointerEvents="none"
              />
            </Stack>
            <SizableText size="$bodyMd">
              {preSwapData?.providerInfo?.providerName ?? ''}
            </SizableText>
          </XStack>
        }
        popoverContent={intl.formatMessage({
          id: ETranslations.swap_review_provider_popover_content,
        })}
      />
      {!isNil(slippage) ? (
        <PreSwapInfoItem
          title={intl.formatMessage({
            id: ETranslations.swap_page_provider_slippage_tolerance,
          })}
          value={`${slippage}%`}
          popoverContent={intl.formatMessage({
            id: ETranslations.slippage_tolerance_warning_message_1,
          })}
        />
      ) : null}
      {!isNil(preSwapData?.minToAmount) &&
      new BigNumber(preSwapData?.minToAmount).gt(0) ? (
        <PreSwapInfoItem
          title={intl.formatMessage({
            id: ETranslations.swap_review_min_receive,
          })}
          popoverContent={intl.formatMessage({
            id: ETranslations.swap_review_min_receive_popover,
          })}
          value={
            <NumberSizeableText
              size="$bodyMd"
              formatter="balance"
              formatterOptions={{
                tokenSymbol: preSwapData?.toToken?.symbol ?? '-',
              }}
            >
              {preSwapData?.minToAmount}
            </NumberSizeableText>
          }
        />
      ) : null}

      {preSwapData.supportNetworkFeeLevel ? (
        <PreSwapInfoItem
          title={intl.formatMessage({
            id: ETranslations.provider_network_fee,
          })}
          value={networkFeeSelect}
          popoverContent={intl.formatMessage({
            id: ETranslations.swap_review_network_cost_popover_content,
          })}
        />
      ) : null}
    </YStack>
  );
};

export default PreSwapInfoGroup;
