import type { IDesktopLayoutProps } from './DesktopLayout.types';

export function DesktopLayout(_props: IDesktopLayoutProps) {
  // Native always renders MobileLayout. This stub keeps Metro from pulling the
  // desktop list graph into the main native split-bundle segment.
  return null;
}
