import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';

// Shared memo/tag field validator for chains with `withMemo` vault settings.
// Covers the two call sites (SendDataInput and AddressBook create/edit) so a
// fix applied once (regex, async behavior, i18n message) stays consistent.
//
// Chain coverage (driven by vault settings, not hardcoded here):
//   - numericOnlyMemo:       XRP (destination tag, digits only)
//   - supportMemoValidation: XRP (uint32 range), Stellar (UTF-8 byte length)
//   - neither flag set:      Cosmos / TON — only the form-layer `maxLength`
//                            rule applies, this hook is a no-op
//
// Ordering is deliberate:
//   1. Empty string short-circuits (memo fields are optional).
//   2. Synchronous regex runs first. For `numericOnlyMemo` chains this lets
//      non-digit input fail instantly without kicking off an async bridge
//      call, which is what caused the Next-button flicker on mobile in
//      OK-52883 before it was untangled from `form.formState.isValidating`.
//   3. Vault `validateMemo` is only consulted when it's explicitly enabled
//      by the chain AND the sync check above has already passed, so the
//      async path is the narrowest it can be. Errors from the async path
//      are swallowed (return undefined) rather than blocking submit — the
//      vault is a "best-effort" cross-check, not the primary gate.
export type IValidateMemoFieldResult =
  | string
  | undefined
  | Promise<string | undefined>;

export function useValidateMemoField({
  networkId,
  accountId,
  numericOnlyMemo,
  supportMemoValidation,
}: {
  networkId: string;
  accountId?: string;
  numericOnlyMemo?: boolean;
  supportMemoValidation?: boolean;
}): (value: string) => IValidateMemoFieldResult {
  const intl = useIntl();

  return useCallback(
    (value: string): IValidateMemoFieldResult => {
      if (!value) return undefined;

      if (numericOnlyMemo && !/^[0-9]+$/.test(value)) {
        return intl.formatMessage({
          id: ETranslations.send_field_only_integer,
        });
      }

      if (supportMemoValidation) {
        return backgroundApiProxy.serviceSend
          .validateMemo({ networkId, accountId, memo: value })
          .then((result) => (result.isValid ? undefined : result.errorMessage))
          .catch(() => undefined);
      }

      return undefined;
    },
    [accountId, intl, networkId, numericOnlyMemo, supportMemoValidation],
  );
}
