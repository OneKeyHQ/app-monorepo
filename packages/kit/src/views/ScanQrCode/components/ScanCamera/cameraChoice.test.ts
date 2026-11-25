import {
  effectiveCameraId,
  nextCamera,
  resolveCameraIndex,
} from './cameraChoice';

import type { IScanCameraInfo } from './types';

const back: IScanCameraInfo = { id: 'b', position: 'back', label: 'Back' };
const front: IScanCameraInfo = { id: 'f', position: 'front', label: 'Front' };
const usb: IScanCameraInfo = { id: 'u', position: 'external', label: 'USB' };

describe('camera choice', () => {
  it('uses the chosen camera while connected, else the back camera', () => {
    expect(resolveCameraIndex([front, back], 'f')).toBe(0);
    expect(resolveCameraIndex([front, back], undefined)).toBe(1);
    expect(resolveCameraIndex([front, back], 'gone')).toBe(1);
    expect(resolveCameraIndex([usb, front], undefined)).toBe(0);
    expect(effectiveCameraId([front, back], 'gone')).toBeUndefined();
    expect(effectiveCameraId([front, back], 'f')).toBe('f');
  });

  it('toggles between two cameras and cycles through more', () => {
    expect(nextCamera([back, front], undefined)).toBe(front);
    expect(nextCamera([back, front], 'f')).toBe(back);
    expect(nextCamera([back, front, usb], 'f')).toBe(usb);
    expect(nextCamera([back, front, usb], 'u')).toBe(back);
  });

  it('offers no switch with fewer than two cameras', () => {
    expect(nextCamera([back], undefined)).toBeUndefined();
    expect(nextCamera([], undefined)).toBeUndefined();
  });
});
