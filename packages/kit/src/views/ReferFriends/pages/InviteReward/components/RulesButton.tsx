import { useIntl } from 'react-intl';

import { Button, IconButton, useMedia } from '@onekeyhq/components';
import { REFERRAL_HELP_LINK } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  openUrlExternal,
  openUrlInDiscovery,
} from '@onekeyhq/shared/src/utils/openUrlUtils';

export function RulesButton() {
  const intl = useIntl();
  const { md } = useMedia();

  const handlePress = () => {
    if (platformEnv.isDesktop || platformEnv.isNative) {
      openUrlInDiscovery({ url: REFERRAL_HELP_LINK });
    } else {
      openUrlExternal(REFERRAL_HELP_LINK);
    }
  };

  const label = intl.formatMessage({
    id: ETranslations.referral_global_rules,
  });

  if (md) {
    return (
      <IconButton
        variant="tertiary"
        icon="QuestionmarkOutline"
        onPress={handlePress}
        title={label}
      />
    );
  }

  return (
    <Button
      variant="tertiary"
      size={platformEnv.isWeb ? 'small' : undefined}
      icon="QuestionmarkOutline"
      onPress={handlePress}
    >
      {label}
    </Button>
  );
}
