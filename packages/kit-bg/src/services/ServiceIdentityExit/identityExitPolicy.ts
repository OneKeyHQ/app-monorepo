import type { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import type {
  IIdentityExitIntent,
  IIdentityExitPlan,
} from '@onekeyhq/shared/types/prime/identityExitTypes';
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';

export type IIdentityExitSnapshot = {
  lifecycleRevision: number;
  oneKeyId:
    | { type: 'loggedOut' }
    | {
        type: 'loggedIn';
        onekeyUserId: string;
        source: EPrimeAuthSessionSource;
        sessionCommitId: string;
        sessionTokenSub: string;
        accessToken: string;
      };
  keyless:
    | { type: 'absent' }
    | {
        type: 'present';
        walletId: string;
        ownerId: string;
        provider: EOAuthSocialLoginProvider;
        socialUserIdHash: string;
        sessionCommitId?: string;
        sessionTokenSub?: string;
        walletSessionCommitId?: string;
        sessionIdentityStatus?: 'verified' | 'unknown';
        sessionIdentityError?: string;
      };
};

export type IIdentityExitExecutionTarget = {
  logoutOneKeyId: boolean;
  removeKeyless: boolean;
  clearKeylessSession?: boolean;
  switchOAuthProvider?: EOAuthSocialLoginProvider;
  allowUnknownKeylessSessionIdentity?: boolean;
};

export type IIdentityExitPolicyResult =
  | Extract<IIdentityExitPlan, { status: 'blocked' }>
  | {
      status: 'ready';
      presentation: Extract<
        IIdentityExitPlan,
        { status: 'ready' }
      >['presentation'];
      confirmation: Extract<
        IIdentityExitPlan,
        { status: 'ready' }
      >['confirmation'];
      target: IIdentityExitExecutionTarget;
    };

type IIdentityLinkage = 'independent' | 'linked' | 'unknown';

export function getIdentityLinkage(
  snapshot: IIdentityExitSnapshot,
): IIdentityLinkage {
  const oneKeyId =
    snapshot.oneKeyId.type === 'loggedIn' ? snapshot.oneKeyId : undefined;
  const keyless =
    snapshot.keyless.type === 'present' ? snapshot.keyless : undefined;
  if (
    !oneKeyId ||
    oneKeyId.source !== EPrimeAuthSessionSource.KeylessOAuth ||
    !keyless
  ) {
    return 'independent';
  }
  if (
    keyless.sessionIdentityStatus === 'unknown' ||
    !oneKeyId.sessionCommitId ||
    !keyless.sessionCommitId ||
    oneKeyId.sessionCommitId !== keyless.sessionCommitId ||
    !oneKeyId.sessionTokenSub ||
    oneKeyId.sessionTokenSub !== keyless.sessionTokenSub
  ) {
    return 'unknown';
  }
  return 'linked';
}

function blocked(
  code: Extract<IIdentityExitPlan, { status: 'blocked' }>['code'],
  message: string,
): IIdentityExitPolicyResult {
  return { status: 'blocked', code, message };
}

export function evaluateIdentityExitPolicy({
  intent,
  snapshot,
}: {
  intent: IIdentityExitIntent;
  snapshot: IIdentityExitSnapshot;
}): IIdentityExitPolicyResult {
  const oneKeyId =
    snapshot.oneKeyId.type === 'loggedIn' ? snapshot.oneKeyId : undefined;
  const keyless =
    snapshot.keyless.type === 'present' ? snapshot.keyless : undefined;
  const hasOneKeyId = Boolean(oneKeyId);

  const linkage = getIdentityLinkage(snapshot);
  const isLinked = linkage === 'linked';
  const isKeylessSessionIdentityUnknown =
    keyless?.sessionIdentityStatus === 'unknown';
  const linkageError =
    keyless?.sessionIdentityError ||
    // TODO: i18n
    'The OneKey ID and local Keyless session identities do not match.';

  if (intent.type === 'recoverMalformedKeyless') {
    return blocked(
      'INTENT_NOT_APPLICABLE',
      // TODO: i18n
      'The local Keyless wallet data is not malformed.',
    );
  }

  if (intent.type === 'logoutOneKeyId') {
    if (!hasOneKeyId) {
      return blocked(
        'INTENT_NOT_APPLICABLE',
        // TODO: i18n
        'OneKey ID is already logged out.',
      );
    }
    if (isLinked && keyless) {
      return {
        status: 'ready',
        presentation: {
          type: 'linkedOneKeyIdAndKeyless',
          currentProvider: keyless.provider,
        },
        confirmation: { type: 'keylessRemovalAcknowledgement' },
        target: {
          logoutOneKeyId: true,
          removeKeyless: true,
          clearKeylessSession: true,
        },
      };
    }
    return {
      status: 'ready',
      presentation: { type: 'oneKeyIdOnly' },
      confirmation: { type: 'normal' },
      target: { logoutOneKeyId: true, removeKeyless: false },
    };
  }

  if (intent.type === 'switchOneKeyIdAccount') {
    if (!hasOneKeyId) {
      return blocked(
        'INTENT_NOT_APPLICABLE',
        // TODO: i18n
        'OneKey ID is already logged out.',
      );
    }
    if (isLinked) {
      return blocked(
        'INTENT_NOT_APPLICABLE',
        // TODO: i18n
        'The current OneKey ID is linked to the local Keyless wallet and cannot be switched while preserving that wallet.',
      );
    }
    return {
      status: 'ready',
      presentation: { type: 'oneKeyIdOnly' },
      confirmation: { type: 'normal' },
      target: { logoutOneKeyId: true, removeKeyless: false },
    };
  }

  if (!keyless || keyless.walletId !== intent.expectedWalletId) {
    return blocked(
      'INTENT_NOT_APPLICABLE',
      // TODO: i18n
      'The expected local Keyless wallet is not available.',
    );
  }

  if (intent.type === 'switchOAuth') {
    if (intent.nextProvider === keyless.provider) {
      return blocked(
        'INTENT_NOT_APPLICABLE',
        // TODO: i18n
        'The selected OAuth provider is already used by this Keyless wallet.',
      );
    }
    if (linkage === 'unknown' || isKeylessSessionIdentityUnknown) {
      return blocked('STATE_INCONSISTENT', linkageError);
    }
    if (hasOneKeyId && !isLinked) {
      return blocked(
        'INTENT_NOT_APPLICABLE',
        // TODO: i18n
        'Log out of the current OneKey ID before switching OAuth providers.',
      );
    }
    return {
      status: 'ready',
      presentation: {
        type: 'switchOAuthProvider',
        currentProvider: keyless.provider,
        nextProvider: intent.nextProvider,
        effect: isLinked ? 'linkedOneKeyIdAndKeyless' : 'keylessOnly',
      },
      confirmation: { type: 'keylessRemovalAcknowledgement' },
      target: {
        logoutOneKeyId: isLinked,
        removeKeyless: true,
        clearKeylessSession: true,
        switchOAuthProvider: intent.nextProvider,
      },
    };
  }

  if (isLinked) {
    return {
      status: 'ready',
      presentation: {
        type: 'linkedOneKeyIdAndKeyless',
        currentProvider: keyless.provider,
      },
      confirmation: { type: 'keylessRemovalAcknowledgement' },
      target: {
        logoutOneKeyId: true,
        removeKeyless: true,
        clearKeylessSession: true,
      },
    };
  }

  const shouldClearKeylessSession =
    linkage !== 'unknown' && !isKeylessSessionIdentityUnknown;
  return {
    status: 'ready',
    presentation: {
      type: 'keylessOnly',
      currentProvider: keyless.provider,
    },
    confirmation: { type: 'keylessRemovalAcknowledgement' },
    target: {
      logoutOneKeyId: false,
      removeKeyless: true,
      clearKeylessSession: shouldClearKeylessSession,
    },
  };
}
