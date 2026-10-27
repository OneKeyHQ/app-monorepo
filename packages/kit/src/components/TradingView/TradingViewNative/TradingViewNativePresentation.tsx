import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { createPortal } from 'react-dom';

import { useTheme } from '@onekeyhq/components';
import type {
  EModalRoutes,
  IModalParamList,
} from '@onekeyhq/shared/src/routes';

export type IPushTradingViewNativeFullscreenModal = <T extends EModalRoutes>(
  route: T,
  params: {
    screen: keyof IModalParamList[T];
    params?: IModalParamList[T][keyof IModalParamList[T]];
  },
) => boolean;

export const pushTradingViewNativeFullscreenModal: IPushTradingViewNativeFullscreenModal =
  () => false;

export interface ITradingViewNativePresentationProps {
  children: ReactNode;
  isFullscreen: boolean;
  useFullscreenOverlay?: boolean;
  onRequestClose?: () => void;
}

function WebFullscreenPresentation({
  children,
  isFullscreen,
  onRequestClose,
}: ITradingViewNativePresentationProps) {
  const theme = useTheme();
  const inlineHost = useRef<HTMLDivElement>(null);
  const [container] = useState(() => document.createElement('div'));
  useLayoutEffect(() => {
    const host = isFullscreen ? document.body : inlineHost.current;
    if (!host) return;
    // Move the portal container to retain the canvas, viewport and React state.
    host.appendChild(container);
    Object.assign(container.style, {
      display: 'flex',
      flexDirection: 'column',
      position: isFullscreen ? 'fixed' : 'relative',
      inset: isFullscreen ? '0' : '',
      width: '100%',
      height: '100%',
      minHeight: '0',
      zIndex: isFullscreen ? '1000' : '',
      background: theme.bgApp.val,
      boxSizing: 'border-box',
      padding: isFullscreen
        ? 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'
        : '',
      overscrollBehavior: 'contain',
    });
    container.dataset.testid = isFullscreen
      ? 'trading-view-native-fullscreen-layer'
      : 'trading-view-native-inline-layer';
    return () => container.remove();
  }, [container, isFullscreen, theme.bgApp.val]);
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        onRequestClose?.();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen, onRequestClose]);
  return (
    <div
      ref={inlineHost}
      style={{ width: '100%', height: '100%', minHeight: 0 }}
    >
      {createPortal(children, container)}
    </div>
  );
}

export function TradingViewNativePresentation({
  children,
  isFullscreen,
  useFullscreenOverlay,
  onRequestClose,
}: ITradingViewNativePresentationProps) {
  if (useFullscreenOverlay)
    return (
      <WebFullscreenPresentation
        isFullscreen={isFullscreen}
        onRequestClose={onRequestClose}
      >
        {children}
      </WebFullscreenPresentation>
    );
  return children;
}

export function TradingViewNativeFullscreenHost() {
  return null;
}

export function TradingViewNativeFullscreenPage() {
  return null;
}
