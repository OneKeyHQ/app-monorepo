import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { ERROR_CODES } from '../../../errors';
import { CliAuthManager } from '../_internal/cli-auth-manager';

import type {
  AppTransferLoginResult,
  ResolvedAuthSession,
} from '../../../core/auth/auth-types';

const UNAUTHENTICATED: ResolvedAuthSession = {
  authStatus: 'unauthenticated',
  hasSecrets: false,
  storageBackend: 'macos-keychain',
};

const HARDWARE_AUTHENTICATED: ResolvedAuthSession = {
  authStatus: 'authenticated',
  hasSecrets: true,
  storageBackend: 'macos-keychain',
  loginMethod: 'hardware',
  walletKind: 'hw',
  displayAddress: '0x1111111111111111111111111111111111111111',
  importedAt: '2026-04-30T00:00:00.000Z',
  sourceLabel: 'Hardware: OneKey',
  device: {
    connectId: 'connect-1',
    deviceId: 'device-1',
    deviceLabel: 'OneKey',
  },
  passphraseMode: 'none',
};

const BOT_WALLET_AUTHENTICATED: ResolvedAuthSession = {
  authStatus: 'authenticated',
  hasSecrets: true,
  storageBackend: 'macos-keychain',
  loginMethod: 'app_transfer',
  walletKind: 'hd',
  displayAddress: '0x2222222222222222222222222222222222222222',
  sourceLabel: 'Bot Wallet (deadbeef)',
};

function makeFacade(opts: {
  hardwareStatus: ResolvedAuthSession;
  botWalletStatus: ResolvedAuthSession;
  hardwareClear?: jest.Mock;
  botWalletClear?: jest.Mock;
  hardwarePersist?: jest.Mock;
  startAppTransferLogin?: jest.Mock;
}) {
  const hardware = {
    getStatus: jest.fn(async () => opts.hardwareStatus),
    persistSession: opts.hardwarePersist ?? jest.fn(async () => undefined),
    clearSession: opts.hardwareClear ?? jest.fn(async () => undefined),
  };
  const botWallet = {
    getStatus: jest.fn(async () => opts.botWalletStatus),
    startAppTransferLogin:
      opts.startAppTransferLogin ??
      jest.fn(async () => ({}) as AppTransferLoginResult),
    clearSession: opts.botWalletClear ?? jest.fn(async () => undefined),
  };
  const facade = new CliAuthManager({ hardware, botWallet });
  return { facade, hardware, botWallet };
}

describe('CliAuthManager.getStatus', () => {
  it('returns the hardware session when only hardware is authenticated', async () => {
    const { facade } = makeFacade({
      hardwareStatus: HARDWARE_AUTHENTICATED,
      botWalletStatus: UNAUTHENTICATED,
    });

    await expect(facade.getStatus()).resolves.toEqual(HARDWARE_AUTHENTICATED);
  });

  it('returns the bot wallet session when only bot wallet is authenticated', async () => {
    const { facade } = makeFacade({
      hardwareStatus: UNAUTHENTICATED,
      botWalletStatus: BOT_WALLET_AUTHENTICATED,
    });

    await expect(facade.getStatus()).resolves.toEqual(BOT_WALLET_AUTHENTICATED);
  });

  it('returns unauthenticated when neither backend has a session', async () => {
    const { facade } = makeFacade({
      hardwareStatus: UNAUTHENTICATED,
      botWalletStatus: UNAUTHENTICATED,
    });

    await expect(facade.getStatus()).resolves.toMatchObject({
      authStatus: 'unauthenticated',
    });
  });

  it('throws AUTH_SESSION_INVALID when both backends report authenticated', async () => {
    // Login guards prevent this; if it's observed, both halves must be torn
    // down before the user can keep going. Returning either silently would
    // mask the bug that produced the conflicting state.
    const { facade } = makeFacade({
      hardwareStatus: HARDWARE_AUTHENTICATED,
      botWalletStatus: BOT_WALLET_AUTHENTICATED,
    });

    await expect(facade.getStatus()).rejects.toMatchObject({
      code: ERROR_CODES.AUTH_SESSION_INVALID.code,
    });
  });
});

describe('CliAuthManager.startAppTransferLogin', () => {
  it('blocks when a hardware session is already active', async () => {
    // Without this facade-level guard, --app-transfer would start pairing
    // alongside an existing hardware session and produce the conflicting
    // state getStatus() throws on.
    const startAppTransferLogin = jest.fn();
    const { facade } = makeFacade({
      hardwareStatus: HARDWARE_AUTHENTICATED,
      botWalletStatus: UNAUTHENTICATED,
      startAppTransferLogin,
    });

    await expect(facade.startAppTransferLogin()).rejects.toMatchObject({
      code: ERROR_CODES.AUTH_WALLET_EXISTS.code,
    });
    expect(startAppTransferLogin).not.toHaveBeenCalled();
  });

  it('delegates to BotWalletAuthManager when no session exists', async () => {
    const result = {} as AppTransferLoginResult;
    const startAppTransferLogin = jest.fn(async () => result);
    const { facade } = makeFacade({
      hardwareStatus: UNAUTHENTICATED,
      botWalletStatus: UNAUTHENTICATED,
      startAppTransferLogin,
    });

    await expect(
      facade.startAppTransferLogin({ endpointEnv: 'test' }),
    ).resolves.toBe(result);
    expect(startAppTransferLogin).toHaveBeenCalledWith({ endpointEnv: 'test' });
  });
});

describe('CliAuthManager.persistHardwareSession', () => {
  it('forwards to HardwareAuthManager.persistSession', async () => {
    const persistSession = jest.fn(async () => undefined);
    const { facade } = makeFacade({
      hardwareStatus: UNAUTHENTICATED,
      botWalletStatus: UNAUTHENTICATED,
      hardwarePersist: persistSession,
    });

    const input = {
      session: {
        schemaVersion: 1,
        loginMethod: 'hardware' as const,
        walletKind: 'hw' as const,
        displayAddress: '0xabc',
        importedAt: '2026-04-30T00:00:00.000Z',
        sourceLabel: 'Hardware: OneKey',
        device: {
          connectId: 'connect-1',
          deviceId: 'device-1',
          deviceLabel: 'OneKey',
        },
        passphraseMode: 'none' as const,
      },
    };

    await facade.persistHardwareSession(input);
    expect(persistSession).toHaveBeenCalledWith(input);
  });
});

describe('CliAuthManager.clearSession', () => {
  it('clears both backends on the happy path', async () => {
    const hardwareClear = jest.fn(async () => undefined);
    const botWalletClear = jest.fn(async () => undefined);
    const { facade } = makeFacade({
      hardwareStatus: HARDWARE_AUTHENTICATED,
      botWalletStatus: UNAUTHENTICATED,
      hardwareClear,
      botWalletClear,
    });

    await facade.clearSession();

    expect(hardwareClear).toHaveBeenCalledTimes(1);
    expect(botWalletClear).toHaveBeenCalledTimes(1);
  });

  it('still attempts the bot wallet clear when the hardware clear fails', async () => {
    // The original split-brain bug came from one half persisting while the
    // other half was already cleared. Mirror that risk on logout by ALWAYS
    // running both clears, even when one throws.
    const hardwareClear = jest.fn(async () => {
      throw new OneKeyLocalError('hardware clear failed');
    });
    const botWalletClear = jest.fn(async () => undefined);
    const { facade } = makeFacade({
      hardwareStatus: HARDWARE_AUTHENTICATED,
      botWalletStatus: BOT_WALLET_AUTHENTICATED,
      hardwareClear,
      botWalletClear,
    });

    await expect(facade.clearSession()).rejects.toThrow(
      'hardware clear failed',
    );
    expect(botWalletClear).toHaveBeenCalledTimes(1);
  });

  it('aggregates errors when both clears fail', async () => {
    const hardwareClear = jest.fn(async () => {
      throw new OneKeyLocalError('hardware clear failed');
    });
    const botWalletClear = jest.fn(async () => {
      throw new OneKeyLocalError('bot wallet clear failed');
    });
    const { facade } = makeFacade({
      hardwareStatus: HARDWARE_AUTHENTICATED,
      botWalletStatus: BOT_WALLET_AUTHENTICATED,
      hardwareClear,
      botWalletClear,
    });

    await expect(facade.clearSession()).rejects.toMatchObject({
      code: ERROR_CODES.AUTH_SESSION_PERSIST_FAILED.code,
      details: {
        errors: ['hardware clear failed', 'bot wallet clear failed'],
      },
    });
    expect(hardwareClear).toHaveBeenCalledTimes(1);
    expect(botWalletClear).toHaveBeenCalledTimes(1);
  });
});

describe('CliAuthManager auth-gate regression', () => {
  // Direct regression for the original split-brain bug: hardware login
  // succeeded but `auth status` (and any gate-driven command) reported
  // unauthenticated because the bot wallet manager only saw the vault.
  // The CliAuthManager facade must surface the hardware session to the
  // gate so `transfer` / `balance` no longer throw AUTH_NO_WALLET.
  it('resolves a hardware-only session through getStatus so the gate accepts it', async () => {
    const { facade } = makeFacade({
      hardwareStatus: HARDWARE_AUTHENTICATED,
      botWalletStatus: UNAUTHENTICATED,
    });

    const session = await facade.getStatus();
    expect(session.authStatus).toBe('authenticated');
    expect(session.loginMethod).toBe('hardware');
  });
});
