import type {
  IHomeRuntimeJsonValue,
  IHomeRuntimeRequestToken,
  IHomeRuntimeResponseEnvelope,
  IHomeRuntimeSourceKey,
} from '@onekeyhq/shared/src/types/homeRuntime';

import type { HomeStaleTrace } from './homeStaleTrace';
import type { IHomeRuntimeAdapter } from '../runtime/homeRuntimeAdapter';

export type IScopedResourceState<T extends IHomeRuntimeJsonValue> =
  | { status: 'idle'; requestSeq: 0 }
  | { status: 'loading'; requestSeq: number }
  | {
      status: 'partial';
      requestSeq: number;
      data: T;
      coverageFingerprint: string;
    }
  | {
      status: 'success';
      requestSeq: number;
      data: T;
      coverageFingerprint: string;
    }
  | {
      status: 'empty';
      requestSeq: number;
      coverageFingerprint: string;
    }
  | {
      status: 'error';
      requestSeq: number;
      errorKind:
        | 'source'
        | 'transport'
        | 'schemaMismatch'
        | 'runtimeUnavailable';
    }
  | { status: 'stopped'; requestSeq: number };

export class ScopedResourceMachine<T extends IHomeRuntimeJsonValue> {
  private requestSeq = 0;

  private producerInstanceId: string;

  private state: IScopedResourceState<T> = {
    status: 'idle',
    requestSeq: 0,
  };

  constructor({
    adapter,
    producerInstanceId,
    sessionId,
    sourceKey,
    staleTrace,
  }: {
    adapter: IHomeRuntimeAdapter;
    producerInstanceId: string;
    sessionId: string;
    sourceKey: IHomeRuntimeSourceKey;
    staleTrace: HomeStaleTrace;
  }) {
    this.adapter = adapter;
    this.producerInstanceId = producerInstanceId;
    this.sessionId = sessionId;
    this.sourceKey = sourceKey;
    this.staleTrace = staleTrace;
  }

  private readonly adapter: IHomeRuntimeAdapter;

  private readonly sessionId: string;

  private readonly sourceKey: IHomeRuntimeSourceKey;

  private readonly staleTrace: HomeStaleTrace;

  beginRequest(): IHomeRuntimeRequestToken {
    this.requestSeq += 1;
    this.state = { status: 'loading', requestSeq: this.requestSeq };
    return this.adapter.createRequestToken({
      producerInstanceId: this.producerInstanceId,
      sessionId: this.sessionId,
      sourceKey: this.sourceKey,
      requestSeq: this.requestSeq,
    });
  }

  acceptResponse(envelope: unknown): boolean {
    const validation = this.adapter.validateResponse(envelope, {
      producerInstanceId: this.producerInstanceId,
      sessionId: this.sessionId,
      sourceKey: this.sourceKey,
      requestSeq: this.requestSeq,
    });
    if (!validation.accepted) {
      this.staleTrace.record({
        reason: validation.reason,
        requestSeq: this.requestSeq,
        sessionId: this.sessionId,
        sourceKey: this.sourceKey,
      });
      return false;
    }

    const response = envelope as IHomeRuntimeResponseEnvelope<T>;
    const { result } = response;
    if (result.kind === 'partial' || result.kind === 'success') {
      this.state = {
        status: result.kind,
        requestSeq: this.requestSeq,
        data: result.data,
        coverageFingerprint: result.coverageFingerprint,
      };
    } else if (result.kind === 'empty') {
      this.state = {
        status: 'empty',
        requestSeq: this.requestSeq,
        coverageFingerprint: result.coverageFingerprint,
      };
    } else {
      this.state = {
        status: 'error',
        requestSeq: this.requestSeq,
        errorKind: result.errorKind,
      };
    }
    return true;
  }

  updateProducerAuthority(producerInstanceId: string): void {
    this.producerInstanceId = producerInstanceId;
    if (this.state.status !== 'stopped') {
      this.state = { status: 'idle', requestSeq: 0 };
      this.requestSeq = 0;
    }
  }

  stop(): void {
    this.state = { status: 'stopped', requestSeq: this.requestSeq };
  }

  getState(): IScopedResourceState<T> {
    return this.state;
  }
}
