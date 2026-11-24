import { isPlainObject } from 'lodash';

import type { LocalSecretEnvelopeUnavailable } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import {
  LOCAL_SECRET_ENVELOPE_CREDENTIAL_ERROR_DATA_TYPE,
  LOCAL_SECRET_ENVELOPE_ERROR_DATA_TYPE_FIELD,
  getLocalSecretEnvelopeCredentialKey,
} from '@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData';
import type { ILocalSecretEnvelopeCredentialIssue } from '@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { walletLocalSecretEnvelopeStatusAtom } from '../states/jotai/atoms/walletLocalSecretEnvelopeStatus';

export function markCredentialLocalSecretEnvelopeUnavailableError(
  error: LocalSecretEnvelopeUnavailable,
) {
  error.autoToast = true;
  error.data = {
    ...(isPlainObject(error.data) ? error.data : undefined),
    [LOCAL_SECRET_ENVELOPE_ERROR_DATA_TYPE_FIELD]:
      LOCAL_SECRET_ENVELOPE_CREDENTIAL_ERROR_DATA_TYPE,
  };
}

let sessionId: string | undefined;

export async function hasWalletLocalSecretEnvelopeIssue(credentialId: string) {
  if (!sessionId) {
    return false;
  }
  const key = getLocalSecretEnvelopeCredentialKey(sessionId, credentialId);
  return Boolean((await walletLocalSecretEnvelopeStatusAtom.get()).issues[key]);
}

export function getWalletLocalSecretEnvelopeIssue(
  error: LocalSecretEnvelopeUnavailable,
  credentialId: string,
): ILocalSecretEnvelopeCredentialIssue | undefined {
  const data = error.data as
    | { localSecretEnvelopeFailureReason?: unknown }
    | undefined;
  const reason = data?.localSecretEnvelopeFailureReason;
  if (reason !== 'key-missing' && reason !== 'authentication-failed') {
    return undefined;
  }
  const walletId = accountUtils.getWalletIdFromAccountId({
    accountId: credentialId,
  });
  const imported = accountUtils.isImportedWallet({ walletId });
  if (!imported && !accountUtils.isHdWallet({ walletId })) {
    return undefined;
  }
  sessionId ??= generateUUID();
  return {
    credentialKey: getLocalSecretEnvelopeCredentialKey(sessionId, credentialId),
    reason,
    ...(imported ? { imported: true } : undefined),
  };
}

export function reportWalletLocalSecretEnvelopeFailure(
  error: LocalSecretEnvelopeUnavailable,
  credentialId: string,
) {
  const issue = getWalletLocalSecretEnvelopeIssue(error, credentialId);
  if (!issue) {
    return;
  }
  error.data = {
    ...(isPlainObject(error.data) ? error.data : undefined),
    localSecretEnvelopeIssue: issue,
  };
  void recordWalletLocalSecretEnvelopeIssue(issue).catch(() => undefined);
  errorToastUtils.showLocalSecretEnvelopeRecoveryToastIfNeeded(error);
}

export async function recordWalletLocalSecretEnvelopeIssue(
  issue: ILocalSecretEnvelopeCredentialIssue,
) {
  const issueSessionId = sessionId;
  if (!issueSessionId) {
    return;
  }
  await walletLocalSecretEnvelopeStatusAtom.set((state) => {
    const current = state.issues[issue.credentialKey];
    if (current?.reason === issue.reason) {
      return state;
    }
    return {
      ...state,
      sessionId: issueSessionId,
      issues: { ...state.issues, [issue.credentialKey]: issue },
    };
  });
}

export async function clearWalletLocalSecretEnvelopeIssue(
  credentialId: string,
) {
  if (!sessionId) {
    return;
  }
  const key = getLocalSecretEnvelopeCredentialKey(sessionId, credentialId);
  const state = await walletLocalSecretEnvelopeStatusAtom.get();
  if (!state.issues[key]) {
    return;
  }
  await walletLocalSecretEnvelopeStatusAtom.set((current) => {
    if (current.issues[key] !== state.issues[key]) {
      return current;
    }
    const issues = { ...current.issues };
    delete issues[key];
    return { ...current, issues };
  });
}
