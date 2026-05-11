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

// Local sentinel: "Custom" is a dropdown-only UI value, not a fee tier.
export const FEE_TIER_CUSTOM = 'custom' as const;

export type IPreSwapFeeTierValue =
  | ESwapNetworkFeeLevel
  | typeof FEE_TIER_CUSTOM;

const FEE_LEVEL_LABEL_MAP: Record<ESwapNetworkFeeLevel, ETranslations> = {
  [ESwapNetworkFeeLevel.LOW]: ETranslations.transaction_slow,
  [ESwapNetworkFeeLevel.MEDIUM]: ETranslations.transaction_normal,
  [ESwapNetworkFeeLevel.HIGH]: ETranslations.transaction_fast,
};
const FEE_LEVEL_ORDER: ESwapNetworkFeeLevel[] = [
  ESwapNetworkFeeLevel.LOW,
  ESwapNetworkFeeLevel.MEDIUM,
  ESwapNetworkFeeLevel.HIGH,
];

interface IPreSwapInfoGroupProps {
  preSwapData: ISwapPreSwapData;
  onSelectNetworkFeeLevel: (value: IPreSwapFeeTierValue) => void;
}

const PreSwapInfoGroup = ({
  preSwapData,
  onSelectNetworkFeeLevel,
}: IPreSwapInfoGroupProps) => {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const [swapStepNetFeeLevel] = useSwapStepNetFeeLevelAtom();

  const networkFeeLevelArray = useMemo(() => {
    const selectItems: { label: string; value: IPreSwapFeeTierValue }[] =
      FEE_LEVEL_ORDER.map((item) => ({
        label: intl.formatMessage({ id: FEE_LEVEL_LABEL_MAP[item] }),
        value: item,
      }));
    // Append "Custom" only when a Market preset's custom priority fee was
    // memorized — otherwise there's nothing to switch back to.
    if (swapStepNetFeeLevel.presetOverrides) {
      selectItems.push({
        label: intl.formatMessage({ id: ETranslations.transaction_custom }),
        value: FEE_TIER_CUSTOM,
      });
    }
    return selectItems;
  }, [intl, swapStepNetFeeLevel.presetOverrides]);
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

  const networkFeeLevelLabel = useMemo(() => {
    // A custom priority fee overrides the tier, so the label follows it.
    if (swapStepNetFeeLevel.customPriorityFee) {
      return intl.formatMessage({ id: ETranslations.transaction_custom });
    }
    const labelId = FEE_LEVEL_LABEL_MAP[swapStepNetFeeLevel.networkFeeLevel];
    return labelId ? intl.formatMessage({ id: labelId }) : '-';
  }, [
    intl,
    swapStepNetFeeLevel.networkFeeLevel,
    swapStepNetFeeLevel.customPriorityFee,
  ]);

  const networkFeeSelect = useMemo(() => {
    return (
      <XStack alignItems="center" gap="$2">
        <Select
          onChange={onSelectNetworkFeeLevel}
          renderTrigger={() => (
            <XStack cursor="pointer" gap="$1" alignItems="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                {networkFeeLevelLabel}
              </SizableText>
              <Icon name="ChevronGrabberVerOutline" size="$4" />
            </XStack>
          )}
          // Point the checkmark at "Custom" while a preset fee is in effect.
          value={
            swapStepNetFeeLevel.customPriorityFee
              ? FEE_TIER_CUSTOM
              : swapStepNetFeeLevel.networkFeeLevel
          }
          title={intl.formatMessage({
            id: ETranslations.swap_review_transaction_speed,
          })}
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
    networkFeeLevelArray,
    networkFeeLevelLabel,
    onSelectNetworkFeeLevel,
    preSwapData.netWorkFee?.gasFeeFiatValue,
    settings.currencyInfo.symbol,
    swapStepNetFeeLevel.networkFeeLevel,
    swapStepNetFeeLevel.customPriorityFee,
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
