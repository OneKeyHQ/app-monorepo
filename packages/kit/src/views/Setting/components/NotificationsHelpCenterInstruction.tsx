import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Anchor, SizableText } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { FormatXMLElementFn } from 'intl-messageformat';

function NotificationsHelpCenterInstruction() {
  const intl = useIntl();
  const renderAnchor: FormatXMLElementFn<string, any> = useCallback(
    (chunks: string[]) => (
      <Anchor
        cursor="default"
        size="$bodyMd"
        color="$textInteractive"
        href="https://onekey.so/"
        target="_blank"
        hoverStyle={{
          color: '$textInteractiveHover',
        }}
      >
        {chunks}
      </Anchor>
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
