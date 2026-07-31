import { isEqual } from 'lodash';

import type { ITradeRouteViewState } from '../atoms';

let orderBookOptionsWriteQueue = Promise.resolve();

export type ISubscriptionRecoveryProofSource =
  | 'route-focused'
  | 'token-selector'
  | 'notification-navigation';

export interface ISubscriptionRecoveryProof {
  disabledCount: number;
  source: ISubscriptionRecoveryProofSource;
}

interface ICaptureSubscriptionRecoveryProofParams {
  source: ISubscriptionRecoveryProofSource;
  isSourceLive: () => boolean;
  isAppVisible: () => boolean;
  isAppLocked: () => Promise<boolean>;
  readDisabledCount: () => Promise<number>;
}

export async function captureSubscriptionRecoveryProof(
  params: ICaptureSubscriptionRecoveryProofParams,
): Promise<ISubscriptionRecoveryProof | undefined> {
  try {
    if (
      !params.isSourceLive() ||
      !params.isAppVisible() ||
      (await params.isAppLocked())
    ) {
      return undefined;
    }

    const disabledCount = await params.readDisabledCount();
    if (
      !params.isSourceLive() ||
      !params.isAppVisible() ||
      (await params.isAppLocked())
    ) {
      return undefined;
    }

    return {
      disabledCount,
      source: params.source,
    };
  } catch {
    return undefined;
  }
}

export function shouldSyncSubscriptionsAfterInstrumentChange(params: {
  viewState: ITradeRouteViewState;
  recoveryProof?: ISubscriptionRecoveryProof;
}): boolean {
  return Boolean(
    params.recoveryProof ||
    params.viewState.routeFocused ||
    params.viewState.tokenSelectorOpen ||
    params.viewState.favoritesBarSpotActive,
  );
}

export function publishLatestOrderBookOptions<T>(params: {
  read: () => Promise<T | undefined>;
  write: (value: T) => Promise<void>;
  next: T;
  isLatest: () => boolean;
}): Promise<boolean> {
  const publish = orderBookOptionsWriteQueue.then(async () => {
    if (!params.isLatest()) {
      return false;
    }
    const previous = await params.read();
    if (!params.isLatest()) {
      return false;
    }

    if (!isEqual(previous, params.next)) {
      await params.write(params.next);
    }

    return params.isLatest();
  });
  orderBookOptionsWriteQueue = publish.then(
    () => undefined,
    () => undefined,
  );
  return publish;
}
