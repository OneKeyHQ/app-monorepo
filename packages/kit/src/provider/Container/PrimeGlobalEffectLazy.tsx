import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';

type IPrimeLoginInvalidTokenPayload =
  IAppEventBusPayload[EAppEventBusNames.PrimeLoginInvalidToken];
type IPrimeSubscriptionPurchaseSuccessPayload =
  IAppEventBusPayload[EAppEventBusNames.PrimeSubscriptionPurchaseSuccess];

const PRIME_GLOBAL_EFFECT_DELAY_MS = 1500;

type IPrimeGlobalEffectComponent = ComponentType;

function PrimeGlobalEffectLazyCmp() {
  const [shouldMount, setShouldMount] = useState(false);
  const [loadRequestSeq, setLoadRequestSeq] = useState(0);
  const [ContainerImpl, setContainerImpl] =
    useState<IPrimeGlobalEffectComponent | null>(null);
  const containerLoadedRef = useRef(false);
  // Events that arrived before the lazy container mounted, buffered as replay
  // closures keyed by event name (latest payload wins per event). Each closure
  // captures its own re-emit form: invalid-token replays via `emit`, purchase
  // success via `emitToSelf` (it must stay UI-local).
  const pendingReplaysRef = useRef(new Map<EAppEventBusNames, () => void>());
  const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    containerLoadedRef.current = !!ContainerImpl;
  }, [ContainerImpl]);

  const requestMount = useCallback(() => {
    setShouldMount(true);
    setLoadRequestSeq((value) => value + 1);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      requestMount();
    }, PRIME_GLOBAL_EFFECT_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [requestMount]);

  useEffect(() => {
    const handlePurchaseSuccess = (
      payload: IPrimeSubscriptionPurchaseSuccessPayload,
    ) => {
      if (containerLoadedRef.current) {
        return;
      }
      pendingReplaysRef.current.set(
        EAppEventBusNames.PrimeSubscriptionPurchaseSuccess,
        () =>
          appEventBus.emitToSelf({
            type: EAppEventBusNames.PrimeSubscriptionPurchaseSuccess,
            payload,
            isRemote: false,
          }),
      );
      requestMount();
    };
    appEventBus.on(
      EAppEventBusNames.PrimeSubscriptionPurchaseSuccess,
      handlePurchaseSuccess,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.PrimeSubscriptionPurchaseSuccess,
        handlePurchaseSuccess,
      );
    };
  }, [requestMount]);

  useEffect(() => {
    const handleInvalidToken = (payload: IPrimeLoginInvalidTokenPayload) => {
      if (containerLoadedRef.current) {
        return;
      }
      // Capture the payload so the replay keeps the source-aware cleanup
      // information (authSessionSource / clearedByBackground) — a payload
      // dropped to undefined would send the handler down the payload-less
      // legacy fallback branch instead of the keyless sign-out.
      pendingReplaysRef.current.set(
        EAppEventBusNames.PrimeLoginInvalidToken,
        () =>
          appEventBus.emit(EAppEventBusNames.PrimeLoginInvalidToken, payload),
      );
      requestMount();
    };
    appEventBus.on(
      EAppEventBusNames.PrimeLoginInvalidToken,
      handleInvalidToken,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.PrimeLoginInvalidToken,
        handleInvalidToken,
      );
    };
  }, [requestMount]);

  useEffect(() => {
    if (!shouldMount || ContainerImpl) {
      return;
    }
    let isMounted = true;
    void import('../../views/Prime/hooks/PrimeGlobalEffect')
      .then((module) => {
        if (isMounted) {
          setContainerImpl(() => module.PrimeGlobalEffect);
        }
      })
      .catch((error: Error) => {
        console.error('Failed to load PrimeGlobalEffect:', error);
      });
    return () => {
      isMounted = false;
    };
  }, [ContainerImpl, loadRequestSeq, shouldMount]);

  useEffect(() => {
    if (!ContainerImpl || !pendingReplaysRef.current.size) {
      return;
    }
    const replays = Array.from(pendingReplaysRef.current.values());
    pendingReplaysRef.current.clear();
    replayTimerRef.current = setTimeout(() => {
      replays.forEach((replay) => replay());
    }, 0);
    return () => {
      if (replayTimerRef.current) {
        clearTimeout(replayTimerRef.current);
        replayTimerRef.current = null;
      }
    };
  }, [ContainerImpl]);

  useEffect(
    () => () => {
      if (replayTimerRef.current) {
        clearTimeout(replayTimerRef.current);
        replayTimerRef.current = null;
      }
    },
    [],
  );

  if (!ContainerImpl) {
    return null;
  }
  return <ContainerImpl />;
}

export const PrimeGlobalEffectLazy = memo(PrimeGlobalEffectLazyCmp);
