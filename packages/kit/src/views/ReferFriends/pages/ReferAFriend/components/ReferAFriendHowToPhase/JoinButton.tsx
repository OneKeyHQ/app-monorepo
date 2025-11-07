import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useReferFriends } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

import { EPhaseState } from '../../types';

interface IJoinButtonProps {
  setPhaseState: (state: EPhaseState | undefined) => void;
}

export function JoinButton({ setPhaseState }: IJoinButtonProps) {
  const intl = useIntl();
  const { toInviteRewardPage } = useReferFriends();

  return (
    <XStack gap="$4" pb="$5">
      <Button
        variant="secondary"
        flex={1}
        onPress={async () => {
          setPhaseState(undefined);
          setTimeout(() => {
            setPhaseState(EPhaseState.next);
          }, 50);
        }}
      >
        {intl.formatMessage({
          id: ETranslations.global_cancel,
        })}
      </Button>
      <Button
        variant="primary"
        flex={1}
        onPress={async () => {
          await backgroundApiProxy.serviceSpotlight.firstVisitTour(
            ESpotlightTour.referAFriend,
          );
          setTimeout(() => {
            void toInviteRewardPage();
          }, 200);
        }}
      >
        {intl.formatMessage({
          id: ETranslations.global_join,
        })}
      </Button>
    </XStack>
  );
}
