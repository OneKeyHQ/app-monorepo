import type { IMarketWidgetLinkTarget } from '@onekeyhq/shared/src/utils/marketWidgetUtils';

export function createMarketWidgetLinkHandler<T>({
  waitForUnlock,
  isReady,
  wait,
  isAllowed,
  resolve,
  navigate,
  onError,
}: {
  waitForUnlock: () => Promise<void>;
  isReady: () => boolean;
  wait: () => Promise<unknown>;
  isAllowed: () => boolean;
  resolve: (target: IMarketWidgetLinkTarget) => Promise<T>;
  navigate: (detail: T) => void;
  onError: () => void;
}) {
  let generation = 0;
  return async (
    target: IMarketWidgetLinkTarget,
    shouldContinue: () => boolean,
  ) => {
    generation += 1;
    const current = generation;
    const active = () =>
      current === generation && shouldContinue() && isAllowed();
    try {
      await waitForUnlock();
      while (active() && !isReady()) {
        await wait();
      }
      if (!active()) return;
      const detail = await resolve(target);
      if (!active()) return;
      // The app may lock again or receive another link during the fetch.
      // Never let an earlier tap navigate after the newer destination.
      await waitForUnlock();
      if (!active()) return;
      navigate(detail);
    } catch {
      if (active()) onError();
    }
  };
}
