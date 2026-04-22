import {
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
} from '@onekeyhq/shared/src/consts/dbConsts';

import { AppError, ERROR_CODES } from '../errors';

import { requireSignerBuilder, resolveSignerRegistration } from './registry';

import type { ISigner } from './types';
import type { ResolvedAuthSession } from '../core/auth/auth-types';

/**
 * Single entry point for building a chain signer.
 *
 * Name describes the input shape — "by impl" — not the return type.
 * The `session` field is an optional enrichment that selects the wallet
 * kind; omitting it returns the HD software signer, which is the only
 * kind that makes sense pre-session (hardware login has its own flow
 * in `hardware-login-command.ts` and never calls this function without
 * a session).
 *
 * Dispatch:
 *   - `session.walletKind === WALLET_TYPE_HW` → hardware builder
 *     (requires `session.device` + `session.passphraseMode`)
 *   - `session` absent or `walletKind === WALLET_TYPE_HD` → HD builder
 *
 * Call sites:
 *   - Wallet commands (balance / transfer / swap* / wallet-history):
 *       getSignerByImpl({ impl, session })
 *   - `AuthManager.persistHdWalletSession` — the one bootstrap path that
 *     derives the first address before the session lands on disk:
 *       getSignerByImpl({ impl })
 */
export async function getSignerByImpl(options: {
  impl: string;
  session?: ResolvedAuthSession;
}): Promise<ISigner> {
  const { impl, session } = options;
  const registration = await resolveSignerRegistration(impl);

  if (session?.walletKind === WALLET_TYPE_HW) {
    if (!session.device || !session.passphraseMode) {
      throw new AppError(
        ERROR_CODES.AUTH_SESSION_INVALID.code,
        'Hardware session is missing device or passphraseMode metadata.',
        'Run: onekey auth logout and login again with --hardware.',
      );
    }
    const buildHardware = requireSignerBuilder(registration, WALLET_TYPE_HW);
    return buildHardware(session.device, session.passphraseMode);
  }

  const buildHd = requireSignerBuilder(registration, WALLET_TYPE_HD);
  return buildHd();
}
