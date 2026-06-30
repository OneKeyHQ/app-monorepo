import { isPlainObject } from 'lodash';

import type { LocalSecretEnvelopeUnavailable } from '@onekeyhq/shared/src/errors';

export function markCredentialLocalSecretEnvelopeUnavailableError(
  error: LocalSecretEnvelopeUnavailable,
) {
  error.autoToast = true;
  error.data = {
    ...(isPlainObject(error.data) ? error.data : undefined),
    localSecretEnvelopeDataType: 'credential',
  };
}
