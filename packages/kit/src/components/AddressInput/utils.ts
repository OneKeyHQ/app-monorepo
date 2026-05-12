import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IAddressValidateStatus,
  IQueryCheckAddressArgs,
} from '@onekeyhq/shared/types/address';

import type { IAddressQueryResult } from '.';

export function getAddressValidateTranslationId(
  status?: Exclude<IAddressValidateStatus, 'valid'>,
) {
  if (!status) {
    return undefined;
  }

  const message: Record<
    Exclude<IAddressValidateStatus, 'valid'>,
    ETranslations
  > = {
    unknown: ETranslations.send_check_request_error,
    'prohibit-send-to-self': ETranslations.send_cannot_send_to_self,
    invalid: ETranslations.send_address_invalid,
    'address-not-allowlist': ETranslations.send_address_not_allowlist_error,
  };

  return message[status];
}

export function getAddressQueryResolvedAddress(
  result: Pick<
    IAddressQueryResult,
    'input' | 'resolveAddress' | 'validAddress'
  >,
) {
  return result.resolveAddress ?? result.validAddress ?? result.input?.trim();
}

export async function queryAddressWithFallback(
  params: IQueryCheckAddressArgs,
): Promise<IAddressQueryResult> {
  try {
    return await backgroundApiProxy.serviceAccountProfile.queryAddress(params);
  } catch {
    return {
      input: params.address,
      validStatus: 'unknown',
    };
  }
}
