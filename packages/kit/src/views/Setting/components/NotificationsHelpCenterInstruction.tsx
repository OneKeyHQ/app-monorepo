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

function NotificationsHelpCenterInstruction() {
  const intl = useIntl();
  const renderAnchor: FormatXMLElementFn<string, any> = useCallback(
    (chunks: string[]) => (
      <SizableText
        size="$bodyMd"
        color="$textInteractive"
        cursor="pointer"
        onPress={() => {
          if (platformEnv.isDesktop || platformEnv.isNative) {
            openUrlInDiscovery({ url: NOTIFICATIONS_HELP_CENTER_URL });
          } else {
            openUrlExternal(NOTIFICATIONS_HELP_CENTER_URL);
          }
        }}
        hoverStyle={{
          color: '$textInteractiveHover',
        }}
      >
        {chunks}
      </SizableText>
    ),
    [],
  );

  return (
    <SizableText maxWidth="$96" size="$bodyMd" color="$textSubdued">
      {intl.formatMessage(
        {
          id: ETranslations.notifications_test_action_desc,
        },
        {
          tag: renderAnchor,
        },
      )}
    </SizableText>
  );
}

export default NotificationsHelpCenterInstruction;
