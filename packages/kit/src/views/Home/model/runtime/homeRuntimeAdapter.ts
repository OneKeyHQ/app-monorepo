import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IHomeRuntimeHandshake,
  IHomeRuntimeJsonValue,
  IHomeRuntimeRequestToken,
  IHomeRuntimeResponseEnvelope,
  IHomeRuntimeSourceKey,
  IHomeRuntimeTopology,
} from '@onekeyhq/shared/src/types/homeRuntime';
import {
  isHomeRuntimeHandshake,
  isHomeRuntimeResponseEnvelope,
} from '@onekeyhq/shared/src/types/homeRuntime';

import { areHomeSourceKeysEqual } from '../core/homeIdentity';

export type IHomeRuntimeRejectReason =
  | 'malformedEnvelope'
  | 'clientMismatch'
  | 'producerMismatch'
  | 'sessionMismatch'
  | 'sourceMismatch';

export type IHomeRuntimeValidationResult =
  | { accepted: true }
  | { accepted: false; reason: IHomeRuntimeRejectReason };

export interface IHomeRuntimeExpectedAuthority {
  producerInstanceId: string;
  sessionId: string;
  sourceKey: IHomeRuntimeSourceKey;
}

export interface IHomeRuntimeAdapter {
  readonly topology: IHomeRuntimeTopology;
  readonly clientInstanceId: string;
  connect(): Promise<IHomeRuntimeHandshake>;
  refreshHandshake(): Promise<IHomeRuntimeHandshake>;
  createRequestToken(
    expected: IHomeRuntimeExpectedAuthority,
  ): IHomeRuntimeRequestToken;
  validateResponse(
    envelope: unknown,
    expected: IHomeRuntimeExpectedAuthority,
  ): IHomeRuntimeValidationResult;
}

export abstract class HomeRuntimeAdapterBase implements IHomeRuntimeAdapter {
  abstract readonly topology: IHomeRuntimeTopology;

  constructor(public readonly clientInstanceId: string) {}

  abstract connect(): Promise<IHomeRuntimeHandshake>;

  abstract refreshHandshake(): Promise<IHomeRuntimeHandshake>;

  createRequestToken(
    expected: IHomeRuntimeExpectedAuthority,
  ): IHomeRuntimeRequestToken {
    return {
      clientInstanceId: this.clientInstanceId,
      producerInstanceId: expected.producerInstanceId,
      sessionId: expected.sessionId,
      sourceKey: expected.sourceKey,
    };
  }

  validateResponse(
    envelope: unknown,
    expected: IHomeRuntimeExpectedAuthority,
  ): IHomeRuntimeValidationResult {
    if (!isHomeRuntimeResponseEnvelope(envelope)) {
      return { accepted: false, reason: 'malformedEnvelope' };
    }
    const { token } = envelope;
    if (token.clientInstanceId !== this.clientInstanceId) {
      return { accepted: false, reason: 'clientMismatch' };
    }
    if (token.producerInstanceId !== expected.producerInstanceId) {
      return { accepted: false, reason: 'producerMismatch' };
    }
    if (token.sessionId !== expected.sessionId) {
      return { accepted: false, reason: 'sessionMismatch' };
    }
    if (!areHomeSourceKeysEqual(token.sourceKey, expected.sourceKey)) {
      return { accepted: false, reason: 'sourceMismatch' };
    }
    return { accepted: true };
  }
}

export function assertHomeRuntimeHandshake(
  value: unknown,
): IHomeRuntimeHandshake {
  if (!isHomeRuntimeHandshake(value)) {
    throw new OneKeyLocalError('Invalid Home runtime handshake');
  }
  return value;
}

export function createHomeRuntimeEnvelope<T extends IHomeRuntimeJsonValue>(
  token: IHomeRuntimeRequestToken,
  result: IHomeRuntimeResponseEnvelope<T>['result'],
): IHomeRuntimeResponseEnvelope<T> {
  return { token, result };
}
