import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

// Diagnostic-only scene for tracing the Cardano(ADA) software-wallet
// address-creation flow on native dual-thread runtime (Android keeps loading
// while iOS / hardware wallet work). All methods log to the persisted local
// file logger so the trace survives on disk for QA log collection.
//
// `phase` convention:
//   - 'start'  : right before a potentially-blocking step
//   - 'done'   : right after it returned
//   - 'error'  : the step threw
export class AdaDebugScene extends BaseScene {
  @LogToLocal()
  public step({
    tag,
    phase,
    info,
  }: {
    tag: string;
    phase: 'start' | 'done' | 'error';
    info?: string;
  }) {
    return { tag, phase, info: info ?? '' };
  }
}
