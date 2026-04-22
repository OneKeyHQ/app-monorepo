import type { PropsWithChildren } from 'react';

import type { LayoutChangeEvent } from 'react-native';

export interface ISplashViewProps {
  canDismissSplash: boolean;
  onExit?: () => void;
}

export type ISplashViewChildrenContentProps = PropsWithChildren<{
  onLayout?: (event: LayoutChangeEvent) => void;
}>;
