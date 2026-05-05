import {
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
} from '@onekeyhq/shared/src/consts/dbConsts';

import { requireAuthenticatedSession } from '../core/auth/auth-gate';
import { AppError, ERROR_CODES } from '../errors';

import { loadSignerBuilders, requireSignerBuilder } from './registry';

import type { ISigner } from './types';

/**
 * Main signer entry point for wallet commands.
 *
 * Calls `requireAuthenticatedSession()` internally so command code no
 * longer needs the two-step "auth then sign" dance. Dispatches by
 * `session.walletKind` (HD / HW).
 */
export async function getSignerByImpl(impl: string): Promise<ISigner> {
  const session = await requireAuthenticatedSession();
  const builders = await loadSignerBuilders(impl);

  if (session.walletKind === WALLET_TYPE_HW) {
    if (!session.device || !session.passphraseMode) {
      throw new AppError(
        ERROR_CODES.AUTH_SESSION_INVALID.code,
        'Hardware session is missing device or passphraseMode metadata.',
        'Run: onekey auth logout and login again with --hardware.',
      );
    }
    const buildHardware = requireSignerBuilder(impl, builders, WALLET_TYPE_HW);
    return buildHardware(session.device, session.passphraseMode);
  }

  const buildHd = requireSignerBuilder(impl, builders, WALLET_TYPE_HD);
  return buildHd();
}
