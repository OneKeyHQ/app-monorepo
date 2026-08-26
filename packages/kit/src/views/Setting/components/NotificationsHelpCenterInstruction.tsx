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

function NotificationsHelpCenterInstruction({
  size = '$bodyMd',
}: {
  size?: '$bodySm' | '$bodyMd';
}) {
  const intl = useIntl();
  const handlePress = useCallback(() => {
    if (platformEnv.isDesktop || platformEnv.isNative) {
      openUrlInDiscovery({ url: NOTIFICATIONS_HELP_CENTER_URL });
    } else {
      openUrlExternal(NOTIFICATIONS_HELP_CENTER_URL);
    }
  }, []);

  return (
    <SizableText
      accessibilityRole="link"
      alignSelf="flex-start"
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
