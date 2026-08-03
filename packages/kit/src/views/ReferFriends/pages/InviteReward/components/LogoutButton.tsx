import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import { useIdentityExitFlow } from '@onekeyhq/kit/src/components/OneKeyAuth/useIdentityExitFlow';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ReferFriendsTestIDs } from '../../../testIDs';

export function LogoutButton() {
  const intl = useIntl();
  const { run: runIdentityExit } = useIdentityExitFlow();

  const handlePress = () => {
    void runIdentityExit(
      { type: 'logoutOneKeyId', scene: 'referral' },
      { analyticsReason: 'Referral Logout Button' },
    );
  };

  return (
    <Button
      testID={ReferFriendsTestIDs.logoutBtn}
      variant="tertiary"
      size="small"
      icon="LogoutOutline"
      onPress={handlePress}
    >
      {intl.formatMessage({ id: ETranslations.prime_log_out })}
    </Button>
  );
}
