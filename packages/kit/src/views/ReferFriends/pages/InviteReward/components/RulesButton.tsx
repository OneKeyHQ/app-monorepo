import { useIntl } from 'react-intl';

import { Button, IconButton, useMedia } from '@onekeyhq/components';
import { REFERRAL_HELP_LINK } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlInApp } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { ReferFriendsTestIDs } from '../../../testIDs';

export function RulesButton() {
  const intl = useIntl();
  const { md } = useMedia();

  const label = intl.formatMessage({
    id: ETranslations.referral_global_rules,
  });
  // The in-app web view stacks on the current screen (the referral modal on
  // phones), so closing it returns to the page; web opens a new tab. Links
  // that leave the help site go to Discovery and its URL risk checks.
  const handlePress = () => {
    openUrlInApp(REFERRAL_HELP_LINK, label, {
      redirectExternalNavigation: true,
    });
  };

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
