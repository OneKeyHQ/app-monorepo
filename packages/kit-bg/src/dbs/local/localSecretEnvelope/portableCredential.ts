import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { isLocalSecretEnvelopeString } from './parser';

export type IPortableCredentialInput =
  | { credential?: string }
  | string
  | null
  | undefined;

export function assertPortableCredential({
  credential,
  errorMessage = 'Cannot export raw local secret envelope credential',
}: {
  credential: string;
  errorMessage?: string;
}): void {
  if (isLocalSecretEnvelopeString(credential)) {
    throw new OneKeyLocalError(errorMessage);
  }
}

export function normalizePortableCredential({
  credential,
  errorMessage,
}: {
  credential: IPortableCredentialInput;
  errorMessage?: string;
}): string | undefined {
  const credentialValue =
    typeof credential === 'string' ? credential : credential?.credential;
  if (typeof credentialValue !== 'string') {
    return undefined;
  }
  assertPortableCredential({
    credential: credentialValue,
    errorMessage,
  });
  return credentialValue;
}
