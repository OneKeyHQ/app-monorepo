import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog } from '@onekeyhq/components';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

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
    defaultLogger.prime.subscription.onekeyIdRemoteLogoutFlow({
      stage: 'targetPresentation',
      status: result.updated ? 'succeeded' : 'skipped',
      flowId: messageId,
      operationId,
      reason: result.updated
        ? 'Remote logout dialog opened and presentation was committed'
        : 'Presentation claim was no longer current',
    });
  } catch (error) {
    defaultLogger.prime.subscription.onekeyIdRemoteLogoutFlow({
      stage: 'targetPresentation',
      status: 'failed',
      flowId: messageId,
      operationId,
      reason: error instanceof Error ? error.message : String(error),
    });
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
  defaultLogger.prime.subscription.onekeyIdRemoteLogoutFlow({
    stage: 'targetPresentation',
    status: 'started',
    flowId: presentation.messageId,
    operationId: presentation.operationId,
  });
  let claim: Awaited<
    ReturnType<
      typeof backgroundApiProxy.serviceIdentityExit.tryClaimRemoteOneKeyIdLogoutPresentation
    >
  >;
  try {
    claim =
      await backgroundApiProxy.serviceIdentityExit.tryClaimRemoteOneKeyIdLogoutPresentation(
        presentation,
      );
  } catch (error) {
    defaultLogger.prime.subscription.onekeyIdRemoteLogoutFlow({
      stage: 'targetPresentation',
      status: 'failed',
      flowId: presentation.messageId,
      operationId: presentation.operationId,
      reason: `Presentation claim failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
    throw error;
  }
  if (claim.status === 'claimedByOther') {
    defaultLogger.prime.subscription.onekeyIdRemoteLogoutFlow({
      stage: 'targetPresentation',
      status: 'deduplicated',
      flowId: presentation.messageId,
      operationId: presentation.operationId,
      reason: 'Presentation is owned by another UI surface',
    });
    schedulePresentationRetry(presentation, claim.retryAfterMs);
    return;
  }
  clearPresentationRetry(presentation.messageId);
  if (claim.status !== 'claimed') {
    defaultLogger.prime.subscription.onekeyIdRemoteLogoutFlow({
      stage: 'targetPresentation',
      status: 'skipped',
      flowId: presentation.messageId,
      operationId: presentation.operationId,
      reason: `Presentation claim status is ${claim.status}`,
    });
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
    defaultLogger.prime.subscription.onekeyIdRemoteLogoutFlow({
      stage: 'targetPresentation',
      status: 'failed',
      flowId: presentation.messageId,
      operationId: presentation.operationId,
      reason: error instanceof Error ? error.message : String(error),
    });
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
