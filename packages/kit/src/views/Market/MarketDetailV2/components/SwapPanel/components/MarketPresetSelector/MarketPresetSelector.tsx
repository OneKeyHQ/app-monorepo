import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  SegmentControl,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  EMarketPresetKey,
  EMarketPresetPriorityFeeType,
} from '../../hooks/marketPresetSettings';

import type { IMarketPresetSettingsState } from '../../hooks/useMarketPresetSettings';

type IMarketPresetSelectorProps = {
  presetSettings: IMarketPresetSettingsState;
};

function getPriorityFeeTranslationId(type?: EMarketPresetPriorityFeeType) {
  if (type === EMarketPresetPriorityFeeType.FAST) {
    return ETranslations.transaction_fast;
  }

  if (type === EMarketPresetPriorityFeeType.CUSTOM) {
    return ETranslations.content__custom;
  }

  return ETranslations.global_market;
}

export function MarketPresetSelector({
  presetSettings,
}: IMarketPresetSelectorProps) {
  const intl = useIntl();
  const {
    enabled,
    presets,
    selectedPreset,
    selectedPresetKey,
    selectedSlippageValue,
    onPresetChange,
  } = presetSettings;

  const presetOptions = useMemo(
    () =>
      presets.map((preset) => ({
        label: preset.label,
        value: preset.key,
        testID: `market-preset-${preset.key}`,
      })),
    [presets],
  );

  if (!enabled || presetOptions.length === 0) {
    return null;
  }

  const slippageLabel =
    selectedPreset?.key === EMarketPresetKey.AUTO ||
    selectedPreset?.slippage.value === undefined
      ? intl.formatMessage({ id: ETranslations.global_auto })
      : `${selectedSlippageValue}%`;
  const priorityFeeLabel = intl.formatMessage({
    id: getPriorityFeeTranslationId(selectedPreset?.priorityFee.type),
  });

  return (
    <YStack gap="$2" testID="market-preset-selector">
      <SegmentControl
        fullWidth
        value={selectedPresetKey}
        options={presetOptions}
        onChange={(value) => onPresetChange(value as EMarketPresetKey)}
        segmentControlItemStyleProps={{
          px: '$2',
          minWidth: 0,
        }}
      />

      <XStack
        alignItems="center"
        justifyContent="space-between"
        bg="$bgSubdued"
        borderColor="$borderSubdued"
        borderRadius="$2"
        borderWidth="$px"
        minHeight="$10"
        px="$3"
        py="$2"
      >
        <XStack alignItems="center" gap="$1.5" flex={1} minWidth={0}>
          <Icon name="SliderHorOutline" size="$5" color="$iconSubdued" />
          <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
            {slippageLabel}
          </SizableText>
        </XStack>

        <Divider vertical h="$4" mx="$2" />

        <XStack alignItems="center" gap="$1.5" flex={1} minWidth={0}>
          <Icon name="SpeedOutline" size="$5" color="$iconSubdued" />
          <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
            {priorityFeeLabel}
          </SizableText>
        </XStack>

        <Divider vertical h="$4" mx="$2" />

        <XStack alignItems="center" justifyContent="flex-end" flex={1}>
          <Icon name="ShieldCheckDoneSolid" size="$5" color="$iconSuccess" />
        </XStack>
      </XStack>
    </YStack>
  );
}
