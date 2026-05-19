import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

/**
 * Native image processing capabilities that `imageUtils` needs but cannot
 * implement in pure RN (no canvas / no DOM). Each runtime registers an
 * implementation at boot — BG side via webembed proxy, main thread via the
 * local WebView bridge.
 *
 * Keeping the contract in `shared` lets the lower-level package call into
 * higher-level capabilities without ever importing `kit-bg`, replacing the
 * legacy `appGlobals.$webembedApiProxy.imageUtils.*` magic global with a
 * typed slot.
 */
export interface IImageEmbedBridge {
  convertToBlackAndWhiteImageBase64(
    colorImageBase64: string,
    mime: string,
  ): Promise<string>;
  applyRoundedCorners(params: {
    base64: string;
    width: number;
    height: number;
    radius: number;
    backgroundColor?: string;
  }): Promise<string>;
  base64ImageToBitmap(params: {
    base64: string;
    width: number;
    height: number;
  }): Promise<string>;
  processImageBlur(params: {
    base64Data: string;
    blurRadius?: number;
    overlayOpacity?: number;
  }): Promise<{ hex: string; width: number; height: number }>;
}

let registeredBridge: IImageEmbedBridge | undefined;

export function registerImageEmbedBridge(impl: IImageEmbedBridge): void {
  registeredBridge = impl;
}

export function getImageEmbedBridge(): IImageEmbedBridge {
  if (!registeredBridge) {
    throw new OneKeyLocalError(
      'imageUtils embed bridge not registered. The runtime did not install a webembed-backed image processor before native image processing was invoked.',
    );
  }
  return registeredBridge;
}
