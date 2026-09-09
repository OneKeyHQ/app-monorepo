import type { ISwapInvitesResponse } from '@onekeyhq/shared/src/referralCode/type';

export const SWAP_INVITE_DESKTOP_COLUMN_WIDTHS = {
  address: '14%',
  invitedAt: '16%',
  referralCode: '14%',
  firstTrade: '18%',
  volume: '14%',
  fee: '14%',
  rewards: '10%',
} as const;

export function getSwapQuerySignature(query: object): string {
  return JSON.stringify(query);
}

export function appendSwapInvitePage({
  current,
  next,
}: {
  current: ISwapInvitesResponse | undefined;
  next: ISwapInvitesResponse;
}): ISwapInvitesResponse {
  return {
    ...next,
    // IDs are scoped to one server response. Preserve every row verbatim;
    // never deduplicate or interpret these opaque values.
    items: [...(current?.items ?? []), ...next.items],
  };
}

export function getNextSwapCursor({
  requestedCursor,
  responseCursor,
}: {
  requestedCursor: string;
  responseCursor: string | null;
}): string | undefined {
  if (!responseCursor || responseCursor === requestedCursor) {
    return undefined;
  }
  return responseCursor;
}
