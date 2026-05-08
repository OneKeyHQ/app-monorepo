import type { IWalletReferralCode } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityReferralCode';
import type {
  IBatchCheckWalletV2Item,
  ICheckWalletBindStatusResponse,
} from '@onekeyhq/shared/src/referralCode/type';

type IReferralBindState = Pick<IWalletReferralCode, 'isBound' | 'bindable'>;

type IReferralBindStateWithReason = IReferralBindState & {
  bindWindowReason?: string;
};

type IReferralWalletRecord = Pick<
  IWalletReferralCode,
  'walletId' | 'isBound' | 'bindable' | 'bindWindowReason'
>;

type IReferralServerBindStatus = Pick<
  ICheckWalletBindStatusResponse,
  'data' | 'reason'
> & {
  bindable?: boolean;
};

export function canBindReferralCode(
  status: IReferralBindState | null | undefined,
): boolean {
  return Boolean(status && !status.isBound && status.bindable !== false);
}

export function shouldShowReferralBindEntry(
  referralCodeInfo: IReferralWalletRecord | null | undefined,
): boolean {
  return Boolean(
    referralCodeInfo?.walletId && canBindReferralCode(referralCodeInfo),
  );
}

export function shouldRevalidateReferralBindStatusCache(
  referralCodeInfo: IReferralWalletRecord | null | undefined,
): boolean {
  return Boolean(
    referralCodeInfo?.walletId &&
    !referralCodeInfo.isBound &&
    referralCodeInfo.bindable !== false,
  );
}

export function resolveWalletBindStatusAfterCheck({
  serverStatus,
  cachedReferralCodeInfo,
  isTimeout,
  skipIfTimeout,
}: {
  serverStatus?: IReferralServerBindStatus;
  cachedReferralCodeInfo?: IReferralWalletRecord | null;
  isTimeout: boolean;
  skipIfTimeout: boolean;
}) {
  if (isTimeout && skipIfTimeout) {
    return {
      source: 'timeout' as const,
      shouldPersist: false,
      shouldSkip: true,
      shouldShowBindDialog: false,
      status: {
        isBound: false,
        bindable: true,
        bindWindowReason: undefined,
      },
    };
  }

  let status: IReferralBindStateWithReason;
  let source: 'server' | 'cache' | 'default';
  let shouldPersist = false;

  if (serverStatus) {
    status = {
      isBound: serverStatus.data,
      bindable: serverStatus.bindable ?? !serverStatus.data,
      bindWindowReason: serverStatus.reason,
    };
    source = 'server';
    shouldPersist = true;
  } else if (cachedReferralCodeInfo) {
    status = {
      isBound: cachedReferralCodeInfo.isBound,
      bindable:
        cachedReferralCodeInfo.bindable ?? !cachedReferralCodeInfo.isBound,
      bindWindowReason: cachedReferralCodeInfo.bindWindowReason,
    };
    source = 'cache';
  } else {
    status = {
      isBound: false,
      bindable: true,
      bindWindowReason: undefined,
    };
    source = 'default';
  }

  const shouldTrustStatus =
    source !== 'cache' ||
    !shouldRevalidateReferralBindStatusCache(cachedReferralCodeInfo);

  return {
    source,
    shouldPersist,
    shouldSkip: false,
    shouldShowBindDialog: shouldTrustStatus && canBindReferralCode(status),
    status,
  };
}

export function resolveBatchWalletBindStatus({
  batchStatus,
  isV1Fallback,
  cachedBindable,
}: {
  batchStatus?: IBatchCheckWalletV2Item;
  isV1Fallback: boolean;
  cachedBindable?: boolean;
}) {
  const isBound = batchStatus?.bound ?? false;

  if (isV1Fallback) {
    return {
      isBound,
      bindable: cachedBindable ?? !isBound,
      bindWindowReason: undefined,
    };
  }

  return {
    isBound,
    bindable: batchStatus?.bindable ?? !isBound,
    bindWindowReason: batchStatus?.reason,
  };
}
