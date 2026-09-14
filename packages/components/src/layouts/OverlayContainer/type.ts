import type { PropsWithChildren } from 'react';

export type IOverlayContainerProps = PropsWithChildren<{
  /**
   * iOS only: bump to bring this overlay's native window container above
   * every overlay added since (a modal dialog's own FullWindowOverlay). The
   * hardware stage bumps it on each appearance (OK-62422); other platforms
   * ignore it.
   */
  bringToFrontToken?: number;
}>;
