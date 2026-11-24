import type { ISwapInvitesResponse } from '@onekeyhq/shared/src/referralCode/type';

export const SWAP_INVITE_DESKTOP_COLUMN_WIDTHS = {
  address: '10%',
  invitedAt: '13%',
  referralCode: '14%',
  firstTrade: '13%',
  volume: '11%',
  fee: '13%',
  undistributed: '10%',
  rewards: '16%',
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
