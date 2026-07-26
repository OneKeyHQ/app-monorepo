import type { IHomeStoreEffect } from '../store/homeStoreTypes';

/**
 * Wallet Home runtime architecture:
 *
 * - UI dispatches intents and environment events but never receives or executes
 *   reducer-produced effects.
 * - Reducers and projectors are pure and never perform asynchronous work.
 * - The effect middleware executes reducer-produced effects but owns no
 *   render state or section business state.
 * - The request scheduler owns generic task admission, prioritization,
 *   cancellation, and the Store-scoped commit budget, but contains no section
 *   business logic.
 * - Data sources own section-specific I/O and normalization, but never depend on
 *   React component lifecycle.
 *
 * HomeSessionMachine is a pure sub-reducer and is the only lifecycle decision
 * model. HomeEffectMiddleware is the only executor of reducer-produced effects.
 * Sources publish results only through a request-bound, session-aware result
 * sink. The sink validates authority before expensive main-side materialization
 * and submits accepted publications to the Store-scoped commit budget.
 * Live equality and revision decisions use explicit revisions, structural
 * sharing, and scoped field comparison; they never serialize full payloads.
 *
 * Cancellation reduces wasted work. Owner, session, producer, source, and
 * request-token validation remains the correctness boundary for stale results.
 */

export interface IHomeEffectEnvelope {
  effectId: string;
  eventSequence: number;
  sessionId: string;
  correlationId?: string;
  effect: IHomeStoreEffect;
}

export interface IHomeEffectHandlerContext {
  dispatchCompletion(input: {
    effect: IHomeEffectEnvelope;
    error?: unknown;
    value?: unknown;
  }): void;
}

export type IHomeEffectHandler<
  TKind extends IHomeStoreEffect['kind'] = IHomeStoreEffect['kind'],
> = (
  effect: IHomeEffectEnvelope & {
    effect: Extract<IHomeStoreEffect, { kind: TKind }>;
  },
  context: IHomeEffectHandlerContext,
) => unknown | Promise<unknown>;

export type IHomeEffectHandlerMap = {
  [TKind in IHomeStoreEffect['kind']]?: IHomeEffectHandler<TKind>;
};

export interface IHomeEffectMiddlewareSnapshot {
  disposed: boolean;
  queuedCount: number;
  runningCount: number;
}

export interface IHomeEffectMiddlewareOptions {
  handlers: IHomeEffectHandlerMap;
  dispatchCompletion?: IHomeEffectHandlerContext['dispatchCompletion'];
  onSnapshot?: (snapshot: IHomeEffectMiddlewareSnapshot) => void;
  maxProcessedEffectIds?: number;
}

export class HomeEffectMiddleware {
  private readonly handlers: IHomeEffectHandlerMap;

  private readonly dispatchCompletion:
    | IHomeEffectHandlerContext['dispatchCompletion']
    | undefined;

  private readonly onSnapshot:
    | ((snapshot: IHomeEffectMiddlewareSnapshot) => void)
    | undefined;

  private readonly queue: IHomeEffectEnvelope[] = [];

  private readonly processedEffectIds = new Set<string>();

  private readonly processedEffectIdOrder: string[] = [];

  private readonly maxProcessedEffectIds: number;

  private runningCount = 0;

  private draining = false;

  private disposed = false;

  constructor({
    handlers,
    dispatchCompletion,
    onSnapshot,
    maxProcessedEffectIds = 512,
  }: IHomeEffectMiddlewareOptions) {
    this.handlers = handlers;
    this.dispatchCompletion = dispatchCompletion;
    this.onSnapshot = onSnapshot;
    this.maxProcessedEffectIds = Math.max(1, maxProcessedEffectIds);
  }

  enqueue(effects: readonly IHomeEffectEnvelope[]): boolean {
    if (this.disposed) {
      return false;
    }
    effects.forEach((effect) => {
      if (
        !this.processedEffectIds.has(effect.effectId) &&
        !this.queue.some((candidate) => candidate.effectId === effect.effectId)
      ) {
        this.queue.push(effect);
      }
    });
    this.emitSnapshot();
    this.drain();
    return true;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.queue.length = 0;
    this.processedEffectIds.clear();
    this.processedEffectIdOrder.length = 0;
    this.emitSnapshot();
  }

  getSnapshot(): IHomeEffectMiddlewareSnapshot {
    return {
      disposed: this.disposed,
      queuedCount: this.queue.length,
      runningCount: this.runningCount,
    };
  }

  private drain(): void {
    if (this.draining || this.disposed) {
      return;
    }
    this.draining = true;
    try {
      while (this.queue.length > 0 && !this.disposed) {
        const envelope = this.queue.shift();
        if (envelope && !this.processedEffectIds.has(envelope.effectId)) {
          this.rememberProcessedEffectId(envelope.effectId);
          const handler = this.handlers[envelope.effect.kind] as
            | IHomeEffectHandler
            | undefined;
          if (!handler) {
            this.dispatchCompletion?.({
              effect: envelope,
              error: new Error(
                `No Home effect handler for ${envelope.effect.kind}`,
              ),
            });
          } else {
            this.runningCount += 1;
            this.emitSnapshot();
            try {
              const completion = handler(envelope as never, {
                dispatchCompletion: (input) => this.dispatchCompletion?.(input),
              });
              void Promise.resolve(completion)
                .then((value) => {
                  this.dispatchCompletion?.({ effect: envelope, value });
                })
                .catch((error: unknown) => {
                  this.dispatchCompletion?.({ effect: envelope, error });
                })
                .finally(() => {
                  this.runningCount -= 1;
                  this.emitSnapshot();
                });
            } catch (error) {
              this.runningCount -= 1;
              this.dispatchCompletion?.({ effect: envelope, error });
              this.emitSnapshot();
            }
          }
        }
      }
    } finally {
      this.draining = false;
      this.emitSnapshot();
    }
  }

  private emitSnapshot(): void {
    this.onSnapshot?.(this.getSnapshot());
  }

  private rememberProcessedEffectId(effectId: string): void {
    this.processedEffectIds.add(effectId);
    this.processedEffectIdOrder.push(effectId);
    while (this.processedEffectIdOrder.length > this.maxProcessedEffectIds) {
      const expiredEffectId = this.processedEffectIdOrder.shift();
      if (expiredEffectId) {
        this.processedEffectIds.delete(expiredEffectId);
      }
    }
  }
}
