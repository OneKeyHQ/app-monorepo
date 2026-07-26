import type { IJotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import {
  buildJotaiContextStoreId,
  jotaiContextStore,
} from '@onekeyhq/kit/src/states/jotai/utils/jotaiContextStore';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export type IHomeTokenListMode = 'wallet' | 'urlAccount';
export type IHomeTokenListDemandReason =
  | 'homeVisible'
  | 'send'
  | 'receive'
  | 'assetSelector'
  | 'native'
  | 'externalRead';
export type IHomeTokenListDemandPriority =
  | 'interactive'
  | 'critical'
  | 'background';

export interface IHomeTokenListDemand {
  consumerId: string;
  ownerScopeKey: string;
  priority: IHomeTokenListDemandPriority;
  reason: IHomeTokenListDemandReason;
}

const STORE_RESET_DELAY_MS = 500;

function getStoreData(mode: IHomeTokenListMode) {
  return {
    storeName:
      mode === 'wallet'
        ? EJotaiContextStoreNames.homeTokenList
        : EJotaiContextStoreNames.urlAccountHomeTokenList,
  } as const;
}

class HomeTokenListRuntime {
  private readonly storeReferenceCounts = new Map<IHomeTokenListMode, number>();

  private readonly storeResetTimers = new Map<
    IHomeTokenListMode,
    ReturnType<typeof setTimeout>
  >();

  private readonly demands = new Map<string, IHomeTokenListDemand>();

  private readonly demandListeners = new Set<
    (demands: readonly IHomeTokenListDemand[]) => void
  >();

  getStore(mode: IHomeTokenListMode): IJotaiContextStore {
    return jotaiContextStore.prepareStoreForImmediateUse(getStoreData(mode));
  }

  getStoreId(mode: IHomeTokenListMode): string {
    return buildJotaiContextStoreId(getStoreData(mode));
  }

  retainStore(mode: IHomeTokenListMode): () => void {
    const resetTimer = this.storeResetTimers.get(mode);
    if (resetTimer) {
      clearTimeout(resetTimer);
      this.storeResetTimers.delete(mode);
    }
    this.storeReferenceCounts.set(
      mode,
      (this.storeReferenceCounts.get(mode) ?? 0) + 1,
    );
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      const nextCount = Math.max(
        0,
        (this.storeReferenceCounts.get(mode) ?? 0) - 1,
      );
      if (nextCount > 0) {
        this.storeReferenceCounts.set(mode, nextCount);
        return;
      }
      this.storeReferenceCounts.delete(mode);
      const timer = setTimeout(() => {
        this.storeResetTimers.delete(mode);
        if ((this.storeReferenceCounts.get(mode) ?? 0) === 0) {
          jotaiContextStore.removeStore(getStoreData(mode));
        }
      }, STORE_RESET_DELAY_MS);
      this.storeResetTimers.set(mode, timer);
    };
  }

  acquireDemand(demand: IHomeTokenListDemand): () => void {
    const key = [demand.ownerScopeKey, demand.consumerId, demand.reason].join(
      '|',
    );
    this.demands.set(key, demand);
    this.emitDemands();
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      if (this.demands.get(key) === demand) {
        this.demands.delete(key);
        this.emitDemands();
      }
    };
  }

  subscribeDemands(
    listener: (demands: readonly IHomeTokenListDemand[]) => void,
  ): () => void {
    this.demandListeners.add(listener);
    listener(this.getDemands());
    return () => {
      this.demandListeners.delete(listener);
    };
  }

  getDemands(): readonly IHomeTokenListDemand[] {
    return [...this.demands.values()];
  }

  private emitDemands(): void {
    const demands = this.getDemands();
    this.demandListeners.forEach((listener) => listener(demands));
  }
}

export const homeTokenListRuntime = new HomeTokenListRuntime();
export { getStoreData as getHomeTokenListStoreData };
