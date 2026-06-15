import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { LOCAL_SECRET_ENVELOPE_INNER_PREFIX } from './consts';
import {
  isLocalSecretEnvelopeString,
  parseLocalSecretEnvelopeV1,
} from './parser';

import type { ILocalSecretEnvelopeInnerPrefix } from './types';

export type IPortableCredentialInput =
  | { credential?: string }
  | string
  | null
  | undefined;

export function assertPortableCredential({
  credential,
  errorMessage = 'This credential type cannot be exported',
}: {
  credential: string;
  errorMessage?: string;
}): void {
  if (
    isLocalSecretEnvelopeString(credential) ||
    (!credential.startsWith(LOCAL_SECRET_ENVELOPE_INNER_PREFIX.hdCredential) &&
      !credential.startsWith(
        LOCAL_SECRET_ENVELOPE_INNER_PREFIX.importedCredential,
      ))
  ) {
    throw new OneKeyLocalError(errorMessage);
  }
}

export function isPortableCredential(credential: string): boolean {
  return (
    !isLocalSecretEnvelopeString(credential) &&
    isPortableInnerPrefix(credential)
  );
}

export function isPortableInnerPrefix(
  value: string | ILocalSecretEnvelopeInnerPrefix | undefined,
): boolean {
  return Boolean(
    value === LOCAL_SECRET_ENVELOPE_INNER_PREFIX.hdCredential ||
    value === LOCAL_SECRET_ENVELOPE_INNER_PREFIX.importedCredential ||
    value?.startsWith(LOCAL_SECRET_ENVELOPE_INNER_PREFIX.hdCredential) ||
    value?.startsWith(LOCAL_SECRET_ENVELOPE_INNER_PREFIX.importedCredential),
  );
}

export function shouldUnwrapCredentialForPortableExport(
  credential: string,
): boolean {
  if (!isLocalSecretEnvelopeString(credential)) {
    return false;
  }
  try {
    const parsed = parseLocalSecretEnvelopeV1(credential);
    return parsed.innerPrefix
      ? isPortableInnerPrefix(parsed.innerPrefix)
      : true;
  } catch {
    return false;
  }
}

export function normalizePortableCredential({
  credential,
}: {
  credential: IPortableCredentialInput;
}): string | undefined {
  const credentialValue =
    typeof credential === 'string' ? credential : credential?.credential;
  if (typeof credentialValue !== 'string') {
    return undefined;
  }
  return isPortableCredential(credentialValue) ? credentialValue : undefined;
}
