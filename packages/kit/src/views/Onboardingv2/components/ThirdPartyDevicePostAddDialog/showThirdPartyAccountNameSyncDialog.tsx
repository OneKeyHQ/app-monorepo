import { useCallback, useState } from 'react';

import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IThirdPartyAccountNameCandidate,
  IThirdPartyAccountNameSourceStatus,
  IThirdPartyHardwareRewardVendor,
} from '@onekeyhq/shared/src/referralCode/type';
import { createTimeoutPromise } from '@onekeyhq/shared/src/utils/promiseUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { buildInitialSelection, buildRenames } from './migrationSelection';
import { ThirdPartyAccountNameSyncContent } from './ThirdPartyAccountNameSyncContent';

import type { IAccountNameSyncSelection } from './migrationSelection';

// Mirrors selection back to the closure onConfirm reads.
function AccountNameSyncContentWrapper({
  candidates,
  initialSelection,
  onSelectionChange,
}: {
  candidates: IThirdPartyAccountNameCandidate[];
  initialSelection: IAccountNameSyncSelection;
  onSelectionChange: (selection: IAccountNameSyncSelection) => void;
}) {
  const [selection, setSelection] =
    useState<IAccountNameSyncSelection>(initialSelection);

  const handleSelectionChange = useCallback(
    (next: IAccountNameSyncSelection) => {
      setSelection(next);
      onSelectionChange(next);
    },
    [onSelectionChange],
  );

  return (
    <ThirdPartyAccountNameSyncContent
      candidates={candidates}
      selection={selection}
      onSelectionChange={handleSelectionChange}
    />
  );
}

const NAME_SOURCE_TIMEOUT_MS = 5000;
const NAME_SYNC_TIMEOUT_MS = 5000;
const NAME_DIALOG_TAIL_TIMEOUT_MS = 60_000;

export interface IAccountNameSyncDialogOutcome {
  // False when nothing was offered.
  shown: boolean;
  status: IThirdPartyAccountNameSourceStatus;
  candidateCount: number;
}

// TODO(i18n): replace the product copy with ETranslations entries after copy
// review. Locale enum/generated files must not be edited by hand.
export async function showThirdPartyAccountNameSyncDialog(params: {
  wallet: IDBWallet;
  vendor: IThirdPartyHardwareRewardVendor;
}): Promise<IAccountNameSyncDialogOutcome> {
  const result = await createTimeoutPromise({
    asyncFunc: async () => {
      try {
        return await backgroundApiProxy.serviceThirdPartyHardware.getThirdPartyAccountNameCandidates(
          {
            walletId: params.wallet.id,
            vendor:
              params.vendor === 'ledger'
                ? EHardwareVendor.ledger
                : EHardwareVendor.trezor,
          },
        );
      } catch {
        return {
          status: 'unsupported_source' as const,
          candidates: [],
        };
      }
    },
    timeout: NAME_SOURCE_TIMEOUT_MS,
    timeoutResult: {
      status: 'unsupported_source' as const,
      candidates: [],
    },
  });
  if (result.status !== 'available' || result.candidates.length === 0) {
    return {
      shown: false,
      status: result.status,
      candidateCount: result.candidates.length,
    };
  }

  let selection = buildInitialSelection(result.candidates);

  await new Promise<void>((resolve) => {
    let resolved = false;
    const tailTimerRef: {
      current?: ReturnType<typeof setTimeout>;
    } = {};
    const finish = () => {
      if (resolved) return;
      resolved = true;
      if (tailTimerRef.current) clearTimeout(tailTimerRef.current);
      resolve();
    };
    const dialog = Dialog.show({
      icon: 'EditOutline',
      title: 'Sync account names?',
      onConfirmText: 'Sync names',
      onCancelText: 'Not now',
      renderContent: (
        <AccountNameSyncContentWrapper
          candidates={result.candidates}
          initialSelection={selection}
          onSelectionChange={(next) => {
            selection = next;
          }}
        />
      ),
      onConfirm: async ({ close }) => {
        try {
          const renames = buildRenames({
            candidates: result.candidates,
            selection,
          });
          if (renames.length) {
            await createTimeoutPromise({
              asyncFunc: async () => {
                try {
                  await backgroundApiProxy.serviceThirdPartyHardware.applyThirdPartyAccountNames(
                    {
                      walletId: params.wallet.id,
                      renames,
                    },
                  );
                } catch {
                  // Name sync is optional and must never block wallet entry.
                }
              },
              timeout: NAME_SYNC_TIMEOUT_MS,
              timeoutResult: undefined,
            });
          }
        } finally {
          finish();
          await close?.();
        }
      },
      onCancel: finish,
      onClose: finish,
    });
    tailTimerRef.current = setTimeout(() => {
      finish();
      void dialog?.close();
    }, NAME_DIALOG_TAIL_TIMEOUT_MS);
    if (resolved) clearTimeout(tailTimerRef.current);
  });

  return {
    shown: true,
    status: result.status,
    candidateCount: result.candidates.length,
  };
}
