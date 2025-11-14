import { useIntl } from 'react-intl';

import { Button, useMedia } from '@onekeyhq/components';
import { REFERRAL_HELP_LINK } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

export function RulesButton() {
  const intl = useIntl();
  const { md } = useMedia();

  const handlePress = () => {
    void openUrlExternal(REFERRAL_HELP_LINK);
  };

  return (
    <Button
      variant="tertiary"
      icon={md ? undefined : 'QuestionmarkOutline'}
      onPress={handlePress}
    >
      {intl.formatMessage({ id: ETranslations.referral_global_rules })}
    </Button>
  );
}
