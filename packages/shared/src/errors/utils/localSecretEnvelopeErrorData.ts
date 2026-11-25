import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

import { EOneKeyErrorClassNames } from '../types/errorTypes';

import type { IOneKeyError } from '../types/errorTypes';

export const LOCAL_SECRET_ENVELOPE_ERROR_DATA_TYPE_FIELD =
  'localSecretEnvelopeDataType' as const;

export const LOCAL_SECRET_ENVELOPE_CREDENTIAL_ERROR_DATA_TYPE =
  'credential' as const;

export type ILocalSecretEnvelopeFailureReason =
  | 'key-missing'
  | 'authentication-failed';

export type ILocalSecretEnvelopeCredentialIssue = {
  credentialKey: string;
  reason: ILocalSecretEnvelopeFailureReason;
  imported?: true;
};

export type ILocalSecretEnvelopeCredentialErrorData = {
  [LOCAL_SECRET_ENVELOPE_ERROR_DATA_TYPE_FIELD]: typeof LOCAL_SECRET_ENVELOPE_CREDENTIAL_ERROR_DATA_TYPE;
  localSecretEnvelopeIssue?: ILocalSecretEnvelopeCredentialIssue;
};
export function getLocalSecretEnvelopeCredentialKey(
  sessionId: string,
  credentialId: string,
) {
  return bytesToHex(sha256(utf8ToBytes(`${sessionId}:${credentialId}`)));
}

export function getLocalSecretEnvelopeCredentialIssue(error: unknown) {
  const err = error as IOneKeyError | undefined;
  if (
    err?.className !== EOneKeyErrorClassNames.LocalSecretEnvelopeUnavailable &&
    err?.name !== EOneKeyErrorClassNames.LocalSecretEnvelopeUnavailable
  ) {
    return undefined;
  }
  return (err.data as ILocalSecretEnvelopeCredentialErrorData | undefined)
    ?.localSecretEnvelopeIssue;
}
