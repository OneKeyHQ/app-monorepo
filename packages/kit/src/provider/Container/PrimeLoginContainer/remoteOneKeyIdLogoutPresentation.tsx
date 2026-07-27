import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog } from '@onekeyhq/components';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { PrimeDeviceLogoutAlertDialog } from '../../../views/Prime/components/PrimeDeviceLogoutAlertDialog';

type IRemoteOneKeyIdLogoutPresentation = {
  operationId: string;
  messageId: string;
};

const PRESENTATION_RETRY_BUFFER_MS = 50;
const presentationRetryTimers = new Map<
  string,
  ReturnType<typeof setTimeout>
>();

function clearPresentationRetry(messageId: string): void {
  const retryTimer = presentationRetryTimers.get(messageId);
  if (retryTimer) {
    clearTimeout(retryTimer);
    presentationRetryTimers.delete(messageId);
  }
}

function schedulePresentationRetry(
  presentation: IRemoteOneKeyIdLogoutPresentation,
  retryAfterMs: number,
): void {
  if (presentationRetryTimers.has(presentation.messageId)) {
    return;
  }
  const retryTimer = setTimeout(
    () => {
      presentationRetryTimers.delete(presentation.messageId);
      presentRemoteOneKeyIdLogoutBestEffort(presentation);
    },
    Math.max(0, retryAfterMs) + PRESENTATION_RETRY_BUFFER_MS,
  );
  (
    retryTimer as unknown as {
      unref?: () => void;
    }
  ).unref?.();
  presentationRetryTimers.set(presentation.messageId, retryTimer);
}

async function completeOpenedPresentation({
  operationId,
  messageId,
  claimId,
  leaseExpiresAt,
  getDialogInstance,
}: IRemoteOneKeyIdLogoutPresentation & {
  claimId: string;
  leaseExpiresAt: number;
  getDialogInstance: () => IDialogInstance | undefined;
}): Promise<void> {
  try {
    const result =
      await backgroundApiProxy.serviceIdentityExit.completeRemoteOneKeyIdLogoutPresentation(
        {
          operationId,
          messageId,
          claimId,
        },
      );
    if (!result.updated) {
      await getDialogInstance()?.close();
    }
  } catch (error) {
    errorUtils.autoPrintErrorIgnore(error);
    try {
      await getDialogInstance()?.close();
    } catch (closeError) {
      errorUtils.autoPrintErrorIgnore(closeError);
    }
    schedulePresentationRetry(
      { operationId, messageId },
      leaseExpiresAt - Date.now(),
    );
  }
}

export async function presentRemoteOneKeyIdLogout(
  presentation: IRemoteOneKeyIdLogoutPresentation,
): Promise<void> {
  const claim =
    await backgroundApiProxy.serviceIdentityExit.tryClaimRemoteOneKeyIdLogoutPresentation(
      presentation,
    );
  if (claim.status === 'claimedByOther') {
    schedulePresentationRetry(presentation, claim.retryAfterMs);
    return;
  }
  clearPresentationRetry(presentation.messageId);
  if (claim.status !== 'claimed') {
    return;
  }

  let dialogInstance: IDialogInstance | undefined;
  try {
    dialogInstance = Dialog.show({
      renderContent: <PrimeDeviceLogoutAlertDialog />,
      onOpen: () => {
        void completeOpenedPresentation({
          ...presentation,
          claimId: claim.claimId,
          leaseExpiresAt: claim.expiresAt,
          getDialogInstance: () => dialogInstance,
        });
      },
    });
  } catch (error) {
    schedulePresentationRetry(presentation, claim.expiresAt - Date.now());
    throw error;
  }
}

export function presentRemoteOneKeyIdLogoutBestEffort(
  presentation: IRemoteOneKeyIdLogoutPresentation,
): void {
  void presentRemoteOneKeyIdLogout(presentation).catch((error) => {
    errorUtils.autoPrintErrorIgnore(error);
  });
}

export function resetRemoteOneKeyIdLogoutPresentationForTest(): void {
  presentationRetryTimers.forEach((retryTimer) => {
    clearTimeout(retryTimer);
  });
  presentationRetryTimers.clear();
}
