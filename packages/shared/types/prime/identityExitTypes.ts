import type { EOAuthSocialLoginProvider } from '../../src/consts/authConsts';

export type IIdentityExitPlanId = string & {
  readonly __identityExitPlanId: 'IIdentityExitPlanId';
};

export type IIdentityExitOAuthHandoff = string & {
  readonly __identityExitOAuthHandoff: 'IIdentityExitOAuthHandoff';
};

export type IKeylessOAuthSessionRollbackHandle = string & {
  readonly __keylessOAuthSessionRollbackHandle: 'IKeylessOAuthSessionRollbackHandle';
};

export type IIdentityExitIntent =
  | {
      type: 'logoutOneKeyId';
      scene: 'profile' | 'referral';
    }
  | {
      type: 'switchOneKeyIdAccount';
      scene: 'keylessOnboarding' | 'legacyOAuthBind';
    }
  | {
      type: 'removeKeyless';
      expectedWalletId: string;
      scene: 'accountSelector' | 'oneKeyIdLogin';
    }
  | {
      type: 'switchOAuth';
      expectedWalletId: string;
      nextProvider: EOAuthSocialLoginProvider;
      scene: 'oneKeyIdLogin';
    }
  | {
      type: 'recoverMalformedKeyless';
      expectedWalletId: string;
      nextProvider: EOAuthSocialLoginProvider;
      scene: 'oneKeyIdLogin' | 'keylessOnboarding';
    };

export type IIdentityExitFlowResult =
  | { status: 'completed' }
  | { status: 'cancelled' }
  | { status: 'blocked'; message: string };

export type IIdentityExitPlan =
  | {
      status: 'blocked';
      code:
        | 'STATE_UNAVAILABLE'
        | 'STATE_INCONSISTENT'
        | 'KEYLESS_DATA_MALFORMED'
        | 'INTENT_NOT_APPLICABLE';
      message: string;
    }
  | {
      status: 'ready';
      planId: IIdentityExitPlanId;
      expiresAt: number;
      presentation:
        | { type: 'oneKeyIdOnly' }
        | {
            type: 'keylessOnly';
            currentProvider: EOAuthSocialLoginProvider;
          }
        | {
            type: 'linkedOneKeyIdAndKeyless';
            currentProvider: EOAuthSocialLoginProvider;
          }
        | {
            type: 'switchOAuthProvider';
            currentProvider: EOAuthSocialLoginProvider;
            nextProvider: EOAuthSocialLoginProvider;
            effect: 'keylessOnly' | 'linkedOneKeyIdAndKeyless';
          }
        | {
            type: 'recoverMalformedKeyless';
            nextProvider: EOAuthSocialLoginProvider;
            oneKeyIdWillBeLoggedOut: boolean;
          };
      confirmation:
        | { type: 'normal' }
        | { type: 'keylessRemovalAcknowledgement' };
    };

export type IExecuteIdentityExitParams = {
  planId: IIdentityExitPlanId;
  acknowledgement?: 'keylessWalletRemoval';
};

export type IStartIndependentOneKeyIdOAuth = {
  provider: EOAuthSocialLoginProvider;
  handoff: IIdentityExitOAuthHandoff;
  expiresAt: number;
};

export type IIdentityExitReceipt =
  | {
      status: 'completed';
      oneKeyIdLoggedOut: boolean;
      removedWalletId?: string;
      startIndependentOneKeyIdOAuth?: IStartIndependentOneKeyIdOAuth;
    }
  | {
      status: 'cancelled';
    }
  | {
      status: 'blocked';
      code: 'STATE_CHANGED';
      message: string;
    };
