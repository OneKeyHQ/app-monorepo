// Orientation of the app's window scene, named as UIKit names it. Landscape
// right turns the top of the device, and an iPhone's sensor housing, to the
// left edge of the screen; landscape left turns it to the right edge.
export type IInterfaceOrientation =
  | 'portrait'
  | 'portraitUpsideDown'
  | 'landscapeLeft'
  | 'landscapeRight'
  | 'unknown';
