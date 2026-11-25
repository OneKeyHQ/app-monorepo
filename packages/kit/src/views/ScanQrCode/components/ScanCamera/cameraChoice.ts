import type { IScanCameraInfo } from './types';

/**
 * The camera actually in use: the chosen one while it is connected, else the
 * default the scanner falls back to (the back camera, else the first).
 */
export function resolveCameraIndex(
  cameras: IScanCameraInfo[],
  chosenId: string | undefined,
): number {
  const chosen = cameras.findIndex((camera) => camera.id === chosenId);
  if (chosen >= 0) return chosen;
  const back = cameras.findIndex((camera) => camera.position === 'back');
  return back >= 0 ? back : 0;
}

/** The id to pass as `cameraId`: undefined unless the chosen one is connected. */
export function effectiveCameraId(
  cameras: IScanCameraInfo[],
  chosenId: string | undefined,
): string | undefined {
  return cameras.some((camera) => camera.id === chosenId)
    ? chosenId
    : undefined;
}

/** The camera after the current one, wrapping around. */
export function nextCamera(
  cameras: IScanCameraInfo[],
  chosenId: string | undefined,
): IScanCameraInfo | undefined {
  if (cameras.length < 2) return undefined;
  return cameras[(resolveCameraIndex(cameras, chosenId) + 1) % cameras.length];
}
