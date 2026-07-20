import BigNumber from 'bignumber.js';

import type { IHomeBalanceQuoteBasis } from '../facts/homeFacts';

const HOME_CONFIRMED_BALANCE_CACHE_LIMIT = 8;

type IHomeConfirmedBalanceCacheIdentity = {
  ownerScopeKey: string;
  quoteBasis: IHomeBalanceQuoteBasis;
  sourceKeyIdentity: string;
};

type IHomeConfirmedBalanceRecord = IHomeConfirmedBalanceCacheIdentity & {
  amount: string;
  confirmedAt: number;
  coverageFingerprint: string;
  quality: 'confirmed';
};

type IHomeConfirmedBalanceCacheState = {
  entries: readonly IHomeConfirmedBalanceRecord[];
};

type IHomeConfirmedBalanceCacheCommand =
  | { kind: 'clear' }
  | { kind: 'commit'; record: IHomeConfirmedBalanceRecord }
  | { kind: 'touch'; identity: IHomeConfirmedBalanceCacheIdentity };

const initialHomeConfirmedBalanceCacheState: IHomeConfirmedBalanceCacheState = {
  entries: [],
};

function identitiesMatch(
  left: IHomeConfirmedBalanceCacheIdentity,
  right: IHomeConfirmedBalanceCacheIdentity,
): boolean {
  return (
    left.ownerScopeKey === right.ownerScopeKey &&
    left.sourceKeyIdentity === right.sourceKeyIdentity &&
    left.quoteBasis.currency === right.quoteBasis.currency &&
    left.quoteBasis.pricingRevision === right.quoteBasis.pricingRevision
  );
}

function isValidRecord(record: IHomeConfirmedBalanceRecord): boolean {
  const amount = new BigNumber(record.amount);
  return (
    record.quality === 'confirmed' &&
    record.ownerScopeKey.length > 0 &&
    record.sourceKeyIdentity.length > 0 &&
    record.quoteBasis.currency.length > 0 &&
    record.quoteBasis.pricingRevision.length > 0 &&
    record.coverageFingerprint.length > 0 &&
    Number.isSafeInteger(record.confirmedAt) &&
    record.confirmedAt >= 0 &&
    amount.isFinite()
  );
}

function getHomeConfirmedBalance(
  state: IHomeConfirmedBalanceCacheState,
  identity: IHomeConfirmedBalanceCacheIdentity,
): IHomeConfirmedBalanceRecord | undefined {
  return state.entries.find((entry) => identitiesMatch(entry, identity));
}

function reduceHomeConfirmedBalanceCache(
  state: IHomeConfirmedBalanceCacheState,
  command: IHomeConfirmedBalanceCacheCommand,
): IHomeConfirmedBalanceCacheState {
  if (command.kind === 'clear') {
    return initialHomeConfirmedBalanceCacheState;
  }

  const identity =
    command.kind === 'commit' ? command.record : command.identity;
  const existing = state.entries.find((entry) =>
    identitiesMatch(entry, identity),
  );
  if (command.kind === 'touch') {
    if (!existing || state.entries.at(-1) === existing) {
      return state;
    }
    return {
      entries: state.entries
        .filter((entry) => entry !== existing)
        .concat(existing),
    };
  }
  if (!isValidRecord(command.record)) {
    return state;
  }
  if (
    existing?.amount === command.record.amount &&
    existing.coverageFingerprint === command.record.coverageFingerprint &&
    existing.confirmedAt === command.record.confirmedAt
  ) {
    return state;
  }
  return {
    entries: state.entries
      .filter((entry) => !identitiesMatch(entry, command.record))
      .concat(command.record)
      .slice(-HOME_CONFIRMED_BALANCE_CACHE_LIMIT),
  };
}

export {
  HOME_CONFIRMED_BALANCE_CACHE_LIMIT,
  getHomeConfirmedBalance,
  initialHomeConfirmedBalanceCacheState,
  reduceHomeConfirmedBalanceCache,
};
export type {
  IHomeConfirmedBalanceCacheCommand,
  IHomeConfirmedBalanceCacheIdentity,
  IHomeConfirmedBalanceCacheState,
  IHomeConfirmedBalanceRecord,
};
