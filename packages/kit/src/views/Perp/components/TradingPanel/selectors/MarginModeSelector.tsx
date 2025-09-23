import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Select,
  SizableText,
  Spinner,
  XStack,
} from '@onekeyhq/components';
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
  isMobile?: boolean;
}

const MarginModeSelector = ({
  disabled = false,
  isMobile = false,
}: IMarginModeSelectorProps) => {
  const intl = useIntl();
  const [activeAssetData] = useActiveAssetDataAtom();
  const tokenInfo = useCurrentTokenData();
  const actions = useHyperliquidActions();

  const [isLoading, setIsLoading] = useState(false);

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
      if (tokenInfo?.assetId === undefined) return;

      const currentLeverage = activeAssetData?.leverage?.value || 1;
      const isCross = newMode === 'cross';

      try {
        setIsLoading(true);
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
      } finally {
        setIsLoading(false);
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
      title={intl.formatMessage({
        id: ETranslations.perp_trade_margin_type,
      })}
      renderTrigger={({ onPress, label, disabled: disabledTrigger }) => (
        <XStack
          cursor="pointer"
          onPress={onPress}
          disabled={disabledTrigger}
          height={isMobile ? 32 : 30}
          bg="$bgSubdued"
          borderRadius="$2"
          alignItems="center"
          justifyContent="space-between"
          px="$3"
        >
          <SizableText size="$bodyMdMedium">{label}</SizableText>

          {isLoading ? (
            <Spinner size="small" />
          ) : (
            <Icon
              name="ChevronTriangleDownSmallOutline"
              color="$icon"
              size="$5"
            />
          )}
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
