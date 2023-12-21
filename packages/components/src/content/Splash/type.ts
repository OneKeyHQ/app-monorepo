import type { PropsWithChildren } from 'react';

import type { LayoutChangeEvent } from 'react-native';

export interface ISplashViewProps {
  onReady: () => void;
}

export type ISplashViewChildrenContentProps = PropsWithChildren<{
  visible?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
}>;
