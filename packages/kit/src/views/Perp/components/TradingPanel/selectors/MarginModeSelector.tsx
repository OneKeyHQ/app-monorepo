import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  SizableText,
  XStack,
  useInPageDialog,
} from '@onekeyhq/components';
import {
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  CONTEXTUAL_ARTICLE_IDS,
  buildHelpUrl,
  openGuideUrl,
} from '../../Guide/perpGuideData';
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
  const [activeAssetData] = usePerpsActiveAssetDataAtom();
  const [selectedSymbol] = usePerpsActiveAssetAtom();

  const currentModeLabel = useMemo(() => {
    const currentMode = activeAssetData?.leverage?.type || 'isolated';
    return currentMode === 'cross'
      ? intl.formatMessage({ id: ETranslations.perp_trade_cross })
      : intl.formatMessage({ id: ETranslations.perp_trade_isolated });
  }, [activeAssetData?.leverage?.type, intl]);

  const dialog = useInPageDialog();

  const handlePress = () => {
    if (disabled) return;
    showMarginModeDialog(selectedSymbol?.coin, dialog);
  };

  return (
    <XStack
      onPress={handlePress}
      disabled={disabled}
      height={isMobile ? 32 : 30}
      bg={isMobile ? '$bgSubdued' : '$bgStrong'}
      borderRadius="$2"
      alignItems="center"
      justifyContent="space-between"
      px="$3"
      cursor="default"
      hoverStyle={{
        bg: '$bgStrongHover',
      }}
      pressStyle={{
        bg: '$bgStrongActive',
      }}
    >
      <SizableText size="$bodyMdMedium">{currentModeLabel}</SizableText>

      <XStack alignItems="center" gap="$1">
        <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$4" />
        <Icon
          name="QuestionmarkOutline"
          size="$3.5"
          color="$iconSubdued"
          hitSlop={8}
          cursor="default"
          onPress={(e) => {
            e.stopPropagation();
            openGuideUrl(
              buildHelpUrl(`articles/${CONTEXTUAL_ARTICLE_IDS.marginMode}`),
            );
          }}
        />
      </XStack>
    </XStack>
  );
};

MarginModeSelector.displayName = 'MarginModeSelector';

export { MarginModeSelector };
