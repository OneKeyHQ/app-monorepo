import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class BootstrapScene extends BaseScene {
  @LogToLocal()
  public initCriticalStart() {
    return {};
  }

  @LogToLocal()
  public initCriticalStep(step: string, durationMs: number) {
    return { step, durationMs };
  }

  @LogToLocal()
  public initCriticalDone(durationMs: number) {
    return { durationMs };
  }

  @LogToLocal()
  public initDeferredStep(step: string, durationMs: number) {
    return { step, durationMs };
  }

  @LogToLocal()
  public initDeferredStepFailed(step: string, durationMs: number) {
    return { step, durationMs };
  }

  @LogToLocal()
  public initDeferredBatchDone(durationMs: number) {
    return { durationMs };
  }

  @LogToLocal()
  public initDeferredDone(durationMs: number) {
    return { durationMs };
  }
}
