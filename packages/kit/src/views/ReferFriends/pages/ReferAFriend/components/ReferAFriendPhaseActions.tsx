import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useReferFriends } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

import { EPhaseState } from '../types';

export type IReferAFriendActionPlacement = 'inline' | 'footer';

interface IReferAFriendPhaseActionsProps {
  phaseState: EPhaseState | undefined;
  setPhaseState: (state: EPhaseState | undefined) => void;
  placement?: IReferAFriendActionPlacement;
}

export function ReferAFriendPhaseActions({
  phaseState,
  setPhaseState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  placement = 'inline',
}: IReferAFriendPhaseActionsProps) {
  const intl = useIntl();
  const { toInviteRewardPage } = useReferFriends();
  const handleBackToIntro = useCallback(() => {
    setPhaseState(undefined);
    setTimeout(() => {
      setPhaseState(EPhaseState.next);
    }, 50);
  }, [setPhaseState]);

  const handleNext = useCallback(() => {
    setPhaseState(undefined);
    setTimeout(() => {
      setPhaseState(EPhaseState.join);
    }, 50);
  }, [setPhaseState]);

  const handleJoin = useCallback(async () => {
    await backgroundApiProxy.serviceSpotlight.firstVisitTour(
      ESpotlightTour.referAFriend,
    );
    setTimeout(() => {
      void toInviteRewardPage();
    }, 200);
  }, [toInviteRewardPage]);

  if (!phaseState) {
    return null;
  }

  if (phaseState === EPhaseState.next) {
    return (
      <Button variant="primary" w="100%" size="large" onPress={handleNext}>
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
          variant="secondary"
          flex={1}
          size="large"
          onPress={handleBackToIntro}
        >
          {intl.formatMessage({
            id: ETranslations.perp_term_previous,
          })}
        </Button>
        <Button variant="primary" flex={1} size="large" onPress={handleJoin}>
          {intl.formatMessage({
            id: ETranslations.global_join,
          })}
        </Button>
      </XStack>
    );
  }

  return null;
}
