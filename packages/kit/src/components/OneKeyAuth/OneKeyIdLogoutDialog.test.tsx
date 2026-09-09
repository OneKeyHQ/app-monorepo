import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IIdentityExitPlan } from '@onekeyhq/shared/types/prime/identityExitTypes';

import { getOneKeyIdLogoutDialogContent } from './oneKeyIdLogoutDialogContent';

import type { IntlShape } from 'react-intl';

type IReadyIdentityExitPlan = Extract<IIdentityExitPlan, { status: 'ready' }>;

const requiredKeylessRecoveryDescription =
  'required-keyless-recovery-description';

const intl = {
  formatMessage: ({ id }: { id: string }) =>
    id === ETranslations.log_out_wallet_desc
      ? requiredKeylessRecoveryDescription
      : id,
} as unknown as IntlShape;

function buildPlan(
  presentation: IReadyIdentityExitPlan['presentation'],
  confirmation: IReadyIdentityExitPlan['confirmation'] = {
    type: 'keylessRemovalAcknowledgement',
  },
): IReadyIdentityExitPlan {
  return {
    status: 'ready',
    planId: 'identity-exit-plan' as IReadyIdentityExitPlan['planId'],
    expiresAt: Date.now() + 60_000,
    presentation,
    confirmation,
  };
}

describe('getOneKeyIdLogoutDialogContent', () => {
  test.each<IReadyIdentityExitPlan['presentation']>([
    {
      type: 'keylessOnly',
      currentProvider: EOAuthSocialLoginProvider.Google,
    },
    {
      type: 'linkedOneKeyIdAndKeyless',
      currentProvider: EOAuthSocialLoginProvider.Google,
    },
    {
      type: 'switchOAuthProvider',
      currentProvider: EOAuthSocialLoginProvider.Google,
      nextProvider: EOAuthSocialLoginProvider.Apple,
      effect: 'keylessOnly',
    },
    {
      type: 'recoverMalformedKeyless',
      nextProvider: EOAuthSocialLoginProvider.Apple,
      oneKeyIdWillBeLoggedOut: false,
    },
  ])(
    'always includes the required recovery description for $type',
    (presentation) => {
      const content = getOneKeyIdLogoutDialogContent({
        intl,
        plan: buildPlan(presentation),
      });

      expect(content.description).toContain(requiredKeylessRecoveryDescription);
      expect(
        content.description.split(requiredKeylessRecoveryDescription),
      ).toHaveLength(2);
    },
  );

  test('does not add the Keyless recovery description to a normal logout', () => {
    const content = getOneKeyIdLogoutDialogContent({
      intl,
      plan: buildPlan({ type: 'oneKeyIdOnly' }, { type: 'normal' }),
    });

    expect(content.description).not.toContain(
      requiredKeylessRecoveryDescription,
    );
  });
});
