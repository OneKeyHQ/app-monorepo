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
      source
        .listCameras()
        .then((cameras) => {
          if (request !== current || cameras === null) return;
          setState({
            source,
            cameras,
            loaded:
              webReadyRevision === undefined ||
              (webReadyRevision > 0 && cameras.length > 0),
          });
        })
        .catch((error: unknown) => {
          if (request === current)
            console.error('[ScanCamera] listCameras failed', error);
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
    ? { cameras: state.cameras, loaded: state.loaded }
    : { cameras: [], loaded: false };
}
