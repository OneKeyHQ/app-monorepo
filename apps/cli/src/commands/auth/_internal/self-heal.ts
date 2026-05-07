import { AppError, ERROR_CODES } from '../../../errors';

import { executeLogoutPipeline } from './logout-pipeline';

import type { IServiceSelfHealReason } from '../../../infra/vault/service-client';

export type ISelfHealDependencies = {
  logoutPipeline?: () => Promise<void>;
};

function mapReasonToError(reason: IServiceSelfHealReason): AppError {
  switch (reason) {
    case 'KEY_NOT_FOUND':
      return new AppError(
        ERROR_CODES.SERVICE_KEY_NOT_FOUND.code,
        'Remote Bot Wallet key was not found. Please import the Bot Wallet again.',
        'Run auth login with a fresh Bot Wallet CLI payload.',
      );
    case 'REVOKED':
    case 'TOKEN_INVALID':
      return new AppError(
        ERROR_CODES.SESSION_EXPIRED.code,
        'Bot Wallet session has expired. Please import the Bot Wallet again.',
        'Run auth login with a fresh Bot Wallet CLI payload.',
      );
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
}

export async function triggerSelfHeal(
  reason: IServiceSelfHealReason,
  dependencies: ISelfHealDependencies = {},
): Promise<never> {
  const logoutPipeline =
    dependencies.logoutPipeline ?? (() => executeLogoutPipeline());
  await logoutPipeline();
  throw mapReasonToError(reason);
}
