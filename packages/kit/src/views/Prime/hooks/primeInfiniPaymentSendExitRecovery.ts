/* cspell:ignore Infini */
import type { IPrimeInfiniPaymentPhase } from './primeInfiniPaymentUtils';

type IPrimeInfiniPaymentSendExitRecoveryParams = {
  immediatePhase: IPrimeInfiniPaymentPhase;
  fallbackPhase: IPrimeInfiniPaymentPhase;
  resolveDidBroadcastStart: () => Promise<boolean>;
  shouldApply: () => boolean;
  onImmediate: (phase: IPrimeInfiniPaymentPhase) => void;
  onSettled: (result: {
    didBroadcastStart: boolean;
    phase: IPrimeInfiniPaymentPhase;
  }) => void;
  onRejected: (phase: IPrimeInfiniPaymentPhase) => void;
};

export async function startPrimeInfiniPaymentSendExitRecovery({
  immediatePhase,
  fallbackPhase,
  resolveDidBroadcastStart,
  shouldApply,
  onImmediate,
  onSettled,
  onRejected,
}: IPrimeInfiniPaymentSendExitRecoveryParams) {
  onImmediate(immediatePhase);
  try {
    const didBroadcastStart = await resolveDidBroadcastStart();
    if (!shouldApply()) {
      return;
    }
    onSettled({
      didBroadcastStart,
      phase: didBroadcastStart ? 'polling' : fallbackPhase,
    });
  } catch {
    if (shouldApply()) {
      onRejected('polling');
    }
  }
}
