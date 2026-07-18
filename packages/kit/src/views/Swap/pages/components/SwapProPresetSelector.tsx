import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Divider, Icon, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

import {
  type IEstimateMarketPresetPriorityFeeFiatValues,
  getPriorityFeeLabel,
  showMarketPresetSettingsDialog,
} from '../../../Market/MarketDetailV2/components/SwapPanel/components/MarketPresetSelector';

import type { IMarketPresetSettingsState } from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useMarketPresetSettings';

type ISwapProPresetSelectorProps = {
  // Only `true` is surfaced because anti-MEV is read-only when supported.
  antiMEV?: boolean;
  estimatePriorityFeeFiatValues?: IEstimateMarketPresetPriorityFeeFiatValues;
  presetSettings: IMarketPresetSettingsState;
};

// Swap Pro-owned preset row. It lives inside the narrow trading column
// (between the account row and the action button), so it keeps its own
// layout instead of sharing TradingWidgetMainButton with the Market panel.
// Preset tiers are switched inside the settings dialog opened by this row.
const SwapProPresetSelector = ({
  antiMEV,
  estimatePriorityFeeFiatValues,
  presetSettings,
}: ISwapProPresetSelectorProps) => {
  const intl = useIntl();
  const { enabled, presets, selectedDirectionSettings, selectedSlippageValue } =
    presetSettings;

  const openPresetDialog = useCallback(() => {
    showMarketPresetSettingsDialog({
      intl,
      antiMEV,
      estimatePriorityFeeFiatValues,
      presetSettings,
    });
  }, [antiMEV, estimatePriorityFeeFiatValues, intl, presetSettings]);

  if (!enabled || presets.length === 0) {
    return null;
  }

  const slippageLabel =
    selectedDirectionSettings.slippage.key === ESwapSlippageSegmentKey.AUTO
      ? intl.formatMessage({ id: ETranslations.global_auto })
      : `${selectedSlippageValue}%`;
  const priorityFeeLabel = getPriorityFeeLabel({
    intl,
    settings: selectedDirectionSettings,
    unit: presetSettings.priorityFeeUnit,
  });

  return (
    <XStack
      alignItems="center"
      borderRadius="$2"
      cursor="pointer"
      gap="$2"
      py="$1"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={openPresetDialog}
      testID="swap-pro-preset-selector"
    >
      <XStack alignItems="center" flexShrink={0} gap="$1">
        <Icon name="SliderVerOutline" size="$3.5" color="$iconSubdued" />
        <SizableText
          size="$bodySmMedium"
          color="$textSubdued"
          numberOfLines={1}
        >
          {slippageLabel}
        </SizableText>
      </XStack>

      <Divider vertical h={12} />

      <XStack alignItems="center" flexShrink={1} minWidth={0} gap="$1">
        <Icon name="HandCoinsOutline" size="$3.5" color="$iconSubdued" />
        <SizableText
          size="$bodySmMedium"
          color="$textSubdued"
          numberOfLines={1}
        >
          {priorityFeeLabel}
        </SizableText>
      </XStack>

      {antiMEV === true ? <Divider vertical h={12} /> : null}

      {antiMEV === true ? (
        <Icon name="ShieldCheckDoneSolid" size="$3.5" color="$iconSuccess" />
      ) : null}

      <XStack ml="auto" alignItems="center" flexShrink={0}>
        <Icon name="ChevronRightSmallOutline" size="$4" color="$iconSubdued" />
      </XStack>
    </XStack>
  );
};

export default SwapProPresetSelector;
