// What the deposit modal shows in its first frame, kept from the last time it
// was read, or warmed while the pointer is on a home row: the token's offers,
// the form's data and its rows before an amount. The modal opens complete on
// these and its own requests replace them in place. Held in memory only, for
// a couple of minutes
const FRESH_MS = 2 * 60 * 1000;

type IEntry = {
  value?: unknown;
  promise?: Promise<unknown>;
  at: number;
};

const entries = new Map<string, IEntry>();

const isFresh = (entry: IEntry) => Date.now() - entry.at < FRESH_MS;

export function readFirstFrame<T>(
  key: string,
  {
    orOlder = false,
  }: {
    // The rows before an amount are labels and terms: an older answer still
    // opens the form complete, and the form asks again at once
    orOlder?: boolean;
  } = {},
): T | undefined {
  const entry = entries.get(key);
  if (!entry || entry.value === undefined) {
    return undefined;
  }
  if (!orOlder && !isFresh(entry)) {
    return undefined;
  }
  return entry.value as T;
}

export function keepFirstFrame<T>(key: string, value: T | undefined) {
  if (value === undefined) {
    return;
  }
  entries.set(key, { value, at: Date.now() });
}

// One request per key at a time, none while a fresh value is kept
export function warmFirstFrame<T>(
  key: string,
  load: () => Promise<T | undefined>,
): Promise<T | undefined> {
  const entry = entries.get(key);
  if (entry && isFresh(entry)) {
    if (entry.value !== undefined) {
      return Promise.resolve(entry.value as T);
    }
    if (entry.promise) {
      return entry.promise as Promise<T | undefined>;
    }
  }
  const promise = load()
    .then((value) => {
      if (value === undefined) {
        entries.delete(key);
      } else {
        entries.set(key, { value, at: Date.now() });
      }
      return value;
    })
    .catch(() => {
      entries.delete(key);
      return undefined;
    });
  entries.set(key, { promise, at: Date.now() });
  return promise;
}

export const buildOffersFirstFrameKey = ({
  accountId,
  networkId,
  symbol,
}: {
  accountId?: string;
  networkId: string;
  symbol: string;
}) => `offers:${accountId ?? ''}:${networkId}:${symbol.toLowerCase()}`;

export const buildManagePageFirstFrameKey = (requestKey: string) =>
  `manage:${requestKey}`;

// The rows before an amount (and a withdrawal's ways out): labels and the
// protocol's own terms, no figures, so any account's answer will do
export const buildEmptyAmountFirstFrameKey = ({
  action = 'stake',
  networkId,
  providerName,
  symbol,
  vault,
}: {
  action?: 'stake' | 'unstake';
  networkId: string;
  providerName: string;
  symbol: string;
  vault?: string;
}) =>
  `${action}-empty:${networkId}:${providerName.toLowerCase()}:${symbol.toLowerCase()}:${(
    vault ?? ''
  ).toLowerCase()}`;

// A provider's ways out of a position (Instant and Queued) as its last
// withdrawal answer had them: a position of the provider opened before its
// own answer is in holds their place
export const buildWaysOutFirstFrameKey = ({
  networkId,
  providerName,
}: {
  networkId: string;
  providerName: string;
}) => `unstake-ways:${networkId}:${providerName.toLowerCase()}`;

// The word on an offer's deposit button before an amount ("Deposit",
// "Continue"), as its form last showed it
export const buildConfirmWordFirstFrameKey = ({
  networkId,
  providerName,
  symbol,
  vault,
}: {
  networkId: string;
  providerName: string;
  symbol: string;
  vault?: string;
}) =>
  `confirm-word:${networkId}:${providerName.toLowerCase()}:${symbol.toLowerCase()}:${(
    vault ?? ''
  ).toLowerCase()}`;

// The tokens an offer pays its rewards in, from its rates' breakdown: the
// same for every account, so the details page's own read fills it too
export const buildRewardTokensFirstFrameKey = ({
  networkId,
  providerName,
  symbol,
  vault,
}: {
  networkId: string;
  providerName: string;
  symbol: string;
  vault?: string;
}) =>
  `reward-tokens:${networkId}:${providerName.toLowerCase()}:${symbol.toLowerCase()}:${(
    vault ?? ''
  ).toLowerCase()}`;

// A lending market's answer for an empty supply: the same for the market's
// own form and for paying with another token, so either opens with the
// market's rows
export const buildSupplyEmptyFirstFrameKey = ({
  accountId,
  networkId,
  provider,
  marketAddress,
  reserveAddress,
}: {
  accountId: string;
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
}) =>
  `supply-empty:${accountId}:${networkId}:${provider.toLowerCase()}:${marketAddress.toLowerCase()}:${reserveAddress.toLowerCase()}`;
