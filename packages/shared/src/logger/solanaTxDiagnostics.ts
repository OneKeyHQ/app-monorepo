import { generateUUID } from '../utils/miscUtils';
import { getSolanaDiagnosticElapsed } from '../utils/solanaTxDiagnostics';

import { defaultLogger } from './logger';

import type {
  ISolanaTxDiagnosticContext,
  ISolanaTxDiagnosticDetails,
} from '../../types/solanaTxDiagnostics';

export function createSolanaTxDiagnosticContext():
  | ISolanaTxDiagnosticContext
  | undefined {
  try {
    return { correlationId: generateUUID(), startedAt: Date.now() };
  } catch {
    return undefined;
  }
}

export function logSolanaTxDiagnostic(
  context: ISolanaTxDiagnosticContext | undefined,
  details: ISolanaTxDiagnosticDetails,
) {
  if (!context) return;
  try {
    const now = Date.now();
    defaultLogger.transaction.send.solanaTxDiagnostic({
      ...details,
      correlationId: context.correlationId,
      startedAt: context.startedAt,
      recentBlockhash: context.recentBlockhash,
      lastValidBlockHeight: context.lastValidBlockHeight,
      contextSlot: context.contextSlot,
      commitment: context.commitment,
      blockhashFetchedAt: context.blockhashFetchedAt,
      blockhashFetchAttempts: context.blockhashFetchAttempts,
      blockhashFetchDurationMs: context.blockhashFetchDurationMs,
      timestamp: new Date(now).toISOString(),
      elapsedMs: getSolanaDiagnosticElapsed(context, now),
    });
  } catch {
    // Local diagnostics must never abort or delay a transaction operation.
  }
}
