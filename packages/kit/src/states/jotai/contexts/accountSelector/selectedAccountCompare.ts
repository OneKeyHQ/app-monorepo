import { isEqual, isUndefined, omitBy } from 'lodash';

import type {
  IAccountSelectorSelectedAccount,
  IAccountSelectorSelectedAccountsMap,
} from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';

// Selections cross the UI <-> background boundary as JSON on extension, and JSON
// drops keys whose value is undefined. The in-memory defaultSelectedAccount()
// carries six explicit undefined keys, so a bare isEqual() between a value that
// came back from background and an in-memory one always reports a difference
// there while reporting equality on desktop/web. Every comparison that mixes the
// two sources must go through these helpers so the verdict is platform
// independent.
export function isSameSelectedAccount(
  first: IAccountSelectorSelectedAccount | undefined,
  second: IAccountSelectorSelectedAccount | undefined,
) {
  return isEqual(omitBy(first, isUndefined), omitBy(second, isUndefined));
}

// The only selection fields an active account is built from. focusedWallet is
// deliberately absent: it drives which wallet the selector panel highlights and
// never changes the resolved account, so it must not invalidate a reload.
//
// Three places must agree on this list: this staleness check, the reload
// scheduling deps in AccountSelectorEffects, and the fields
// buildActiveAccountInfoFromSelectedAccount reads in the background. The
// `satisfies` clause rejects entries that are not selection fields (and rejects
// focusedWallet); exhaustiveness against future selection fields is enforced by
// the key-set test in selectedAccountCompare.test.ts.
export const ACTIVE_ACCOUNT_RELOAD_SELECTION_FIELDS = [
  'walletId',
  'indexedAccountId',
  'othersWalletAccountId',
  'networkId',
  'deriveType',
] as const satisfies readonly Exclude<
  keyof IAccountSelectorSelectedAccount,
  'focusedWallet'
>[];

// Reload staleness must be judged on exactly the fields that schedule a reload.
// A wider comparison drops the in-flight reload for a change nothing will
// re-schedule, leaving the active account pinned to the previous selection.
export function isSameActiveAccountRelevantSelection(
  first: IAccountSelectorSelectedAccount | undefined,
  second: IAccountSelectorSelectedAccount | undefined,
) {
  return ACTIVE_ACCOUNT_RELOAD_SELECTION_FIELDS.every(
    (field) => first?.[field] === second?.[field],
  );
}

function collectDefinedSelectedAccounts(
  selectedAccountsMap: IAccountSelectorSelectedAccountsMap | undefined,
) {
  const result: Record<string, IAccountSelectorSelectedAccount> = {};
  Object.entries(selectedAccountsMap ?? {}).forEach(
    ([numKey, selectedAccount]) => {
      // An undefined slot and a missing slot are the same map after a JSON hop.
      if (!isUndefined(selectedAccount)) {
        result[numKey] = selectedAccount;
      }
    },
  );
  return result;
}

export function isSameSelectedAccountsMap(
  first: IAccountSelectorSelectedAccountsMap | undefined,
  second: IAccountSelectorSelectedAccountsMap | undefined,
) {
  const firstMap = collectDefinedSelectedAccounts(first);
  const secondMap = collectDefinedSelectedAccounts(second);
  const firstNumKeys = Object.keys(firstMap);
  if (firstNumKeys.length !== Object.keys(secondMap).length) {
    return false;
  }
  return firstNumKeys.every(
    (numKey) =>
      Object.prototype.hasOwnProperty.call(secondMap, numKey) &&
      isSameSelectedAccount(firstMap[numKey], secondMap[numKey]),
  );
}
