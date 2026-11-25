import { useEffect, useState } from 'react';

import type { IScanCameraInfo } from './types';

type ICameraSource = {
  listCameras: () => Promise<IScanCameraInfo[] | null>;
  subscribeCameraChanges: (listener: () => void) => () => void;
};

export function useScanCameraDiscovery(
  source: ICameraSource | undefined,
  webReadyRevision?: number,
) {
  const [state, setState] = useState<{
    source: ICameraSource;
    cameras: IScanCameraInfo[];
    loaded: boolean;
  }>();

  useEffect(() => {
    if (!source) return;
    let request: number | undefined = 0;
    const refresh = () => {
      if (request === undefined) return;
      request += 1;
      const current = request;
      const settleWithoutList = () => {
        if (request !== current) return;
        setState((previous) =>
          previous?.source === source
            ? previous
            : { source, cameras: [], loaded: false },
        );
      };
      source
        .listCameras()
        .then((cameras) => {
          if (request !== current) return;
          if (cameras === null) {
            settleWithoutList();
            return;
          }
          setState({
            source,
            cameras,
            loaded:
              webReadyRevision === undefined ||
              (webReadyRevision > 0 && cameras.length > 0),
          });
        })
        .catch((error: unknown) => {
          if (request !== current) return;
          console.error('[ScanCamera] listCameras failed', error);
          settleWithoutList();
        });
    };
    refresh();
    const unsubscribe = source.subscribeCameraChanges(refresh);
    return () => {
      request = undefined;
      unsubscribe();
    };
  }, [source, webReadyRevision]);

  return state?.source === source && state
    ? { cameras: state.cameras, loaded: state.loaded, pending: false }
    : { cameras: [], loaded: false, pending: !!source };
}
