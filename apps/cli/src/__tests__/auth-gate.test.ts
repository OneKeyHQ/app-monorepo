import { CliAuthManager } from '../commands/auth/_internal/cli-auth-manager';
import {
  DEFAULT_AUTH_LOGIN_SUGGESTION,
  requireAuthenticatedSession,
} from '../core/auth/auth-gate';
import { ERROR_CODES } from '../errors';

import type { ResolvedAuthSession } from '../core/auth/auth-types';

const AUTHENTICATED_SESSION: ResolvedAuthSession = {
  authStatus: 'authenticated',
  hasSecrets: true,
  storageBackend: 'macos-keychain',
  loginMethod: 'app_transfer',
  walletKind: 'hd',
  sourceLabel: 'Bot Wallet (abcd1234)',
  displayAddress: '0x1234567890abcdef1234567890abcdef12345678',
  importedAt: '2026-04-06T06:00:00.000Z',
};

describe('requireAuthenticatedSession', () => {
  it('returns the resolved session when an active wallet exists', async () => {
    const authManager = {
      getStatus: jest.fn(async () => AUTHENTICATED_SESSION),
    };

    await expect(requireAuthenticatedSession({ authManager })).resolves.toEqual(
      AUTHENTICATED_SESSION,
    );
  });

  it('throws an actionable auth error when no wallet is active', async () => {
    const unauthenticatedSession: ResolvedAuthSession = {
      authStatus: 'unauthenticated',
      hasSecrets: false,
      storageBackend: 'macos-keychain',
    };
    const authManager = {
      getStatus: jest.fn(async () => unauthenticatedSession),
    };

    await expect(
      requireAuthenticatedSession({ authManager }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.AUTH_NO_WALLET.code,
      suggestion: DEFAULT_AUTH_LOGIN_SUGGESTION,
    });
  });

  // Regression guard: the gate's default authManager must be the
  // CliAuthManager facade so it recognizes BOTH vault-backed (bot wallet)
  // and session.json-backed (hardware) sessions. Picking either backend
  // alone reintroduces the split-brain bug where `auth status` and
  // downstream commands (`transfer`, `balance`) disagree.
  it('defaults to CliAuthManager so both bot wallet and hardware sessions are recognized', async () => {
    const spy = jest
      .spyOn(CliAuthManager.prototype, 'getStatus')
      .mockResolvedValueOnce(AUTHENTICATED_SESSION);

    try {
      const session = await requireAuthenticatedSession();
      expect(session).toEqual(AUTHENTICATED_SESSION);
      expect(spy.mock.instances[0]).toBeInstanceOf(CliAuthManager);
    } finally {
      spy.mockRestore();
    }
  });
});
