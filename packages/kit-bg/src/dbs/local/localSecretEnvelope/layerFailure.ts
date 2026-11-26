import { LocalSecretEnvelopeUnavailable } from '@onekeyhq/shared/src/errors';
import type { ILocalSecretEnvelopeFailureReason } from '@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData';

import type { ILocalSecretEnvelopeLayerKind } from './types';

export function localSecretEnvelopeLayerFailure({
  kind,
  reason,
}: {
  kind: ILocalSecretEnvelopeLayerKind;
  reason: ILocalSecretEnvelopeFailureReason;
}) {
  return new LocalSecretEnvelopeUnavailable({
    message: `Local secret envelope ${reason === 'key-missing' ? 'wrapping key unavailable' : 'layer decrypt failed'}: kind=${kind}`,
    data: { localSecretEnvelopeFailureReason: reason },
  });
}
