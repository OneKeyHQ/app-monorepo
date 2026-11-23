import { rootNavigationRef } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { notifyIntercomOpenFailed } from '@onekeyhq/shared/src/modules3rdParty/intercom/openFailure';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { closeExtensionPopupAfterExpandTabOpen } from '@onekeyhq/shared/src/utils/extUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';

import { showIntercom } from '../client';
import { getCurrentIntercomUserId } from '../client/identity';

import { showSupportLogConsentDialog } from './showSupportLogConsentDialog';
import { startSupportLogUpload } from './supportLogJobs';

import type { IntlShape } from 'react-intl';

export type ISupportErrorContext = {
  title: string;
  // The same text the error toast's Copy button copies.
  diagnosticText: string;
  occurredAt: number;
};

type ISupportCompose = {
  logJobId?: string;
  errorContext?: ISupportErrorContext;
};

// Route params carry only this id, so diagnostic text never reaches a URL.
const composes = new Map<string, ISupportCompose>();

export const getSupportCompose = (id?: string) =>
  id ? composes.get(id) : undefined;

export const deleteSupportCompose = (id?: string) => {
  if (id) composes.delete(id);
};

function createSupportCompose(compose: ISupportCompose) {
  const id = generateUUID();
  composes.set(id, compose);
  return id;
}

const startUpload = (
  intl: IntlShape,
  ownerUserId: string | null,
  conversationId?: string,
) =>
  startSupportLogUpload({
    ownerUserId,
    conversationId,
    messageTitle: intl.formatMessage({
      id: ETranslations.support_log_attached__msg,
    }),
  });

type ISupportHandoff = {
  conversationId?: string;
  requestId?: string;
  errorContext?: ISupportErrorContext;
  expiresAt: number;
};

const HANDOFF_KEY = 'onekeySupportLogHandoff';
const HANDOFF_TTL_MS = 2 * 60_000;

// The extension popup and approval window close as soon as they lose focus,
// which would end an upload running in them; the expanded tab stays open.
const shouldHandOffUpload = () =>
  platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiStandaloneWindow;

async function handOffToExpandTab(handoff: Omit<ISupportHandoff, 'expiresAt'>) {
  // Session storage stays inside trusted extension pages and clears with
  // the browser session.
  await globalThis.chrome.storage.session.set({
    [HANDOFF_KEY]: { ...handoff, expiresAt: Date.now() + HANDOFF_TTL_MS },
  });
  await backgroundApiProxy.serviceApp.openExtensionExpandTab({});
  closeExtensionPopupAfterExpandTabOpen();
}

// Asks before a new conversation. Resolves the compose id to open it with,
// or undefined when the dialog was dismissed or the request moved to the
// extension's expanded tab.
export async function prepareNewSupportConversation({
  intl,
  ownerUserId,
  errorContext,
  requestId,
}: {
  intl: IntlShape;
  ownerUserId: string | null;
  errorContext?: ISupportErrorContext;
  requestId?: string;
}) {
  const choice = await showSupportLogConsentDialog({
    variant: errorContext ? 'error' : 'generic',
    intl,
  });
  if (!choice) return undefined;
  if (choice === 'upload' && shouldHandOffUpload()) {
    await handOffToExpandTab({ errorContext, requestId });
    return undefined;
  }
  return createSupportCompose({
    errorContext,
    logJobId: choice === 'upload' ? startUpload(intl, ownerUserId) : undefined,
  });
}

// Adds logs to an open conversation, or to the new one once it is created.
// Resolves the job id when the upload started here.
export async function attachSupportLogs({
  intl,
  ownerUserId,
  conversationId,
}: {
  intl: IntlShape;
  ownerUserId: string | null;
  conversationId?: string;
}) {
  const choice = await showSupportLogConsentDialog({
    variant: 'conversation',
    intl,
  });
  if (choice !== 'upload') return undefined;
  if (shouldHandOffUpload() && conversationId) {
    await handOffToExpandTab({ conversationId });
    return undefined;
  }
  return startUpload(intl, ownerUserId, conversationId);
}

// Error toasts open a new conversation directly, skipping the support home.
export async function contactSupportForError({
  intl,
  requestId,
  errorContext,
}: {
  intl: IntlShape;
  requestId?: string;
  errorContext: ISupportErrorContext;
}) {
  try {
    const composeId = await prepareNewSupportConversation({
      intl,
      ownerUserId: await getCurrentIntercomUserId(),
      errorContext,
      requestId,
    });
    if (composeId) await showIntercom({ requestId, composeId });
  } catch (error) {
    notifyIntercomOpenFailed(error);
  }
}

async function takeSupportHandoff() {
  const storage = globalThis.chrome?.storage?.session;
  if (!storage) return undefined;
  const take = async () => {
    const value = (await storage.get(HANDOFF_KEY))[HANDOFF_KEY] as
      | ISupportHandoff
      | undefined;
    if (!value) return undefined;
    await storage.remove(HANDOFF_KEY);
    return value.expiresAt > Date.now() ? value : undefined;
  };
  // Every open expanded tab sees the change; only one may take it.
  const locks = globalThis.navigator?.locks;
  return locks ? locks.request(HANDOFF_KEY, take) : take();
}

async function resumeSupportHandoff(intl: IntlShape) {
  try {
    // A tab opened just now may not have mounted its navigator yet.
    for (let i = 0; i < 50 && !rootNavigationRef.current?.isReady(); i += 1) {
      await waitAsync(200);
    }
    const handoff = await takeSupportHandoff();
    if (!handoff) return;
    const ownerUserId = await getCurrentIntercomUserId();
    const logJobId = startUpload(intl, ownerUserId, handoff.conversationId);
    if (handoff.conversationId) {
      await showIntercom({ conversationId: handoff.conversationId });
      return;
    }
    await showIntercom({
      requestId: handoff.requestId,
      composeId: createSupportCompose({
        logJobId,
        errorContext: handoff.errorContext,
      }),
    });
  } catch (error) {
    notifyIntercomOpenFailed(error);
  }
}

// Runs in the unlocked expanded tab: takes a request handed off by the
// popup, either on load (a new tab) or when it arrives (a tab already open).
export function listenForSupportHandoff(intl: IntlShape) {
  const onChanged = globalThis.chrome?.storage?.onChanged;
  if (!platformEnv.isExtensionUiExpandTab || !onChanged) return undefined;
  void resumeSupportHandoff(intl);
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => {
    if (areaName === 'session' && changes[HANDOFF_KEY]?.newValue) {
      void resumeSupportHandoff(intl);
    }
  };
  onChanged.addListener(listener);
  return () => onChanged.removeListener(listener);
}
