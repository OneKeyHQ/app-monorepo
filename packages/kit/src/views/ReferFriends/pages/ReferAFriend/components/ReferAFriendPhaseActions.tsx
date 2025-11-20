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
  placement = 'inline',
}: IReferAFriendPhaseActionsProps) {
  const intl = useIntl();
  const { toInviteRewardPage } = useReferFriends();
  const isFooter = placement === 'footer';

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
      <Button
        variant="primary"
        w="100%"
        size={isFooter ? 'large' : undefined}
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
          variant="secondary"
          width="47%"
          size={isFooter ? 'large' : undefined}
          onPress={handleBackToIntro}
        >
          {intl.formatMessage({
            id: ETranslations.perp_term_previous,
          })}
        </Button>
        <Button
          variant="primary"
          width="47%"
          size={isFooter ? 'large' : undefined}
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
