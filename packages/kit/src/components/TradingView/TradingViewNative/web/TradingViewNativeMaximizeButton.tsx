import { useIntl } from 'react-intl';

import { IconButton, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { HEADER_ICON_BUTTON_STYLE_PROPS } from '../../TradingViewChartControls/utils/NativeChartControlsShared';

interface ITradingViewNativeMaximizeButtonProps {
  backgroundColor: string;
  /** The time axis row. */
  height: number;
  isMaximized: boolean;
  onPress: () => void;
  testID?: string;
  /** The price axis column, or as wide as the row is high without one. */
  width: number;
}

// Maximizes the chart's split-view panel, or brings the split back, from the
// corner where the price axis meets the time axis.
export function TradingViewNativeMaximizeButton({
  backgroundColor,
  height,
  isMaximized,
  onPress,
  testID,
  width,
}: ITradingViewNativeMaximizeButtonProps) {
  const intl = useIntl();
  const label = intl.formatMessage({
    id: isMaximized
      ? ETranslations.global_restore
      : ETranslations.global_expand,
  });
  return (
    <Stack
      position="absolute"
      right={0}
      bottom={0}
      width={width}
      height={height}
      alignItems="center"
      justifyContent="center"
      zIndex={2}
    >
      <IconButton
        testID={`${testID ?? 'trading-view-native-canvas'}-maximize`}
        aria-label={label}
        title={label}
        size="small"
        variant="tertiary"
        icon={isMaximized ? 'MinimizeWindowOutline' : 'OpenOutline'}
        iconSize="$4"
        hotKey
        onPress={onPress}
        {...HEADER_ICON_BUTTON_STYLE_PROPS}
        p="$0.5"
        borderRadius="$1"
        // Covers whatever the axis would draw beneath it.
        bg={backgroundColor}
      />
    </Stack>
  );
}
