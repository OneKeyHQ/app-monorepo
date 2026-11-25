import { useIntl } from 'react-intl';

import { IconButton } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { HEADER_ICON_BUTTON_STYLE_PROPS } from '../../TradingViewChartControls/utils/NativeChartControlsShared';

interface ITradingViewNativeMaximizeButtonProps {
  backgroundColor: string;
  isMaximized: boolean;
  onPress: () => void;
  priceAxisWidth: number;
  testID?: string;
  timeAxisHeight: number;
}

// Maximizes the chart's split-view panel, or brings the split back, from the
// empty corner where the price axis meets the time axis.
export function TradingViewNativeMaximizeButton({
  backgroundColor,
  isMaximized,
  onPress,
  priceAxisWidth,
  testID,
  timeAxisHeight,
}: ITradingViewNativeMaximizeButtonProps) {
  const intl = useIntl();
  const label = intl.formatMessage({
    id: isMaximized
      ? ETranslations.global_restore
      : ETranslations.global_expand,
  });
  return (
    <div
      role="presentation"
      style={{
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: priceAxisWidth,
        height: timeAxisHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Above the loading mask laid over the chart while a token loads, so
        // a maximized panel can always be restored.
        zIndex: 3,
      }}
      // Enter activates the focused button. The chart's drawing shortcuts
      // listen on the document and would finish a path being drawn instead.
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.stopPropagation();
      }}
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
    </div>
  );
}
