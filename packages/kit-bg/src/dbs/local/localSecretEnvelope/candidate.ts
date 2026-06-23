import { shouldUpgradeSecretEncryptPayload } from '@onekeyhq/core/src/secret';
import { DEFAULT_VERIFY_STRING } from '@onekeyhq/shared/src/consts/dbConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import {
  LOCAL_SECRET_ENVELOPE_INNER_PREFIX,
  getLocalSecretEnvelopeInnerPrefix,
} from './consts';
import { isLocalSecretEnvelopeString, stripLocalSecretPrefix } from './parser';

import type {
  ILocalSecretEnvelopeDataType,
  ILocalSecretEnvelopeInnerPrefix,
} from './types';

export type ILocalSecretEnvelopeCandidateRejectReason =
  | 'already_lse'
  | 'default_verify_string'
  | 'empty_record_id'
  | 'needs_kdf_upgrade'
  | 'unsupported_prefix'
  | 'unsupported_record_id';

export type ILocalSecretEnvelopeCandidateResult =
  | {
      canMigrate: true;
      dataType: ILocalSecretEnvelopeDataType;
      innerPrefix: ILocalSecretEnvelopeInnerPrefix;
      recordId: string;
    }
  | {
      canMigrate: false;
      reason: ILocalSecretEnvelopeCandidateRejectReason;
    };

function isCredentialRecordIdSupported({
  recordId,
  innerPrefix,
}: {
  recordId: string;
  innerPrefix: ILocalSecretEnvelopeInnerPrefix;
}): boolean {
  if (innerPrefix === LOCAL_SECRET_ENVELOPE_INNER_PREFIX.hdCredential) {
    return (
      accountUtils.isHdWallet({ walletId: recordId }) ||
      accountUtils.isTonMnemonicCredentialId(recordId)
    );
  }

  if (innerPrefix === LOCAL_SECRET_ENVELOPE_INNER_PREFIX.importedCredential) {
    return accountUtils.isImportedAccount({ accountId: recordId });
  }

  return false;
}

function isCurrentKdfPayload(rawValue: string): boolean {
  return !shouldUpgradeSecretEncryptPayload({
    data: stripLocalSecretPrefix(rawValue),
  });
}

export function classifyLocalSecretEnvelopeMigrationCandidate({
  dataType,
  recordId,
  rawValue,
}: {
  dataType: ILocalSecretEnvelopeDataType;
  recordId: string;
  rawValue: string;
}): ILocalSecretEnvelopeCandidateResult {
  if (!recordId) {
    return { canMigrate: false, reason: 'empty_record_id' };
  }

  if (isLocalSecretEnvelopeString(rawValue)) {
    return { canMigrate: false, reason: 'already_lse' };
  }

  if (dataType === 'verify-string' && rawValue === DEFAULT_VERIFY_STRING) {
    return { canMigrate: false, reason: 'default_verify_string' };
  }

  const innerPrefix = getLocalSecretEnvelopeInnerPrefix(rawValue);
  if (!innerPrefix) {
    return { canMigrate: false, reason: 'unsupported_prefix' };
  }

  if (
    dataType === 'verify-string' &&
    innerPrefix !== LOCAL_SECRET_ENVELOPE_INNER_PREFIX.verifyString
  ) {
    return { canMigrate: false, reason: 'unsupported_prefix' };
  }

  if (
    dataType === 'credential' &&
    !isCredentialRecordIdSupported({ recordId, innerPrefix })
  ) {
    return { canMigrate: false, reason: 'unsupported_record_id' };
  }

  if (!isCurrentKdfPayload(rawValue)) {
    return { canMigrate: false, reason: 'needs_kdf_upgrade' };
  }

  return {
    canMigrate: true,
    dataType,
    recordId,
    innerPrefix,
  };
}
