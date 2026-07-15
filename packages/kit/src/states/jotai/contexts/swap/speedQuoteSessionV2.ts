import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type {
  ICancelFetchSpeedSwapQuoteV2Params,
  IFetchSpeedSwapQuoteV2Result,
  ISwapSpeedQuoteSessionIdentity,
} from '@onekeyhq/shared/types/swap/types';

export type ISwapSpeedQuoteSessionState = {
  surfaceId?: string;
  intentRevision: number;
  activeSession?: ISwapSpeedQuoteSessionIdentity;
};

export const SWAP_SPEED_QUOTE_SESSION_V2_INITIAL_STATE: ISwapSpeedQuoteSessionState =
  {
    intentRevision: 0,
  };

function isSameIdentity(
  left: ISwapSpeedQuoteSessionIdentity | undefined,
  right: ISwapSpeedQuoteSessionIdentity,
) {
  return (
    left?.surfaceId === right.surfaceId &&
    left.requestId === right.requestId &&
    left.intentRevision === right.intentRevision
  );
}

export function prepareSwapSpeedQuoteSession(
  state: ISwapSpeedQuoteSessionState,
): ISwapSpeedQuoteSessionState {
  const surfaceId =
    state.surfaceId ??
    `${appEventBus.nodeId}:speedSwap:${generateUUID({ removeDashes: true })}`;
  const intentRevision = state.intentRevision + 1;
  return {
    surfaceId,
    intentRevision,
    activeSession: {
      surfaceId,
      requestId: generateUUID(),
      intentRevision,
    },
  };
}

export function invalidateSwapSpeedQuoteSession(
  state: ISwapSpeedQuoteSessionState,
): ISwapSpeedQuoteSessionState {
  return {
    ...state,
    intentRevision: state.intentRevision + 1,
    activeSession: undefined,
  };
}

export function settleSwapSpeedQuoteSession({
  session,
  state,
}: {
  session: ISwapSpeedQuoteSessionIdentity;
  state: ISwapSpeedQuoteSessionState;
}): ISwapSpeedQuoteSessionState {
  if (!isSameIdentity(state.activeSession, session)) {
    return state;
  }
  return {
    ...state,
    activeSession: undefined,
  };
}

export function isCurrentSwapSpeedQuoteResult({
  result,
  state,
}: {
  result: IFetchSpeedSwapQuoteV2Result;
  state: ISwapSpeedQuoteSessionState;
}) {
  return isSameIdentity(state.activeSession, result.session);
}

export function buildSwapSpeedQuoteCancelParams(
  session: ISwapSpeedQuoteSessionIdentity,
): ICancelFetchSpeedSwapQuoteV2Params {
  return {
    surfaceId: session.surfaceId,
    requestId: session.requestId,
  };
}
