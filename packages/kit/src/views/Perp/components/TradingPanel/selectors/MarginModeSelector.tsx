import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { useActiveAssetDataAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsSelectedSymbolAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { showMarginModeDialog } from '../modals/MarginModeModal';

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
  const [selectedSymbol] = usePerpsSelectedSymbolAtom();

  const currentModeLabel = useMemo(() => {
    const currentMode = activeAssetData?.leverage?.type || 'isolated';
    return currentMode === 'cross'
      ? intl.formatMessage({ id: ETranslations.perp_trade_cross })
      : intl.formatMessage({ id: ETranslations.perp_trade_isolated });
  }, [activeAssetData?.leverage?.type, intl]);

  const handlePress = () => {
    if (disabled) return;
    showMarginModeDialog(selectedSymbol?.coin);
  };

  return (
    <XStack
      cursor="pointer"
      onPress={handlePress}
      disabled={disabled}
      height={isMobile ? 32 : 30}
      bg="$bgSubdued"
      borderRadius="$2"
      alignItems="center"
      justifyContent="space-between"
      px="$3"
      hoverStyle={{
        bg: '$bgStrongHover',
      }}
      pressStyle={{
        bg: '$bgStrongActive',
      }}
    >
      <SizableText size="$bodyMdMedium">{currentModeLabel}</SizableText>

      <Icon name="ChevronTriangleDownSmallOutline" color="$icon" size="$5" />
    </XStack>
  );
};

MarginModeSelector.displayName = 'MarginModeSelector';

export { MarginModeSelector };
