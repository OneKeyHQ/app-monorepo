import { memo, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

const PRIME_GLOBAL_EFFECT_DELAY_MS = 1500;

type IPrimeGlobalEffectComponent = ComponentType;

function PrimeGlobalEffectLazyCmp() {
  const [shouldMount, setShouldMount] = useState(false);
  const [ContainerImpl, setContainerImpl] =
    useState<IPrimeGlobalEffectComponent | null>(null);
  const containerLoadedRef = useRef(false);
  const hasPendingInvalidTokenEventRef = useRef(false);
  const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    containerLoadedRef.current = !!ContainerImpl;
  }, [ContainerImpl]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldMount(true);
    }, PRIME_GLOBAL_EFFECT_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const handleInvalidToken = () => {
      if (containerLoadedRef.current) {
        return;
      }
      hasPendingInvalidTokenEventRef.current = true;
      setShouldMount(true);
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
  }, []);

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
  }, [ContainerImpl, shouldMount]);

  useEffect(() => {
    if (!ContainerImpl || !hasPendingInvalidTokenEventRef.current) {
      return;
    }
    hasPendingInvalidTokenEventRef.current = false;
    replayTimerRef.current = setTimeout(() => {
      appEventBus.emit(EAppEventBusNames.PrimeLoginInvalidToken, undefined);
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
