import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EOneKeyIdAccountStatus,
  EOneKeyIdIdentityType,
  EOneKeyIdOAuthProvider,
  type IOneKeyIdAccount,
  type IOneKeyIdIdentity,
} from '@onekeyhq/shared/types/prime/primeTypes';

import {
  getRedeemLandingAccountAccessibilityLabel,
  getRedeemLandingAccountActionTitle,
  getRedeemLandingAccountLabel,
  getRedeemLandingAccountNickname,
  getRedeemLandingOAuthIdentity,
  getRedeemLandingSuccessAccountLabel,
  shouldShowRedeemLandingMaskedEmail,
} from './primeRedeemLandingAccountDisplay';

import type { IntlShape } from 'react-intl';

const intl = {
  formatMessage: ({ id }: { id: string }) => id,
} as IntlShape;

function buildAccount(identities: IOneKeyIdIdentity[]): IOneKeyIdAccount {
  return {
    identities,
    onekeyUserId: 'user-1',
    status: EOneKeyIdAccountStatus.Active,
  };
}

describe('getRedeemLandingAccountNickname', () => {
  it('returns a trimmed nickname and ignores blanks', () => {
    expect(getRedeemLandingAccountNickname('  Alice  ')).toBe('Alice');
    expect(getRedeemLandingAccountNickname('   ')).toBeUndefined();
    expect(getRedeemLandingAccountNickname(undefined)).toBeUndefined();
  });
});

describe('getRedeemLandingAccountLabel', () => {
  it('prefers nickname over email', () => {
    expect(
      getRedeemLandingAccountLabel({
        displayEmail: 'user@example.com',
        intl,
        nickname: 'Alice',
      }),
    ).toBe('Alice');
  });

  it('falls back to email, then Unknown', () => {
    expect(
      getRedeemLandingAccountLabel({
        displayEmail: 'user@example.com',
        intl,
        nickname: '  ',
      }),
    ).toBe('user@example.com');
    expect(
      getRedeemLandingAccountLabel({
        displayEmail: undefined,
        intl,
        nickname: undefined,
      }),
    ).toBe(ETranslations.global_unknown);
  });
});

describe('getRedeemLandingSuccessAccountLabel', () => {
  it('prefers nickname, then the masked email', () => {
    expect(
      getRedeemLandingSuccessAccountLabel({
        displayEmail: 'user@example.com',
        intl,
        maskedEmail: 'u***@example.com',
        nickname: 'Alice',
      }),
    ).toBe('Alice');
    expect(
      getRedeemLandingSuccessAccountLabel({
        displayEmail: 'user@example.com',
        intl,
        maskedEmail: 'u***@example.com',
        nickname: undefined,
      }),
    ).toBe('u***@example.com');
  });
});

describe('getRedeemLandingOAuthIdentity', () => {
  it('returns Google and Apple in canonical order', () => {
    expect(
      getRedeemLandingOAuthIdentity(
        buildAccount([
          {
            identityType: EOneKeyIdIdentityType.OAuth,
            oauthProvider: EOneKeyIdOAuthProvider.Apple,
          },
          {
            identityType: EOneKeyIdIdentityType.OAuth,
            oauthProvider: EOneKeyIdOAuthProvider.Google,
          },
        ]),
      ),
    ).toEqual({
      oauthProviderNames: ['Google', 'Apple'],
      oauthProviders: [
        EOneKeyIdOAuthProvider.Google,
        EOneKeyIdOAuthProvider.Apple,
      ],
    });
  });

  it('returns an empty list for email-only accounts', () => {
    expect(
      getRedeemLandingOAuthIdentity(
        buildAccount([
          {
            identityType: EOneKeyIdIdentityType.LegacyEmail,
            legacyEmail: 'user@example.com',
          },
        ]),
      ),
    ).toEqual({
      oauthProviderNames: [],
      oauthProviders: [],
    });
  });
});

describe('getRedeemLandingAccountActionTitle', () => {
  it('appends bound providers to the OneKey ID title', () => {
    expect(getRedeemLandingAccountActionTitle([])).toBe('OneKey ID');
    expect(getRedeemLandingAccountActionTitle(['Google'])).toBe(
      'OneKey ID · Google',
    );
    expect(getRedeemLandingAccountActionTitle(['Google', 'Apple'])).toBe(
      'OneKey ID · Google · Apple',
    );
  });
});

describe('getRedeemLandingAccountAccessibilityLabel', () => {
  it('includes providers, nickname, and email when they differ', () => {
    expect(
      getRedeemLandingAccountAccessibilityLabel({
        accountLabel: 'Alice',
        displayEmail: 'user@example.com',
        oauthProviderNames: ['Google'],
      }),
    ).toBe('Google · Alice · user@example.com');
  });

  it('does not repeat the email when it is already the label', () => {
    expect(
      getRedeemLandingAccountAccessibilityLabel({
        accountLabel: 'user@example.com',
        displayEmail: 'user@example.com',
        oauthProviderNames: ['Apple'],
      }),
    ).toBe('Apple · user@example.com');
  });
});

describe('shouldShowRedeemLandingMaskedEmail', () => {
  it('shows the masked email under a nickname, not under the email itself', () => {
    expect(
      shouldShowRedeemLandingMaskedEmail({
        accountLabel: 'Alice',
        maskedEmail: 'u***@example.com',
        nickname: 'Alice',
      }),
    ).toBe(true);
    expect(
      shouldShowRedeemLandingMaskedEmail({
        accountLabel: 'u***@example.com',
        maskedEmail: 'u***@example.com',
        nickname: undefined,
      }),
    ).toBe(false);
  });
});
