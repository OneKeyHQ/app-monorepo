import {
  isAllowedBinanceDepositLink,
  isSameBinanceDepositAddress,
  isSameBinanceDepositDestination,
} from '@onekeyhq/shared/src/utils/binanceDepositUtils';
import { EBinanceDepositSessionStatus } from '@onekeyhq/shared/types/binanceDeposit';
import type {
  IBinanceDepositAuthorizedDestination,
  IBinanceDepositFailReason,
  IBinanceDepositLocalSession,
  IBinanceDepositSessionView,
} from '@onekeyhq/shared/types/binanceDeposit';

// Reads the wallet API's view of a deposit session and folds it into the
// local session. Pure: nothing here stores or requests anything.

// The server issues the id as 32 random bytes in lowercase hex. It is checked
// before it is ever put into a request path.
const SESSION_ID_REGEX = /^[0-9a-f]{64}$/;

// The server never moves a session backwards: a view ranked below the stored
// status is a stale response that arrived late.
const STATUS_RANK: Record<IBinanceDepositLocalSession['status'], number> = {
  LOCAL_PENDING_CREATE: 0,
  [EBinanceDepositSessionStatus.CREATING]: 1,
  [EBinanceDepositSessionStatus.INIT]: 2,
  [EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND]: 3,
  [EBinanceDepositSessionStatus.AUTHORIZED]: 4,
  [EBinanceDepositSessionStatus.REJECTED]: 5,
  [EBinanceDepositSessionStatus.EXPIRED]: 5,
  [EBinanceDepositSessionStatus.SECURITY_CONFLICT]: 5,
};

export const PENDING_VIEW_STATUSES: ReadonlySet<EBinanceDepositSessionStatus> =
  new Set([
    EBinanceDepositSessionStatus.CREATING,
    EBinanceDepositSessionStatus.INIT,
    EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND,
  ]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function pickString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function pickTimestamp(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function isSessionStatus(
  value: unknown,
): value is EBinanceDepositSessionStatus {
  return (
    typeof value === 'string' &&
    (Object.values(EBinanceDepositSessionStatus) as string[]).includes(value)
  );
}

function parseDestination(
  data: unknown,
): IBinanceDepositAuthorizedDestination | undefined {
  if (!isRecord(data)) {
    return undefined;
  }
  const networkId = pickString(data.networkId);
  const binanceNetwork = pickString(data.binanceNetwork);
  const cryptoCurrency = pickString(data.cryptoCurrency);
  const address = pickString(data.address);
  const authorizedAt = pickTimestamp(data.authorizedAt);
  if (
    !networkId ||
    !binanceNetwork ||
    !cryptoCurrency ||
    !address ||
    !authorizedAt
  ) {
    return undefined;
  }
  return {
    networkId,
    binanceNetwork,
    cryptoCurrency,
    address,
    authorizedAt,
    contractAddress: pickString(data.contractAddress),
    minAmount:
      typeof data.minAmount === 'number'
        ? String(data.minAmount)
        : pickString(data.minAmount),
    addressTag: pickString(data.addressTag),
  };
}

// The response body is untrusted: only a view with the expected shape, and
// for an existing session the expected id, is accepted.
export function parseSessionView(
  data: unknown,
  expectedSessionId?: string,
): IBinanceDepositSessionView | undefined {
  if (!isRecord(data)) {
    return undefined;
  }
  const { sessionId, status } = data;
  const networkId = pickString(data.networkId);
  const cryptoCurrency = pickString(data.cryptoCurrency);
  if (
    typeof sessionId !== 'string' ||
    !SESSION_ID_REGEX.test(sessionId) ||
    (expectedSessionId !== undefined && sessionId !== expectedSessionId) ||
    !isSessionStatus(status) ||
    !networkId ||
    !cryptoCurrency
  ) {
    return undefined;
  }
  return {
    sessionId,
    status,
    networkId,
    cryptoCurrency,
    contractAddress: pickString(data.contractAddress),
    link: pickString(data.link),
    linkExpireTime: pickTimestamp(data.linkExpireTime),
    bindDeadline: pickTimestamp(data.bindDeadline),
    authorizedDestination: parseDestination(data.authorizedDestination),
  };
}

function isSameAsset(
  session: IBinanceDepositLocalSession,
  item: { networkId: string; cryptoCurrency: string; contractAddress?: string },
): boolean {
  const a = session.contractAddress ?? '';
  const b = item.contractAddress ?? '';
  return (
    item.networkId === session.networkId &&
    item.cryptoCurrency === session.cryptoCurrency &&
    (a && b
      ? isSameBinanceDepositAddress({ networkId: session.networkId, a, b })
      : a === b)
  );
}

// Folds a server view into the local session. A failed session is never
// revived, and anything that does not match the asset of the session, or
// differs from a destination already released, is a conflict.
export function mergeView(
  session: IBinanceDepositLocalSession,
  view: IBinanceDepositSessionView,
): IBinanceDepositLocalSession {
  if (
    session.failReason ||
    STATUS_RANK[view.status] < STATUS_RANK[session.status]
  ) {
    return session;
  }
  const next: IBinanceDepositLocalSession = {
    ...session,
    sessionId: view.sessionId,
    status: view.status,
    createFailed: false,
  };
  const fail = (failReason: IBinanceDepositFailReason) => ({
    ...next,
    destination: undefined,
    failReason,
  });
  if (!isSameAsset(session, view)) {
    return fail('conflict');
  }
  switch (view.status) {
    case EBinanceDepositSessionStatus.INIT:
      if (view.link && !isAllowedBinanceDepositLink(view.link)) {
        return fail('conflict');
      }
      return {
        ...next,
        linkExpireTime: view.linkExpireTime ?? session.linkExpireTime,
      };
    case EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND:
      return {
        ...next,
        bindDeadline: view.bindDeadline ?? session.bindDeadline,
      };
    case EBinanceDepositSessionStatus.AUTHORIZED: {
      const destination = view.authorizedDestination;
      if (
        !destination ||
        !isSameAsset(session, destination) ||
        (session.requiresAddressTag && !destination.addressTag) ||
        (session.destination &&
          !isSameBinanceDepositDestination(session.destination, destination))
      ) {
        return fail('conflict');
      }
      return { ...next, destination };
    }
    case EBinanceDepositSessionStatus.REJECTED:
      return fail('rejected');
    case EBinanceDepositSessionStatus.EXPIRED:
      return fail('expired');
    case EBinanceDepositSessionStatus.SECURITY_CONFLICT:
      return fail('conflict');
    default:
      return next;
  }
}
