import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useReferFriends } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

import { ReferFriendsTestIDs } from '../../../testIDs';
import { EPhaseState } from '../types';

interface IReferAFriendPhaseActionsProps {
  phaseState: EPhaseState;
  setPhaseState: (state: EPhaseState) => void;
}

export function ReferAFriendPhaseActions({
  phaseState,
  setPhaseState,
}: IReferAFriendPhaseActionsProps) {
  const intl = useIntl();
  const { toInviteRewardPage } = useReferFriends();
  const handleBackToIntro = useCallback(() => {
    setPhaseState(EPhaseState.next);
  }, [setPhaseState]);

  const handleNext = useCallback(() => {
    setPhaseState(EPhaseState.join);
  }, [setPhaseState]);

  const handleJoin = useCallback(async () => {
    await backgroundApiProxy.serviceSpotlight.firstVisitTour(
      ESpotlightTour.referAFriend,
    );
    setTimeout(() => {
      void toInviteRewardPage();
    }, 200);
  }, [toInviteRewardPage]);

  if (phaseState === EPhaseState.next) {
    return (
      <Button
        testID={ReferFriendsTestIDs.nextBtn}
        variant="primary"
        w="100%"
        size="large"
        onPress={handleNext}
      >
        {intl.formatMessage({
          id: ETranslations.global_next,
        })}
      </Button>
    );
  }

  if (phaseState === EPhaseState.join) {
    return (
      <XStack gap="$4" w="100%" justifyContent="space-between">
        <Button
          testID={ReferFriendsTestIDs.previousBtn}
          variant="secondary"
          flex={1}
          size="large"
          onPress={handleBackToIntro}
        >
          {intl.formatMessage({
            id: ETranslations.global_back,
          })}
        </Button>
        <Button
          testID={ReferFriendsTestIDs.joinBtn}
          variant="primary"
          flex={1}
          size="large"
          onPress={handleJoin}
        >
          {intl.formatMessage({
            id: ETranslations.global_join,
          })}
        </Button>
      </XStack>
    );
  }

  return null;
}
