import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import { useNavigateToYourReferred } from '@onekeyhq/kit/src/views/ReferFriends/pages/YourReferred/hooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function ReferralListButton() {
  const intl = useIntl();
  const navigateToYourReferred = useNavigateToYourReferred();

  return (
    <Button size="small" variant="tertiary" onPress={navigateToYourReferred}>
      {intl.formatMessage({ id: ETranslations.referral_referral_list })}
    </Button>
  );
}
