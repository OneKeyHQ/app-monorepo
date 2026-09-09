import type { ReactNode } from 'react';

export interface ITradingViewNativePresentationProps {
  children: ReactNode;
  isFullscreen: boolean;
}

export function TradingViewNativePresentation({
  children,
}: ITradingViewNativePresentationProps) {
  return children;
}

export function TradingViewNativeFullscreenHost() {
  return null;
}
