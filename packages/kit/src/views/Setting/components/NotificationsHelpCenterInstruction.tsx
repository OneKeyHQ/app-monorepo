import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { SizableText } from '@onekeyhq/components';
import { NOTIFICATIONS_HELP_CENTER_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  openUrlExternal,
  openUrlInDiscovery,
} from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { FormatXMLElementFn } from 'intl-messageformat';

function NotificationsHelpCenterInstruction({
  size = '$bodyMd',
  showDescription = false,
}: {
  size?: '$bodySm' | '$bodyMd';
  showDescription?: boolean;
}) {
  const intl = useIntl();
  const handlePress = useCallback(() => {
    if (platformEnv.isDesktop || platformEnv.isNative) {
      openUrlInDiscovery({ url: NOTIFICATIONS_HELP_CENTER_URL });
    } else {
      openUrlExternal(NOTIFICATIONS_HELP_CENTER_URL);
    }
  }, []);
  const renderAnchor: FormatXMLElementFn<string, any> = useCallback(
    (chunks: string[]) => (
      <SizableText
        accessibilityRole="link"
        size={size}
        color="$textInteractive"
        cursor="pointer"
        onPress={handlePress}
        pressStyle={{ opacity: 0.8 }}
        hoverStyle={{ color: '$textInteractiveHover' }}
      >
        {chunks}
      </SizableText>
    ),
    [handlePress, size],
  );

  if (showDescription) {
    return (
      <SizableText flex={1} minWidth={0} size={size} color="$textSubdued">
        {intl.formatMessage(
          { id: ETranslations.notifications_test_action_desc },
          { tag: renderAnchor },
        )}
      </SizableText>
    );
  }

  return (
    <SizableText
      accessibilityRole="link"
      size={size}
      color="$textInteractive"
      cursor="pointer"
      onPress={handlePress}
      pressStyle={{ opacity: 0.8 }}
      hoverStyle={{ color: '$textInteractiveHover' }}
    >
      {intl.formatMessage({ id: ETranslations.menu_visit_help_center })}
    </SizableText>
  );
}

export default NotificationsHelpCenterInstruction;
