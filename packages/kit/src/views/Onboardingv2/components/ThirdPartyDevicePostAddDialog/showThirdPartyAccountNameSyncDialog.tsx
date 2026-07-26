import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IThirdPartyHardwareRewardVendor } from '@onekeyhq/shared/src/referralCode/type';
import { createTimeoutPromise } from '@onekeyhq/shared/src/utils/promiseUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

const NAME_SOURCE_TIMEOUT_MS = 5000;
const NAME_SYNC_TIMEOUT_MS = 5000;
const NAME_DIALOG_TAIL_TIMEOUT_MS = 60_000;

// TODO(i18n): replace the product copy with ETranslations entries after copy
// review. Locale enum/generated files must not be edited by hand.
export async function showThirdPartyAccountNameSyncDialog(params: {
  wallet: IDBWallet;
  vendor: IThirdPartyHardwareRewardVendor;
}): Promise<void> {
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
    return;
  }

  const names = result.candidates
    .map((candidate) => `${candidate.currentName} → ${candidate.sourceName}`)
    .join('\n');

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
      description: `We found matching account addresses in Ledger Live:\n${names}`,
      onConfirmText: 'Sync names',
      onCancelText: 'Not now',
      onConfirm: async ({ close }) => {
        try {
          await createTimeoutPromise({
            asyncFunc: async () => {
              try {
                await backgroundApiProxy.serviceThirdPartyHardware.applyThirdPartyAccountNames(
                  {
                    walletId: params.wallet.id,
                    renames: result.candidates.map((candidate) => ({
                      indexedAccountId: candidate.indexedAccountId,
                      name: candidate.sourceName,
                    })),
                  },
                );
              } catch {
                // Name sync is optional and must never block wallet entry.
              }
            },
            timeout: NAME_SYNC_TIMEOUT_MS,
            timeoutResult: undefined,
          });
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
}
