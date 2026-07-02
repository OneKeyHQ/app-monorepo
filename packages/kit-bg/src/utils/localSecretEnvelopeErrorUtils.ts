import { isPlainObject } from 'lodash';

import type { LocalSecretEnvelopeUnavailable } from '@onekeyhq/shared/src/errors';
import {
  LOCAL_SECRET_ENVELOPE_CREDENTIAL_ERROR_DATA_TYPE,
  LOCAL_SECRET_ENVELOPE_ERROR_DATA_TYPE_FIELD,
} from '@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData';

export function markCredentialLocalSecretEnvelopeUnavailableError(
  error: LocalSecretEnvelopeUnavailable,
) {
  error.autoToast = true;
  error.data = {
    ...(isPlainObject(error.data) ? error.data : undefined),
    [LOCAL_SECRET_ENVELOPE_ERROR_DATA_TYPE_FIELD]:
      LOCAL_SECRET_ENVELOPE_CREDENTIAL_ERROR_DATA_TYPE,
  };
}
