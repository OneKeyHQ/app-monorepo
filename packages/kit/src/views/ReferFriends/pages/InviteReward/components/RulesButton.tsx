import { Button } from '@onekeyhq/components';
import { REFERRAL_HELP_LINK } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { useIntl } from 'react-intl';

export function RulesButton() {
  const intl = useIntl();

  const handlePress = () => {
    void openUrlExternal(REFERRAL_HELP_LINK);
  };

  return (
    <Button
      variant="tertiary"
      icon="QuestionmarkOutline"
      onPress={handlePress}
    >
      {intl.formatMessage({ id: ETranslations.global_details })}
    </Button>
  );
}
