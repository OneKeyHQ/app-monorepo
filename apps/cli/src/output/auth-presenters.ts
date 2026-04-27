import { AUTH_LOGIN_METHOD_APP_TRANSFER } from '../core/auth/auth-types';

import type { ResolvedAuthSession } from '../core/auth/auth-types';

type IAuthLogoutOutputStatus =
  | 'logged_out'
  | 'already_logged_out'
  | 'cancelled';
type IAuthLoginInterruptedStatus = 'cancelled' | 'timeout';
type IAuthLoginNextAction = 'retry_app_transfer' | 'return_to_login_menu';

export interface IAuthStatusOutput {
  authStatus: ResolvedAuthSession['authStatus'];
  hasSecrets: boolean;
  storageBackend: ResolvedAuthSession['storageBackend'];
  loginMethod: ResolvedAuthSession['loginMethod'] | null;
  walletKind: ResolvedAuthSession['walletKind'] | null;
  sourceLabel: string | null;
  displayAddress: string | null;
  importedAt: string | null;
  device: { connectId: string; deviceId: string; deviceLabel: string } | null;
  passphraseMode: ResolvedAuthSession['passphraseMode'] | null;
}

export interface IAuthLogoutOutput {
  status: IAuthLogoutOutputStatus;
  authStatus: ResolvedAuthSession['authStatus'];
  changed: boolean;
  sourceLabel: string | null;
  displayAddress: string | null;
}

export interface IAuthLoginOutput {
  auth_status: ResolvedAuthSession['authStatus'];
  login_method: ResolvedAuthSession['loginMethod'] | null;
  source_label: string | null;
  display_address: string | null;
  storage_backend: ResolvedAuthSession['storageBackend'];
}

export interface IInterruptedAuthLoginOutput extends Record<string, unknown> {
  status: IAuthLoginInterruptedStatus;
  auth_status: 'unauthenticated';
  login_method: 'app_transfer';
  source_label: null;
  display_address: null;
  storage_backend: null;
  next_action: IAuthLoginNextAction;
}

export function presentAuthStatus(
  session: ResolvedAuthSession,
): IAuthStatusOutput {
  return {
    authStatus: session.authStatus,
    hasSecrets: session.hasSecrets,
    storageBackend: session.storageBackend,
    loginMethod: session.loginMethod ?? null,
    walletKind: session.walletKind ?? null,
    sourceLabel: session.sourceLabel ?? null,
    displayAddress: session.displayAddress ?? null,
    importedAt: session.importedAt ?? null,
    device: session.device ?? null,
    passphraseMode: session.passphraseMode ?? null,
  };
}

export function presentAuthLoginResult(
  session: ResolvedAuthSession,
): IAuthLoginOutput {
  return {
    auth_status: session.authStatus,
    login_method: session.loginMethod ?? null,
    source_label: session.sourceLabel ?? null,
    display_address: session.displayAddress ?? null,
    storage_backend: session.storageBackend,
  };
}

export function presentInterruptedAuthLoginResult(
  status: IAuthLoginInterruptedStatus,
  nextAction: IAuthLoginNextAction,
): IInterruptedAuthLoginOutput {
  return {
    status,
    auth_status: 'unauthenticated',
    login_method: AUTH_LOGIN_METHOD_APP_TRANSFER,
    source_label: null,
    display_address: null,
    storage_backend: null,
    next_action: nextAction,
  };
}

export function presentAuthLogoutResult(
  status: IAuthLogoutOutputStatus,
  session?: ResolvedAuthSession,
): IAuthLogoutOutput {
  if (status === 'cancelled' && session?.authStatus === 'authenticated') {
    return {
      status,
      authStatus: 'authenticated',
      changed: false,
      sourceLabel: session.sourceLabel ?? null,
      displayAddress: session.displayAddress ?? null,
    };
  }

  return {
    status,
    authStatus: 'unauthenticated',
    changed: status === 'logged_out',
    sourceLabel: null,
    displayAddress: null,
  };
}

export type {
  IAuthLoginInterruptedStatus as AuthLoginInterruptedStatus,
  IAuthLoginNextAction as AuthLoginNextAction,
  IAuthLogoutOutputStatus as AuthLogoutOutputStatus,
};
