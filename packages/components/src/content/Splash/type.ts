import type { PropsWithChildren } from 'react';

import type { LayoutChangeEvent } from 'react-native';

export interface ISplashViewProps {
  ready: Promise<void>;
  onExit?: () => void;
}

export type ISplashViewChildrenContentProps = PropsWithChildren<{
  onLayout?: (event: LayoutChangeEvent) => void;
}>;
