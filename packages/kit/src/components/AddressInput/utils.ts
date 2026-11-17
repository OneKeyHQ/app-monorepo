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

// A re-validation (screen focus regained, manual refresh) keeps the previous
// badges on screen; the spinner only replaces them when there is nothing to
// show yet, so returning from a pushed page does not blank the address label.
export function shouldShowAddressQuerySpinner({
  loading,
  result,
}: {
  loading?: boolean;
  result?: IAddressQueryResult;
}): boolean {
  if (!loading) {
    return false;
  }
  if (!result || Object.keys(result).length === 0) {
    return true;
  }
  return result.validStatus === 'unknown';
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
