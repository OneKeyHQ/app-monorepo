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
  HOME_RUNTIME_PROTOCOL_VERSION,
  isHomeRuntimeHandshake,
  isHomeRuntimeResponseEnvelope,
} from '@onekeyhq/shared/src/types/homeRuntime';

import { areHomeSourceKeysEqual } from '../core/homeIdentity';

export type IHomeRuntimeRejectReason =
  | 'malformedEnvelope'
  | 'protocolMismatch'
  | 'clientMismatch'
  | 'producerMismatch'
  | 'sessionMismatch'
  | 'sourceMismatch'
  | 'requestSequenceMismatch';

export type IHomeRuntimeValidationResult =
  | { accepted: true }
  | { accepted: false; reason: IHomeRuntimeRejectReason };

export interface IHomeRuntimeExpectedAuthority {
  producerInstanceId: string;
  sessionId: string;
  sourceKey: IHomeRuntimeSourceKey;
  requestSeq: number;
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
      protocolVersion: HOME_RUNTIME_PROTOCOL_VERSION,
      clientInstanceId: this.clientInstanceId,
      producerInstanceId: expected.producerInstanceId,
      sessionId: expected.sessionId,
      sourceKey: expected.sourceKey,
      requestSeq: expected.requestSeq,
    };
  }

  validateResponse(
    envelope: unknown,
    expected: IHomeRuntimeExpectedAuthority,
  ): IHomeRuntimeValidationResult {
    if (
      typeof envelope === 'object' &&
      envelope !== null &&
      'token' in envelope &&
      typeof envelope.token === 'object' &&
      envelope.token !== null &&
      'protocolVersion' in envelope.token &&
      envelope.token.protocolVersion !== HOME_RUNTIME_PROTOCOL_VERSION
    ) {
      return { accepted: false, reason: 'protocolMismatch' };
    }
    if (!isHomeRuntimeResponseEnvelope(envelope)) {
      return { accepted: false, reason: 'malformedEnvelope' };
    }
    const { token } = envelope;
    if (token.protocolVersion !== HOME_RUNTIME_PROTOCOL_VERSION) {
      return { accepted: false, reason: 'protocolMismatch' };
    }
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
    if (token.requestSeq !== expected.requestSeq) {
      return { accepted: false, reason: 'requestSequenceMismatch' };
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
