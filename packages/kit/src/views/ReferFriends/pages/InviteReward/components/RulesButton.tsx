import { useIntl } from 'react-intl';

import { Button, IconButton, useMedia } from '@onekeyhq/components';
import { REFERRAL_HELP_LINK } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlInApp } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { ReferFriendsTestIDs } from '../../../testIDs';

// The in-app web view stacks on the current screen (the referral modal on
// phones), so closing it returns to the page; web opens a new tab.
export function openReferralRules(title: string) {
  openUrlInApp(REFERRAL_HELP_LINK, title);
}

export function RulesButton() {
  const intl = useIntl();
  const { md } = useMedia();

  const label = intl.formatMessage({
    id: ETranslations.referral_global_rules,
  });
  const handlePress = () => {
    openReferralRules(label);
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
