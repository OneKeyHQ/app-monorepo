import type { ISwapErrorMessage } from '@onekeyhq/shared/types/swap/types';

import { DustSweepError } from './DustSweepError';

export class DustSweepRetryableError extends DustSweepError {
  constructor(
    message?: string,
    providerErrorMessage?: string,
    localError?: ISwapErrorMessage,
  ) {
    super('unknown', { message, providerErrorMessage, localError });
  }
}
