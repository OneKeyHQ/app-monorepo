import { useIntl } from 'react-intl';

import { Button, IconButton, useMedia } from '@onekeyhq/components';
import { REFERRAL_HELP_LINK } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  openUrlExternal,
  openUrlInDiscovery,
} from '@onekeyhq/shared/src/utils/openUrlUtils';

import { ReferFriendsTestIDs } from '../../../testIDs';

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
        testID={ReferFriendsTestIDs.rulesBtn}
        variant="tertiary"
        icon="QuestionmarkOutline"
        onPress={handlePress}
        title={label}
      />
    );
  }

  return (
    <Button
      testID={ReferFriendsTestIDs.rulesBtn}
      variant="tertiary"
      // Small on every platform so it matches the level pill beside it
      // (same text size and hover box).
      size="small"
      icon="QuestionmarkOutline"
      onPress={handlePress}
    >
      {label}
    </Button>
  );
}
