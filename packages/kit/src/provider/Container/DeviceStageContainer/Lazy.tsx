import { memo, useEffect, useState } from 'react';
import type { ComponentType } from 'react';

import { useDeviceStageAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

type IDeviceStageContainerComponent = ComponentType;

/**
 * How long after mount the stage implementation is warmed up when no burst
 * has asked for it yet. Long enough to stay clear of the cold-start window
 * the web perf gate measures (business-ready timeout 30s + 5s settle),
 * short enough that the chunk is almost always resident before the first
 * hardware call of a session; a call that comes sooner loads on demand.
 */
const WARM_UP_DELAY_MS = 60_000;

/**
 * Lazy shell for the DeviceStage driver (OK-59934).
 *
 * The stage component tree — the replicas with their baked shells, the
 * card panels, MorphOverlay, the in-card QR scanner — is a few hundred KiB
 * that no cold start needs. This shell is what stays on the startup graph:
 * it only watches `deviceStageAtom` and pulls the real container in the
 * moment a burst puts the stage on (or after a warm-up delay). Once loaded
 * the container stays mounted for the life of the app, exactly as before.
 */
function DeviceStageContainerLazyCmp() {
  const [stage] = useDeviceStageAtom();
  const [Impl, setImpl] = useState<IDeviceStageContainerComponent | null>(null);
  const stageIsOn = Boolean(stage && stage.step !== 'off');

  useEffect(() => {
    if (Impl) {
      return undefined;
    }
    let cancelled = false;
    const load = () => {
      void import('./index')
        .then((module) => {
          if (!cancelled) {
            setImpl(() => module.DeviceStageContainer);
          }
        })
        .catch((error: Error) => {
          console.error('Failed to load DeviceStageContainer:', error);
        });
    };
    if (stageIsOn) {
      load();
      return () => {
        cancelled = true;
      };
    }
    const timer = setTimeout(load, WARM_UP_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [Impl, stageIsOn]);

  return Impl ? <Impl /> : null;
}

export const DeviceStageContainerLazy = memo(DeviceStageContainerLazyCmp);
