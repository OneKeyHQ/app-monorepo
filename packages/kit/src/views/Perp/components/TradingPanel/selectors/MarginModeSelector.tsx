import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Select, SizableText, XStack } from '@onekeyhq/components';
import type { ISelectItem } from '@onekeyhq/components';
import {
  useActiveAssetDataAtom,
  useHyperliquidActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useCurrentTokenData } from '../../../hooks';

type IMarginMode = 'isolated' | 'cross';

interface IMarginModeSelectorProps {
  disabled?: boolean;
}

const MarginModeSelector = ({ disabled = false }: IMarginModeSelectorProps) => {
  const intl = useIntl();
  const [activeAssetData] = useActiveAssetDataAtom();
  const tokenInfo = useCurrentTokenData();
  const actions = useHyperliquidActions();

  const marginModeOptions = useMemo(
    (): ISelectItem[] => [
      {
        label: intl.formatMessage({
          id: ETranslations.perp_trade_isolated,
        }),
        value: 'isolated',
      },
      {
        label: intl.formatMessage({
          id: ETranslations.perp_trade_cross,
        }),
        value: 'cross',
      },
    ],
    [intl],
  );

  const currentMode: IMarginMode =
    activeAssetData?.leverage?.type || 'isolated';

  const handleChange = useCallback(
    async (newMode: IMarginMode) => {
      console.log('newMode', newMode, tokenInfo?.assetId);
      if (!tokenInfo?.assetId) return;

      const currentLeverage = activeAssetData?.leverage?.value || 1;
      const isCross = newMode === 'cross';

      try {
        await actions.current.updateLeverage({
          asset: tokenInfo.assetId,
          leverage: currentLeverage,
          isCross,
        });
      } catch (error) {
        console.error(
          '[MarginModeSelector.handleChange] Failed to update margin mode:',
          error,
        );
      }
    },
    [tokenInfo?.assetId, activeAssetData?.leverage?.value, actions],
  );

  return (
    <Select
      items={marginModeOptions}
      value={currentMode}
      onChange={handleChange}
      disabled={disabled}
      title="Margin Mode"
      renderTrigger={({ onPress, label, disabled: disabledTrigger }) => (
        <XStack
          cursor="pointer"
          onPress={onPress}
          disabled={disabledTrigger}
          height={30}
          bg="$bgSubdued"
          borderRadius="$2"
          alignItems="center"
          justifyContent="space-between"
          px="$3"
        >
          <SizableText size="$bodyMdMedium">{label}</SizableText>
          <Icon
            name="ChevronTriangleDownSmallOutline"
            color="$icon"
            size="$5"
          />
        </XStack>
      )}
      placement="bottom-start"
      floatingPanelProps={{
        width: 120,
      }}
    />
  );
};

MarginModeSelector.displayName = 'MarginModeSelector';

export { MarginModeSelector };
