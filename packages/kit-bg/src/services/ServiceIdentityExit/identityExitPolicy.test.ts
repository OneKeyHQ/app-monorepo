import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';

import {
  type IIdentityExitSnapshot,
  evaluateIdentityExitPolicy,
} from './identityExitPolicy';

const KEYLESS_SNAPSHOT: Extract<
  IIdentityExitSnapshot['keyless'],
  { type: 'present' }
> = {
  type: 'present',
  walletId: 'keyless-wallet',
  ownerId: 'owner',
  provider: EOAuthSocialLoginProvider.Google,
  socialUserIdHash: 'social-hash',
  sessionCommitId: 'keyless-session',
  sessionTokenSub: 'keyless-sub',
};

const EMAIL_SNAPSHOT: IIdentityExitSnapshot = {
  lifecycleRevision: 3,
  oneKeyId: {
    type: 'loggedIn',
    onekeyUserId: 'email-user',
    source: EPrimeAuthSessionSource.LegacyEmailSupabase,
    sessionCommitId: 'email-session',
    sessionTokenSub: 'email-sub',
    accessToken: 'email-token',
  },
  keyless: KEYLESS_SNAPSHOT,
};

const LINKED_SNAPSHOT: IIdentityExitSnapshot = {
  ...EMAIL_SNAPSHOT,
  oneKeyId: {
    type: 'loggedIn',
    onekeyUserId: 'keyless-user',
    source: EPrimeAuthSessionSource.KeylessOAuth,
    sessionCommitId: 'keyless-session',
    sessionTokenSub: 'keyless-sub',
    accessToken: 'keyless-token',
  },
};

describe('evaluateIdentityExitPolicy', () => {
  test('logs out Email OneKey ID without touching independent Keyless', () => {
    expect(
      evaluateIdentityExitPolicy({
        intent: { type: 'logoutOneKeyId', scene: 'profile' },
        snapshot: EMAIL_SNAPSHOT,
      }),
    ).toMatchObject({
      status: 'ready',
      presentation: { type: 'oneKeyIdOnly' },
      target: { logoutOneKeyId: true, removeKeyless: false },
    });
  });

  test('switches an independent OneKey ID account without touching Keyless', () => {
    expect(
      evaluateIdentityExitPolicy({
        intent: {
          type: 'switchOneKeyIdAccount',
          scene: 'keylessOnboarding',
        },
        snapshot: EMAIL_SNAPSHOT,
      }),
    ).toMatchObject({
      status: 'ready',
      presentation: { type: 'oneKeyIdOnly' },
      confirmation: { type: 'normal' },
      target: { logoutOneKeyId: true, removeKeyless: false },
    });
  });

  test('blocks an account switch instead of removing linked Keyless', () => {
    expect(
      evaluateIdentityExitPolicy({
        intent: {
          type: 'switchOneKeyIdAccount',
          scene: 'legacyOAuthBind',
        },
        snapshot: LINKED_SNAPSHOT,
      }),
    ).toMatchObject({
      status: 'blocked',
      code: 'INTENT_NOT_APPLICABLE',
      message:
        'The current OneKey ID is linked to the local Keyless wallet and cannot be switched while preserving that wallet.',
    });
  });

  test('blocks an account switch when OneKey ID is already logged out', () => {
    expect(
      evaluateIdentityExitPolicy({
        intent: {
          type: 'switchOneKeyIdAccount',
          scene: 'keylessOnboarding',
        },
        snapshot: {
          ...EMAIL_SNAPSHOT,
          oneKeyId: { type: 'loggedOut' },
        },
      }),
    ).toMatchObject({
      status: 'blocked',
      code: 'INTENT_NOT_APPLICABLE',
      message: 'OneKey ID is already logged out.',
    });
  });

  test('removes independent Keyless without logging out Email OneKey ID', () => {
    expect(
      evaluateIdentityExitPolicy({
        intent: {
          type: 'removeKeyless',
          expectedWalletId: 'keyless-wallet',
          scene: 'accountSelector',
        },
        snapshot: EMAIL_SNAPSHOT,
      }),
    ).toMatchObject({
      status: 'ready',
      presentation: { type: 'keylessOnly' },
      target: {
        logoutOneKeyId: false,
        removeKeyless: true,
        clearKeylessSession: true,
      },
    });
  });

  test('uses a linked target when the exact session identities match', () => {
    expect(
      evaluateIdentityExitPolicy({
        intent: { type: 'logoutOneKeyId', scene: 'profile' },
        snapshot: LINKED_SNAPSHOT,
      }),
    ).toMatchObject({
      status: 'ready',
      presentation: { type: 'linkedOneKeyIdAndKeyless' },
      confirmation: { type: 'keylessRemovalAcknowledgement' },
      target: { logoutOneKeyId: true, removeKeyless: true },
    });
  });

  test('logs out only OneKey ID when Keyless-backed identities do not match', () => {
    expect(
      evaluateIdentityExitPolicy({
        intent: { type: 'logoutOneKeyId', scene: 'profile' },
        snapshot: {
          ...LINKED_SNAPSHOT,
          keyless: {
            type: 'present',
            walletId: 'keyless-wallet',
            ownerId: 'owner',
            provider: EOAuthSocialLoginProvider.Google,
            socialUserIdHash: 'social-hash',
            sessionCommitId: 'replacement-session',
            sessionTokenSub: 'keyless-sub',
          },
        },
      }),
    ).toMatchObject({
      status: 'ready',
      presentation: { type: 'oneKeyIdOnly' },
      target: { logoutOneKeyId: true, removeKeyless: false },
    });
  });

  test('removes only Keyless and preserves its session when linkage is unknown', () => {
    expect(
      evaluateIdentityExitPolicy({
        intent: {
          type: 'removeKeyless',
          expectedWalletId: 'keyless-wallet',
          scene: 'accountSelector',
        },
        snapshot: {
          ...LINKED_SNAPSHOT,
          keyless: {
            ...KEYLESS_SNAPSHOT,
            sessionCommitId: 'replacement-session',
          },
        },
      }),
    ).toMatchObject({
      status: 'ready',
      presentation: { type: 'keylessOnly' },
      target: {
        logoutOneKeyId: false,
        removeKeyless: true,
        clearKeylessSession: false,
      },
    });
  });

  test('switches only OneKey ID when Keyless linkage is unknown', () => {
    expect(
      evaluateIdentityExitPolicy({
        intent: {
          type: 'switchOneKeyIdAccount',
          scene: 'legacyOAuthBind',
        },
        snapshot: {
          ...LINKED_SNAPSHOT,
          keyless: {
            ...KEYLESS_SNAPSHOT,
            sessionIdentityStatus: 'unknown',
            sessionIdentityError: 'Keyless wallet session identity is unknown.',
          },
        },
      }),
    ).toMatchObject({
      status: 'ready',
      presentation: { type: 'oneKeyIdOnly' },
      target: { logoutOneKeyId: true, removeKeyless: false },
    });
  });

  test('blocks provider switching when Keyless linkage is unknown', () => {
    expect(
      evaluateIdentityExitPolicy({
        intent: {
          type: 'switchOAuth',
          expectedWalletId: 'keyless-wallet',
          nextProvider: EOAuthSocialLoginProvider.Apple,
          scene: 'oneKeyIdLogin',
        },
        snapshot: {
          ...LINKED_SNAPSHOT,
          keyless: {
            ...KEYLESS_SNAPSHOT,
            sessionIdentityStatus: 'unknown',
            sessionIdentityError: 'Keyless OAuth session field is unreadable.',
          },
        },
      }),
    ).toEqual({
      status: 'blocked',
      code: 'STATE_INCONSISTENT',
      message: 'Keyless OAuth session field is unreadable.',
    });
  });

  test('switches provider only after a Keyless removal target', () => {
    expect(
      evaluateIdentityExitPolicy({
        intent: {
          type: 'switchOAuth',
          expectedWalletId: 'keyless-wallet',
          nextProvider: EOAuthSocialLoginProvider.Apple,
          scene: 'oneKeyIdLogin',
        },
        snapshot: {
          ...EMAIL_SNAPSHOT,
          oneKeyId: { type: 'loggedOut' },
        },
      }),
    ).toMatchObject({
      status: 'ready',
      presentation: {
        type: 'switchOAuthProvider',
        effect: 'keylessOnly',
      },
      target: {
        logoutOneKeyId: false,
        removeKeyless: true,
        clearKeylessSession: true,
        switchOAuthProvider: EOAuthSocialLoginProvider.Apple,
      },
    });
  });
});
